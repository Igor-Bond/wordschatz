import { actions } from '../core/actions.js';
import { announce } from '../core/announce.js';
import { quiz } from '../core/quiz.js';
import { declension } from '../core/declension.js';
import { speech } from '../core/speech.js';
import { masteryUtils } from '../core/mastery.js';
import { srs } from '../core/srs.js';
import { germanUtils } from '../core/german.js';
import { t, plural } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { lessonStateManager } from '../core/lessonState.js';
import { training } from './training.js';

export const exercises = {

    /** Опыт за задание: верно и неверно (за попытку тоже что-то даём). */
    XP_CORRECT: 4,
    XP_WRONG: 1,

    /**
     * Пауза перед следующим заданием в сборке предложения.
     *
     * Было полторы секунды, и этого не хватало: собранное предложение
     * успевало смениться раньше, чем его удавалось перечитать целиком.
     * В остальных девяти заданиях читать нечего — там одно слово, — а
     * здесь на экране целая фраза, ради которой задание и затевалось.
     */
    BUILDER_NEXT_DELAY: 3750,

    /**
     * Опыт за собранное предложение, по числу неудачных сборок.
     *
     * Полный — только за сборку с первого раза: 4, 2, 1, дальше 1.
     * Пересобирать можно сколько угодно, и что-то за это причитается —
     * но не столько же, сколько за верный ответ сразу.
     */
    builderXP: (attempts) => Math.max(
        exercises.XP_WRONG,
        Math.round(exercises.XP_CORRECT / (attempts + 1))
    ),

    /** Допустимые варианты ответа для текущего задания с вводом. */
    acceptedAnswers: null,

    /**
     * От узнавания к активному воспроизведению (§12 ТЗ).
     *
     * Раньше тип задания выбирался случайно из всех подходящих: слово,
     * увиденное первый раз, могло сразу попасть на аудирование с вводом,
     * а давно выученное — на выбор из четырёх кнопок.
     */
    STAGES: {
        /*
         * Узнать среди готовых вариантов — ничего не писать по памяти.
         *
         * Раньше здесь было три режима, и у нового глагола или
         * прилагательного оставалось два: артикль им не задаётся. Первое
         * знакомство с темой превращалось в чередование «выбери перевод»
         * и «найди пару», о чём и сообщили. Добавлены задания, где ответ
         * тоже целиком на экране: обратный выбор перевода, сборка
         * предложения из данных слов и окончание прилагательного —
         * последнее считается правилом и знания слова не требует вовсе.
         */
        recognition: ['translation_de_ru', 'translation_ru_de', 'match_pairs', 'article', 'sentence_builder', 'adjective_ending'],

        /*
         * Выбор потруднее плюс первые задания с вводом.
         *
         * Семь типов на бумаге, а на деле у одного слова их куда меньше:
         * артикль, управление, форма глагола и окончание прилагательного
         * исключают друг друга по части речи, а «вставить слово» и
         * «собрать предложение» требуют примера в карточке. Существительное
         * без примера получало ровно два типа, фраза — один, и урок из
         * такого словаря выглядел однообразным независимо от того, сколько
         * заданий написано.
         *
         * Поэтому здесь есть match_pairs: он не требует от карточки ничего,
         * кроме соседей по словарю. По сложности это шаг вбок, а не вверх, —
         * и он честно оплачен тем, что иначе выбирать не из чего.
         */
        consolidation: ['translation_ru_de', 'match_pairs', 'article', 'rektion', 'verb_form', 'fill_blanks', 'adjective_ending', 'sentence_builder'],

        // Написать самому
        production: ['translation_ru_de_input', 'verb_form', 'fill_blanks', 'listening', 'sentence_builder', 'adjective_ending']
    },

    /** Экранирование для подстановки в атрибут. */
    escAttr: (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),

    /** Этап для слова: по числу повторений и освоению. */
    getStage: (word) => {
        const repetitions = word?.repetitions || 0;
        const mastery = word?.mastery || 0;

        // Пороги под шкалу освоенности: 30 — интервал около двух дней,
        // 65 — около двух недель. К вводу вручную переходим, когда слово
        // уже переживало заметные перерывы
        if (repetitions < 2 || mastery < 30) return 'recognition';
        if (mastery < 65) return 'consolidation';
        return 'production';
    },

    /**
     * Выбор задания под этап слова.
     * Если для этапа ничего не подходит (например, у слова нет примера),
     * берём любое доступное — оставить пользователя без задания нельзя.
     */
    pickByStage: (word, validModes) => {
        const stage = exercises.getStage(word);
        const preferred = validModes.filter(m => exercises.STAGES[stage].includes(m));

        let pool = preferred.length ? preferred : validModes;

        /*
         * Не тот же тип, что в прошлый раз.
         *
         * Выбор случаен, и при пуле из двух-трёх типов он охотно
         * повторяется: из двух вариантов один и тот же выпадает каждый
         * второй раз, а подряд — каждый четвёртый. Урок кажется
         * однообразнее, чем он есть на самом деле.
         *
         * Если, исключив прошлый тип, не остаётся ничего — значит выбора
         * и правда нет, и повтор честен.
         */
        const другие = pool.filter(m => m !== word?.lastMode);
        if (другие.length) pool = другие;

        return quiz.shuffle(pool)[0];
    },

    queue: [],
    currentIndex: 0,
    onFinish: null,
    isRoomMode: false,
    allowedModes: null,

    /**
     * Режим экзамена (§31 ТЗ).
     *
     * Контроль темы раньше имел собственные три задания и собственную
     * проверку ответов — треть от того, чем занимаются на уроке. Теперь он
     * пользуется этим же движком: { title, onAnswer(word, correct, mode) }.
     * XP за отдельный ответ в экзамене не начисляется, его выдают за итог.
     */
    exam: null,

    /** Тип текущего задания — нужен экзамену для разбора ошибок. */
    _currentMode: null,
    
    builderState: {
        words: [],
        selected: [],
        correct: [],

        /** Сколько раз предложение собрали неверно. */
        attempts: 0,

        /** Первая неверная сборка — она и попадёт в разбор ошибок. */
        firstWrong: null,

        /** Задание завершено: сошлось или пропущено. */
        answered: false
    },
    
    matchPairsState: {
        selectedDe: null,
        selectedRu: null,
        matchedCount: 0,
        totalPairs: 4
    },

    start: async (wordsList, startIndex, onFinishCallback) => {
        exercises.queue = wordsList;
        exercises.currentIndex = startIndex;
        exercises.onFinish = onFinishCallback;

        if (exercises.queue.length === 0 || exercises.currentIndex >= exercises.queue.length) {
            exercises.onFinish();
            return;
        }
        exercises.renderCurrent();
    },

    renderCurrent: async () => {
        document.body.classList.add('lesson-mode');
        const main = document.getElementById('main-content');
        const word = exercises.queue[exercises.currentIndex];
        const progress = (exercises.currentIndex / exercises.queue.length) * 100;

        let title = exercises.exam
            ? exercises.exam.title
            : (exercises.isRoomMode ? t('exercises.freeTraining') : t('exercises.practice'));

        // Экзамен красный, урок и Комната фиолетовые — по цвету шапки видно,
        // идёт тренировка или зачёт
        const accent = exercises.exam?.accent || 'purple-400';
        const barColor = exercises.exam ? 'bg-red-500' : 'bg-purple-500';

        // Шапка с прогрессом закреплена, само задание прокручивается:
        // у длинных заданий вроде сборки предложения содержимое не помещается
        let html = `
            <div class="max-w-lg mx-auto h-full flex flex-col pt-2 fade-in">
                <div class="flex items-center justify-between mb-2 shrink-0">
                    <span class="text-[10px] font-bold text-${accent} uppercase tracking-wider bg-${accent}/10 px-2 py-1 rounded border border-${accent}/20 shadow-sm">${title}</span>
                    <span class="text-xs font-bold text-slate-500">${t('exercises.taskOf', { current: exercises.currentIndex + 1, total: exercises.queue.length })}</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-2 mb-4 border border-slate-700 overflow-hidden shrink-0 mt-1">
                    <div class="${barColor} h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto hide-scrollbar pb-2">
        `;

        let validModes = [];
        const requested = exercises.allowedModes || [];
        const hasRequested = requested.length > 0;

        if (!hasRequested || requested.includes('translation_de_ru')) validModes.push('translation_de_ru');
        if (!hasRequested || requested.includes('translation_ru_de')) validModes.push('translation_ru_de');
        if (!hasRequested || requested.includes('match_pairs')) validModes.push('match_pairs');

        // Артикль спрашиваем, только если он реально известен: иначе задание
        // подставляло «der» и учило неправильному роду
        if ((!hasRequested || requested.includes('article')) && germanUtils.hasKnownArticle(word)) validModes.push('article');

        if ((!hasRequested || requested.includes('verb_form')) && word.type === 'verb' && (word.preterite || word.participle_ii)) validModes.push('verb_form');

        // Управление — только если из строки удалось вытащить предлог или падеж
        if ((!hasRequested || requested.includes('rektion')) && germanUtils.hasRektion(word)) validModes.push('rektion');

        if ((!hasRequested || requested.includes('fill_blanks')) && word.example_de) validModes.push('fill_blanks');
        if ((!hasRequested || requested.includes('sentence_builder')) && word.example_de) validModes.push('sentence_builder');
        // Аудирование только если есть чем читать: без немецкого голоса
        // задание превращается в «запишите тишину»
        if ((!hasRequested || requested.includes('listening')) && word.word && await speech.isAvailable()) {
            validModes.push('listening');
        }
        if ((!hasRequested || requested.includes('translation_ru_de_input')) && word.word) validModes.push('translation_ru_de_input');

        // Окончание прилагательного собирается по правилу, данных не требует
        if ((!hasRequested || requested.includes('adjective_ending')) && word.type === 'adjective' && !declension.isIndeclinable(word.word)) {
            validModes.push('adjective_ending');
        }

        if (validModes.length === 0) validModes.push('translation_de_ru');

        // Экзамен раскладывает типы заданий заранее, чтобы каждое слово
        // спросили по-разному; в Комнате режим выбран пользователем,
        // на уроке — по освоенности слова
        const exType = word.__mode && validModes.includes(word.__mode)
            ? word.__mode
            : (hasRequested ? quiz.shuffle(validModes)[0] : exercises.pickByStage(word, validModes));

        exercises._currentMode = exType;

        let block = null;
        if (exType === 'translation_ru_de_input') block = exercises.renderProductionQuiz(word);
        else if (exType === 'article') block = exercises.renderArticleQuiz(word);
        else if (exType === 'verb_form') block = exercises.renderVerbQuiz(word);
        else if (exType === 'fill_blanks') block = await exercises.renderFillBlanksQuiz(word);
        else if (exType === 'sentence_builder') block = exercises.renderSentenceBuilder(word);
        else if (exType === 'listening') block = exercises.renderListeningQuiz(word);
        else if (exType === 'rektion') block = exercises.renderRektionQuiz(word);
        else if (exType === 'adjective_ending') block = exercises.renderAdjectiveEnding(word);
        else if (exType === 'match_pairs') block = await exercises.renderMatchPairsQuiz(word);
        else if (exType === 'translation_ru_de') block = await exercises.renderTranslationQuiz(word, 'ru-de');
        else block = await exercises.renderTranslationQuiz(word, 'de-ru');

        // Задание может отказаться от слова, если данных не хватает —
        // тогда подставляем перевод, он подходит любому слову
        if (!block) block = await exercises.renderTranslationQuiz(word, 'de-ru');

        html += block;
        html += `</div></div>`;   // закрываем прокручиваемую область и контейнер
        main.innerHTML = html;
        
        setTimeout(() => {
            const input = document.querySelector('input[type="text"]:not([disabled])');
            if (input) input.focus();
        }, 100);

        // Аудирование само произносит слово. Раньше это делал <script> внутри
        // строки разметки — такие теги при вставке через innerHTML браузер
        // не выполняет, и автопроизношение никогда не работало
        if (exType === 'listening') setTimeout(() => training.playAudio(word.word), 300);
    },

    // ==========================================
    // НАЙДИ ПАРУ (MATCH PAIRS)
    // ==========================================
    renderMatchPairsQuiz: async (word) => {
        // Пары той же части речи: иначе колонки легко сопоставлялись
        // по грамматике, без знания слов.
        // В отличие от выбора ответа, здесь «лишние» слова тоже нужно
        // сопоставить — значит, они должны быть пройденными
        const studied = await dbService.getStudiedWords();
        const allWords = studied.length >= 4 ? studied : await dbService.getAllWords();
        const distractors = quiz.pickDistractors(word, allWords, 3);
        const pairs = [...distractors, word];

        exercises.matchPairsState = { selectedDe: null, selectedRu: null, matchedCount: 0, totalPairs: pairs.length };

        const deBtns = quiz.shuffle(pairs.map(p => ({ id: p.id, text: p.word, lang: 'de' })));
        const ruBtns = quiz.shuffle(pairs.map(p => ({ id: p.id, text: p.translation, lang: 'ru' })));
        
        const renderBtn = (obj) => `<button id="mp-${obj.lang}-${obj.id}" onclick="exercises.clickMatchPair('${obj.lang}', ${obj.id})" class="mp-btn p-3 bg-slate-900 border-2 border-slate-700 text-slate-300 font-bold rounded-xl active:scale-95 transition-all text-sm h-16 flex items-center justify-center text-center break-words leading-tight hover:bg-slate-800">${obj.text}</button>`;

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6">
                <h3 class="text-sm font-bold text-slate-400 mb-6 text-center">${t('exercises.matchPairs')}</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-3 flex flex-col">${deBtns.map(renderBtn).join('')}</div>
                    <div class="space-y-3 flex flex-col">${ruBtns.map(renderBtn).join('')}</div>
                </div>
            </div>
        `;
    },

    clickMatchPair: (lang, id) => {
        const btn = document.getElementById(`mp-${lang}-${id}`);
        if (btn.classList.contains('matched') || btn.classList.contains('selected')) return;

        document.querySelectorAll(`.mp-btn.selected[id^="mp-${lang}-"]`).forEach(b => {
            b.classList.remove('selected', 'border-amber-500', 'text-amber-400', 'bg-amber-900/30');
            b.classList.add('border-slate-700', 'text-slate-300', 'bg-slate-900');
        });

        btn.classList.add('selected', 'border-amber-500', 'text-amber-400', 'bg-amber-900/30');
        btn.classList.remove('border-slate-700', 'text-slate-300', 'bg-slate-900');

        if (lang === 'de') exercises.matchPairsState.selectedDe = id;
        if (lang === 'ru') exercises.matchPairsState.selectedRu = id;

        const state = exercises.matchPairsState;
        if (state.selectedDe !== null && state.selectedRu !== null) {
            const deBtn = document.getElementById(`mp-de-${state.selectedDe}`);
            const ruBtn = document.getElementById(`mp-ru-${state.selectedRu}`);

            if (state.selectedDe === state.selectedRu) {
                deBtn.className = "mp-btn matched p-3 bg-green-600 border-2 border-green-400 text-white font-black rounded-xl text-sm h-16 flex items-center justify-center text-center transition-all scale-95 opacity-50";
                ruBtn.className = "mp-btn matched p-3 bg-green-600 border-2 border-green-400 text-white font-black rounded-xl text-sm h-16 flex items-center justify-center text-center transition-all scale-95 opacity-50";
                state.matchedCount++;
                state.selectedDe = null;
                state.selectedRu = null;

                if (state.matchedCount === state.totalPairs) {
                    exercises.awardXP(true);
                    setTimeout(exercises.next, 1000);
                }
            } else {
                // ЛОГИРОВАНИЕ ОШИБКИ
                if (typeof dbService !== 'undefined' && dbService.logMistake) {
                    dbService.logMistake(state.selectedDe, 'match_pairs', 'wrong_pair');
                }

                deBtn.classList.replace('border-amber-500', 'border-red-500');
                deBtn.classList.replace('text-amber-400', 'text-red-400');
                deBtn.classList.replace('bg-amber-900/30', 'bg-red-900/30');
                
                ruBtn.classList.replace('border-amber-500', 'border-red-500');
                ruBtn.classList.replace('text-amber-400', 'text-red-400');
                ruBtn.classList.replace('bg-amber-900/30', 'bg-red-900/30');
                
                setTimeout(() => {
                    deBtn.classList.remove('selected', 'border-red-500', 'text-red-400', 'bg-red-900/30');
                    deBtn.classList.add('border-slate-700', 'text-slate-300', 'bg-slate-900');
                    ruBtn.classList.remove('selected', 'border-red-500', 'text-red-400', 'bg-red-900/30');
                    ruBtn.classList.add('border-slate-700', 'text-slate-300', 'bg-slate-900');
                }, 800);
                
                state.selectedDe = null;
                state.selectedRu = null;
            }
        }
    },

    // ==========================================
    // ПРЯМОЙ / ОБРАТНЫЙ ПЕРЕВОД
    // ==========================================
    renderTranslationQuiz: async (word, direction = 'de-ru') => {
        const allWords = await dbService.getAllWords();
        // Дистракторы той же части речи и по возможности той же темы
        const options = quiz.buildOptions(word, allWords, 3);

        const questionText = direction === 'ru-de' ? word.translation : word.word;
        const btnClass = direction === 'ru-de' ? 'text-xl' : 'text-base';
        const label = direction === 'ru-de' ? t('exercises.howInGerman') : t('exercises.pickTranslation');

        let btns = options.map(opt => {
            const answerText = direction === 'ru-de' ? opt.word : opt.translation;
            return `<button data-action="exercises.checkChoice" data-value="${opt.id}" data-correct="${word.id}" data-mode="${direction}" class="w-full py-4 bg-slate-900 border-2 border-slate-700 text-slate-300 font-bold rounded-xl text-left px-5 hover:border-amber-500 active:scale-95 transition-all ${btnClass}">${answerText}</button>`;
        }).join('');

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6">
                <h3 class="text-sm font-bold text-slate-400 mb-6 text-center">${label}</h3>
                <h2 class="text-3xl font-black text-slate-100 mb-8 text-center">${questionText}</h2>
                <div class="space-y-3" id="ex-buttons">${btns}</div>
            </div>
        `;
    },

    /**
     * Воспроизведение: написать немецкое слово по переводу (§13 ТЗ).
     *
     * Обратный перевод до сих пор был выбором из четырёх кнопок, то есть
     * узнаванием. Для освоенного слова это слишком просто.
     */
    renderProductionQuiz: (word) => {
        const full = String(word.word || '').trim();
        const bare = germanUtils.stripArticle(word);
        const gender = germanUtils.getGender(word);

        // Существительное принимаем и с артиклем, и без: артикль
        // тренируется отдельным заданием
        exercises.acceptedAnswers = gender ? [full, bare] : [full];

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">${t('exercises.writeInGerman')}</h3>
                <h2 class="text-3xl font-black text-amber-500 mb-8">${word.translation}</h2>

                <input type="text" id="ex-input" autocomplete="off" autocapitalize="off" spellcheck="false"
                    class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 mb-4 outline-none focus:border-amber-500 text-center text-xl font-bold shadow-inner transition-colors"
                    placeholder="${exercises.escAttr(t("exercises.wordPlaceholder"))}">

                <button data-action="exercises.checkInput" data-correct="${actions.attr(full)}" data-mode="translation_ru_de_input"
                    class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">
                    ${t('exercises.check')}
                </button>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
            </div>
        `;
    },

    renderArticleQuiz: (word) => {
        // Артикль берём только из самого слова. Раньше при его отсутствии
        // молча подставлялся «der», и приложение объявляло «der Lampe»
        // правильным ответом. Слова без артикля до этого задания не доходят
        // (см. фильтр в renderCurrent), но подстраховываемся.
        // Род берём из отдельного поля, а при его отсутствии — из самого слова
        const article = germanUtils.getGender(word);
        if (!article) return null;   // род неизвестен — спрашивать нечего

        const pureWord = germanUtils.stripArticle(word);

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">${t('exercises.pickArticle')}</h3>
                <h2 class="text-4xl font-black text-slate-100 mb-8 break-words">${pureWord}</h2>
                <div class="grid grid-cols-3 gap-3" id="ex-buttons">
                    <button data-action="exercises.checkChoice" data-value="der" data-correct="${actions.attr(article)}" data-mode="article" class="py-4 bg-blue-900/30 border-2 border-blue-900/50 text-blue-400 font-bold rounded-xl text-xl hover:bg-blue-900/50 active:scale-95 transition-all">DER</button>
                    <button data-action="exercises.checkChoice" data-value="die" data-correct="${actions.attr(article)}" data-mode="article" class="py-4 bg-red-900/30 border-2 border-red-900/50 text-red-400 font-bold rounded-xl text-xl hover:bg-red-900/50 active:scale-95 transition-all">DIE</button>
                    <button data-action="exercises.checkChoice" data-value="das" data-correct="${actions.attr(article)}" data-mode="article" class="py-4 bg-green-900/30 border-2 border-green-900/50 text-green-400 font-bold rounded-xl text-xl hover:bg-green-900/50 active:scale-95 transition-all">DAS</button>
                </div>
            </div>
        `;
    },

    renderVerbQuiz: (word) => {
        // Perfekt собирается как «hat gemacht» / «ist gegangen».
        // Раньше склеивалось «haben gemacht», и правильный ответ
        // пользователя засчитывался как ошибка.
        const perfekt = germanUtils.perfektForm(word);
        const preteritum = germanUtils.preteritumForm(word);

        const askPerfekt = perfekt && (!preteritum || Math.random() > 0.5);
        const form = askPerfekt ? perfekt : preteritum;
        if (!form) return null;

        const targetForm = form.primary;
        exercises.acceptedAnswers = form.accepted;

        const label = askPerfekt ? t('exercises.perfektLabel') : 'Präteritum (ich/er/sie/es)';
        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">${t('exercises.writeVerbForm')}</h3>
                <h2 class="text-3xl font-black text-slate-100 mb-2">${word.word}</h2>
                <p class="text-slate-500 mb-8 font-bold">${word.translation}</p>
                <div class="mb-6 text-left">
                    <label class="block text-xs font-bold text-amber-500 mb-2">${label}</label>
                    <input type="text" id="ex-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold transition-colors" autocomplete="off">
                </div>
                <button data-action="exercises.checkInput" data-correct="${actions.attr(targetForm)}" data-mode="verb_form" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">${t('exercises.check')}</button>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
            </div>
        `;
    },

    renderFillBlanksQuiz: async (word) => {
        const cleanWord = word.word.replace(/^(der|die|das|den|dem|des|ein|eine|sich)\s+/i, '').trim();
        const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        let masked = word.example_de;
        let targetMatch = cleanWord;
        let found = false;

        let rx = new RegExp('\\b' + escapeRegExp(cleanWord) + '\\b', 'gi');
        let matches = masked.match(rx);
        if (matches) { targetMatch = matches[0]; masked = masked.replace(rx, '_____'); found = true; }

        if (!found) {
            rx = new RegExp('\\b' + escapeRegExp(cleanWord) + '[a-zäöüß]*\\b', 'gi');
            matches = masked.match(rx);
            if (matches) { targetMatch = matches[0]; masked = masked.replace(new RegExp('\\b' + escapeRegExp(targetMatch) + '\\b', 'gi'), '_____'); found = true; }
        }

        if (!found && cleanWord.length > 3) {
            let stem = cleanWord;
            if (stem.endsWith('en')) stem = stem.slice(0, -2);
            else if (stem.endsWith('n')) stem = stem.slice(0, -1);
            
            rx = new RegExp('\\b' + escapeRegExp(stem) + '[a-zäöüß]*\\b', 'gi');
            matches = masked.match(rx);
            if (matches && matches[0].length >= stem.length) { targetMatch = matches[0]; masked = masked.replace(new RegExp('\\b' + escapeRegExp(targetMatch) + '\\b', 'gi'), '_____'); found = true; }
        }

        if (!found) {
            rx = new RegExp(escapeRegExp(cleanWord), 'gi');
            matches = masked.match(rx);
            if (matches) { targetMatch = matches[0]; masked = masked.replace(rx, '_____'); found = true; }
        }

        if (!found) masked = `_____ ${word.example_de}`;

        const allWords = await dbService.getAllWords();
        // Подсказки той же части речи — случайные слова не создавали выбора
        const distractors = quiz.pickDistractors(word, allWords, 2).map(w => w.word);
        const hints = quiz.shuffle([...distractors, targetMatch]);

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">${t('exercises.fillBlank')}</h3>
                <p class="text-slate-400 text-xs mb-4">${t('exercises.translationLabel')}: ${word.example_ru || word.translation}</p>
                <h2 class="text-2xl font-black text-slate-100 mb-8 leading-relaxed">${masked}</h2>
                
                <div class="flex flex-wrap justify-center gap-2 mb-6">
                    ${hints.map(h => `<span class="bg-slate-800 text-slate-400 px-3 py-1 rounded-lg text-sm border border-slate-700 select-none">${h}</span>`).join('')}
                </div>

                <div class="mb-6">
                    <input type="text" id="ex-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold shadow-inner transition-colors" placeholder="${t('exercises.wordPlaceholder')}">
                </div>
                <button data-action="exercises.checkInput" data-correct="${actions.attr(targetMatch)}" data-mode="fill_blanks" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">${t('exercises.check')}</button>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
            </div>
        `;
    },

    /**
     * Существительные для примера со склонением.
     *
     * Прилагательное само рода не имеет — его задаёт существительное рядом.
     * Берём короткие и заведомо знакомые слова: задание про окончание,
     * а не про перевод соседа.
     */
    DECLENSION_NOUNS: {
        m: 'Mann', f: 'Frau', n: 'Kind', pl: 'Leute'
    },

    /**
     * Окончание прилагательного (§6 ТЗ).
     *
     * Единственное задание, которое собирается по правилу, без ИИ и без
     * словаря: окончание зависит от артикля, рода и падежа, и всё это
     * известно на месте.
     */
    renderAdjectiveEnding: (word) => {
        if (word.type !== 'adjective' || !word.word) return null;
        if (declension.isIndeclinable(word.word)) return null;

        const type = quiz.shuffle([...declension.TYPES])[0];
        const gender = quiz.shuffle([...declension.GENDERS])[0];
        const kase = quiz.shuffle([...declension.CASES])[0];

        const correct = declension.form(word.word, type, gender, kase);
        const article = declension.article(type, gender, kase);
        const noun = declension.nounForm(exercises.DECLENSION_NOUNS[gender], gender, kase);

        // Неверные варианты — формы того же слова в других клетках таблицы:
        // выбор между «hellen» и «Tisch» не проверяет ничего
        const все = new Set();
        for (const t2 of declension.TYPES) {
            for (const g of declension.GENDERS) {
                for (const k of declension.CASES) {
                    все.add(declension.form(word.word, t2, g, k));
                }
            }
        }
        все.delete(correct);

        const options = quiz.shuffle([correct, ...quiz.shuffle([...все]).slice(0, 3)]);
        if (options.length < 2) return null;

        const фраза = `${article ? article + ' ' : ''}____ ${noun}`;

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6">
                <h3 class="text-sm font-bold text-slate-400 mb-2 text-center">${t('declension.exercise')}</h3>
                <p class="text-[11px] text-slate-500 text-center mb-4">${t('declension.' + kase)} · ${t('declension.' + type)}</p>

                <div class="text-center mb-2">
                    <span class="text-2xl font-bold text-slate-100">${exercises.escAttr(фраза)}</span>
                </div>
                <p class="text-center text-amber-500 text-sm mb-6">${exercises.escAttr(word.word)} — ${exercises.escAttr(word.translation || '')}</p>

                <div class="grid grid-cols-2 gap-2" id="ex-buttons">
                    ${options.map(opt => `
                        <button data-action="exercises.checkChoice" data-value="${actions.attr(opt)}" data-correct="${actions.attr(correct)}" data-mode="adjective_ending"
                            class="py-4 bg-slate-900 border-2 border-slate-700 hover:border-amber-500 text-slate-100 font-bold rounded-xl text-lg active:scale-95 transition-all">${exercises.escAttr(opt)}</button>
                    `).join('')}
                </div>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
            </div>
        `;
    },

    renderRektionQuiz: (word) => {
        // Раньше «предлогом» считалось первое слово до знака «+»,
        // поэтому для «helfen + Dativ» правильным ответом становился
        // сам глагол. Теперь строка разбирается по-настоящему.
        const { preposition, kase } = germanUtils.parseRektion(word.rektion);
        if (!preposition && !kase) return null;

        // У глаголов с предлогом спрашиваем предлог, у остальных — падеж.
        // Падеж и есть суть управления, раньше его не спрашивали вовсе.
        const askPreposition = !!preposition;
        const correct = askPreposition ? preposition : kase;
        const pool = askPreposition
            ? germanUtils.PREPOSITIONS
            : ['Akkusativ', 'Dativ', 'Genitiv'];

        const options = quiz.shuffle([
            correct,
            ...quiz.shuffle(pool.filter(p => p !== correct)).slice(0, askPreposition ? 3 : 2)
        ]);

        const hint = askPreposition && kase
            ? `<p class="text-[11px] text-slate-500 mt-4">${t('exercises.rektionCaseHint', { kase })}</p>`
            : '';

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">${askPreposition ? t('exercises.rektionQuestion') : t('exercises.rektionCaseQuestion')}</h3>
                <h2 class="text-4xl font-black text-slate-100 mb-2">${word.word}</h2>
                <p class="text-slate-500 mb-8 font-bold">${word.translation}</p>

                <div class="grid grid-cols-2 gap-3" id="ex-buttons">
                    ${options.map(opt => `
                        <button data-action="exercises.checkChoice" data-value="${actions.attr(opt)}" data-correct="${actions.attr(correct)}" data-mode="rektion" class="py-4 bg-slate-900 border-2 border-slate-700 hover:border-amber-500 text-amber-500 font-bold rounded-xl text-lg uppercase tracking-wider active:scale-95 transition-all">${opt}</button>
                    `).join('')}
                </div>
                ${hint}
            </div>
        `;
    },

    renderListeningQuiz: (word) => {
        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">${t('exercises.listening')}</h3>
                
                <button data-action="training.playAudio" data-word="${actions.attr(word.word)}" class="w-20 h-20 mx-auto bg-amber-500 text-slate-900 rounded-full flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(245,158,11,0.4)] mb-8 active:scale-95 transition-transform" id="training-audio-btn">
                    <i class="fa-solid fa-headphones"></i>
                </button>

                <div class="mb-6 text-left">
                    <label class="block text-xs font-bold text-amber-500 mb-2">${t('exercises.writeWhatYouHear')}</label>
                    <input type="text" id="ex-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold shadow-inner transition-colors" autocomplete="off">
                </div>
                <button data-action="exercises.checkInput" data-correct="${actions.attr(word.word)}" data-mode="listening" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">${t('exercises.check')}</button>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
                
            </div>
        `;
    },

    renderSentenceBuilder: (word) => {
        const cleanSentence = word.example_de.replace(/[.,!?]/g, '');
        const words = cleanSentence.split(' ').filter(w => w.length > 0);
        
        exercises.builderState.correct = [...words];
        exercises.builderState.words = quiz.shuffle(words);
        exercises.builderState.selected = [];
        exercises.builderState.answered = false;
        exercises.builderState.attempts = 0;
        exercises.builderState.firstWrong = null;

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6">
                <h3 class="text-sm font-bold text-slate-400 mb-6 text-center">${t('exercises.buildSentence')}</h3>
                <p class="text-slate-400 text-sm mb-4 text-center border-b border-slate-700 pb-4">${word.example_ru || word.translation}</p>
                
                <div id="sb-target" class="min-h-[60px] bg-slate-900/50 rounded-xl border border-slate-600 p-3 mb-2 flex flex-wrap gap-2 content-start"></div>
                <p class="text-[11px] text-slate-500 text-center mb-5">${t('exercises.builderHint')}</p>

                <div id="sb-source" class="flex flex-wrap gap-2 justify-center mb-6">
                    ${exercises.builderState.words.map((w, i) => `
                        <button id="sb-word-${i}" onclick="exercises.builderAdd(${i})" class="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-200 rounded-lg shadow font-medium active:scale-95 transition-transform hover:bg-slate-700">${w}</button>
                    `).join('')}
                </div>
                
                <button onclick="exercises.skipBuilder()" class="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 font-bold rounded-xl active:scale-95 transition-all text-sm mb-2" id="sb-skip-btn">
                    ${t('exercises.tooHardSkip')}
                </button>
                
                <div id="ex-feedback" class="mt-2 hidden font-bold text-lg p-3 rounded-xl text-center transition-all"></div>
            </div>
        `;
    },

    /**
     * В selected хранятся индексы слов из набора, а не сами слова.
     * Так можно вернуть в набор именно ту кнопку, которую убрали, и
     * корректно обрабатывать предложения с повторяющимися словами
     * («der Mann und der Hund»).
     */
    builderAdd: (index) => {
        if (exercises.builderState.selected.includes(index)) return;

        exercises.builderState.selected.push(index);
        document.getElementById(`sb-word-${index}`)?.classList.add('hidden');
        exercises.updateBuilderUI();
    },

    /**
     * Убирает слово с любой позиции, а не только последнее.
     * Раньше клик по области собранного предложения удалял только
     * последнее слово, и ошибка в середине означала пересбор всей фразы.
     */
    builderRemoveAt: (position) => {
        const [index] = exercises.builderState.selected.splice(position, 1);
        if (index === undefined) return;

        document.getElementById(`sb-word-${index}`)?.classList.remove('hidden');

        // Ответ изменился — прежний отклик «Falsch» больше не актуален
        const feedback = document.getElementById('ex-feedback');
        if (feedback) feedback.classList.add('hidden');

        exercises.updateBuilderUI();
    },

    /** Собранное предложение словами. */
    builderSentence: () => exercises.builderState.selected
        .map(i => exercises.builderState.words[i])
        .join(' '),


    updateBuilderUI: () => {
        const target = document.getElementById('sb-target');

        // Каждое слово — отдельная кнопка: нажатие возвращает его в набор
        target.innerHTML = exercises.builderState.selected.map((index, position) => `
            <button onclick="exercises.builderRemoveAt(${position})"
                class="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded shadow font-bold active:scale-95 transition-transform">
                ${exercises.builderState.words[index]}
            </button>
        `).join('');

        if (exercises.builderState.selected.length === exercises.builderState.correct.length) {
            exercises.checkBuilder();
        }
    },

    /**
     * Проверка собранного предложения.
     *
     * Здесь, в отличие от остальных девяти заданий, ошибка не заканчивает
     * задание. И это не поблажка: в сборке предложения ошибиться можно
     * порядком одного слова, а увидеть верный порядок и тут же собрать
     * его самому — это и есть то, чему задание учит. Прежний вариант
     * показывал правильный ответ и уходил дальше, то есть отвечал за
     * человека.
     *
     * Поэтому пересобирать можно сколько угодно, а дальше задание уходит
     * только при верной сборке или по кнопке «Сложно, пропустить».
     *
     * Начисление устроено так, чтобы перебором ничего не выигрывалось:
     *
     *   опыт     — за верную сборку в любом случае, но убывающий: 4 за
     *              первую попытку, 2 за вторую, дальше 1;
     *   история  — верным ответом считается только сборка с первого
     *              раза. Иначе освоенность росла бы от перебора: слов в
     *              предложении немного, и порядок рано или поздно
     *              угадывается без всякого знания;
     *   пропуск  — как неверный ответ в любом другом задании, 1 очко.
     *              Отдельного штрафа нет: он бы толкал перебирать вместо
     *              того, чтобы честно признать, что не знаешь.
     */
    checkBuilder: () => {
        // Замок — только на завершённое задание. Пересборки его не
        // завершают, поэтому и не блокируются
        if (exercises.builderState.answered) return;

        const feedback = document.getElementById('ex-feedback');
        const isCorrect = exercises.builderSentence() === exercises.builderState.correct.join(' ');

        if (!isCorrect) return exercises._builderRetry(feedback);

        exercises.builderState.answered = true;

        const skipBtn = document.getElementById('sb-skip-btn');
        if (skipBtn) skipBtn.disabled = true;
        document.querySelectorAll('#sb-source button, #sb-target button').forEach(b => b.disabled = true);

        const попыток = exercises.builderState.attempts;

        // Собрал не с первого раза — в историю слова это идёт неверным
        // ответом, но объявляется и выглядит верным: человек ведь собрал
        exercises.awardXP(попыток === 0, {
            xp: exercises.builderXP(попыток),
            announceCorrect: true
        });

        // Первую неудачную сборку кладём в разбор ошибок: она показывает,
        // где именно человек путается в порядке слов
        if (попыток > 0 && exercises.builderState.firstWrong && dbService?.logMistake) {
            const currentWord = exercises.queue[exercises.currentIndex];
            dbService.logMistake(currentWord.id, 'sentence_builder', exercises.builderState.firstWrong);
        }

        feedback.classList.remove('hidden');
        feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-green-600 border border-green-400 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]";
        feedback.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Richtig!`
            + (попыток > 0
                ? `<span class="block text-white/70 text-xs font-normal mt-1.5">${t('exercises.builderFromTry', { n: попыток + 1, xp: exercises.builderXP(попыток) })}</span>`
                : '');

        setTimeout(exercises.next, exercises.BUILDER_NEXT_DELAY);
    },

    /**
     * Неверная сборка: считаем попытку и отдаём предложение обратно.
     *
     * Ничего не блокируем и ничего не начисляем — задание продолжается.
     * Верный порядок не показываем: подсказать его сейчас значит лишить
     * пересборку смысла, а для тех, кому правда не даётся, есть кнопка
     * «Сложно, пропустить».
     */
    _builderRetry: (feedback) => {
        exercises.builderState.attempts += 1;

        if (!exercises.builderState.firstWrong) {
            exercises.builderState.firstWrong = exercises.builderSentence();
        }

        if (!feedback) return;

        feedback.classList.remove('hidden');
        feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-red-600 border border-red-400 text-white";
        feedback.innerHTML = `
            <span class="block"><i class="fa-solid fa-xmark mr-2"></i> Falsch!</span>
            <span class="block text-white/80 text-xs font-normal mt-1.5">${t('exercises.builderRetry')}</span>
        `;

        announce.say(t('exercises.builderRetry'));
    },

    skipBuilder: () => {
        if (exercises.builderState.answered) return;
        exercises.builderState.answered = true;

        const feedback = document.getElementById('ex-feedback');
        const skipBtn = document.getElementById('sb-skip-btn');
        if (skipBtn) skipBtn.disabled = true;

        document.querySelectorAll('#sb-source button, #sb-target button').forEach(b => b.disabled = true);

        const correctSentence = exercises.builderState.correct.join(' ');

        // Пропуск — это неответ, и в истории слова он стоит наравне с
        // неверным ответом: слово вернётся раньше. Раньше пропуск не
        // записывался вовсе, и пропустить было выгоднее, чем ошибиться
        exercises.awardXP(false);

        const currentWord = exercises.queue[exercises.currentIndex];
        if (dbService?.logMistake) {
            dbService.logMistake(currentWord.id, 'sentence_builder',
                exercises.builderState.firstWrong || 'SKIPPED');
        }

        feedback.classList.remove('hidden');
        feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-slate-900/80 border border-slate-600/50 text-slate-300";
        feedback.innerHTML = `
            <span class="text-slate-400 text-xs font-normal block mb-1 uppercase tracking-widest">${t('exercises.correctAnswer')}</span>
            <b class="text-amber-500 text-base leading-snug block">${exercises.escAttr(correctSentence)}</b>
        `;

        setTimeout(exercises.next, exercises.BUILDER_NEXT_DELAY);
    },

    /**
     * Ответ выбором из вариантов.
     *
     * Значения приходят из data-атрибутов нажатой кнопки: data-value —
     * что выбрали, data-correct — что верно, data-mode — тип задания.
     * Раньше они стояли прямо в onclick, а чтобы подсветить верный
     * вариант, атрибут разбирался обратно регулярным выражением
     * /checkChoice\(this,\s*'([^']+)'/ — оно останавливалось на первом
     * апострофе и на слове вроде «geht's» находило обрезок.
     */
    /**
     * Снимает с кнопки классы цвета, не трогая остальные.
     *
     * Было `replace(/(bg|border|text)-\S+/g, ' ')`, и это выносило
     * заодно `text-left` и `text-xl`: после ответа текст терял и
     * выравнивание, и размер. Под цвет попадают только классы вида
     * «свойство-цвет-оттенок», где оттенок — число.
     */
    _stripColours: (el) => {
        [...el.classList].forEach(cls => {
            if (/^(bg|border|text)-[a-z]+-\d{2,3}$/.test(cls)) el.classList.remove(cls);
        });
        el.classList.remove('hover:border-amber-500');
    },

    /**
     * Строка ответа на кнопке: текст на месте, значок справа.
     *
     * Значок стоял слева, а строка равнялась по центру — и в момент
     * ответа весь текст прыгал с левого края на середину. Ответ и так
     * заметен цветом; двигать ради него текст незачем.
     */
    _answerRow: (text, icon = null, textClass = '') => `
        <span class="flex items-center justify-between gap-3 w-full">
            <span class="${textClass}">${text}</span>
            ${icon ? `<i class="fa-solid ${icon} text-xl shrink-0"></i>` : ''}
        </span>`,

    checkChoice: (btn) => {
        const selected = btn.dataset.value ?? '';
        const correct = btn.dataset.correct ?? '';
        const exType = btn.dataset.mode || 'choice';

        const btns = document.getElementById('ex-buttons').children;
        for (let b of btns) {
            b.disabled = true;

            const btnValue = b.dataset.value ?? null;
            const originalText = b.innerText.trim();
            exercises._stripColours(b);

            if (btnValue === correct) {
                // Без scale-105: увеличение раздвигает кнопку от середины,
                // и текст на левом краю уезжает ещё на несколько точек.
                // Зелёный фон со свечением и так виден, а читать ответ
                // удобнее с неподвижного места
                b.classList.add('bg-green-600', 'border-green-400', 'text-white', 'shadow-[0_0_15px_rgba(22,163,74,0.5)]', 'z-10');
                b.innerHTML = exercises._answerRow(originalText, 'fa-check');
            } else if (btnValue === selected && selected !== correct) {
                // ЛОГИРОВАНИЕ ОШИБКИ
                const currentWord = exercises.queue[exercises.currentIndex];
                if (typeof dbService !== 'undefined' && dbService.logMistake) {
                    dbService.logMistake(currentWord.id, exType, selected);
                }

                b.classList.add('bg-red-600', 'border-red-400', 'text-white');
                b.innerHTML = exercises._answerRow(originalText, 'fa-xmark', 'line-through opacity-80');
            } else {
                b.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-500', 'opacity-40', 'scale-95');
                b.innerHTML = exercises._answerRow(originalText);
            }
        }

        exercises.awardXP(selected === correct);

        if (selected === correct) {
            setTimeout(exercises.next, 1200);
        } else {
            setTimeout(exercises.next, 2500);
        }
    },

    /**
     * Слова, чьё расписание двигает ответ в упражнении.
     *
     * Заполняет урок перед шагом упражнений: туда попадают те слова, для
     * которых упражнение — единственное извлечение за урок. Новые слова
     * сюда не входят, их уже оценили карточкой.
     */
    schedulingIds: null,

    /**
     * Двигать ли расписание слова по ответу в упражнении.
     *
     * Прежде расписание умела двигать только самооценка на карточке —
     * «Снова / Трудно / Хорошо / Легко». Это перевёрнуто: самооценка
     * ненадёжна, человек систематически переоценивает своё знание, когда
     * ответ только что был перед глазами. Ответ в упражнении объективен
     * и предсказывает лучше — а не влиял ни на что.
     *
     * Свободная тренировка и экзамен расписание не трогают: там слово
     * спрашивают вне очереди, и сдвигать от этого сроки нельзя.
     */
    _movesSchedule: (word) => !exercises.exam
        && !exercises.isRoomMode
        && !!exercises.schedulingIds?.has(word?.id),

    /**
     * Начисление опыта за задание.
     *
     * Раньше XP давали только карточки и экзамен — половина урока
     * (все девять типов упражнений) не вознаграждалась вовсе.
     *
     * @param {boolean} isCorrect засчитать ответ верным в истории слова
     * @param {object} [options]
     * @param {number} [options.xp] начислить столько вместо обычного
     * @param {boolean} [options.announceCorrect] что сказать чтецу, если
     *        это расходится с записью в историю. Расходятся они в одном
     *        месте: собранное не с первого раза предложение объявляется
     *        верным, а в историю идёт неверным — см. checkBuilder
     */
    awardXP: async (isCorrect, { xp = null, announceCorrect = isCorrect } = {}) => {
        const word = exercises.queue?.[exercises.currentIndex];

        /*
         * Результат ответа — вслух.
         *
         * Через эту точку проходят все десять типов заданий, поэтому
         * объявление стоит здесь, а не в каждом отклике. Зелёная рамка
         * ничего не сообщает тому, кто её не видит, а задание уходит
         * дальше через полторы секунды.
         */
        announce.say(announceCorrect
            ? t('exercises.announceCorrect')
            : t('exercises.announceWrong', { answer: word?.word ?? '' }));

        const gained = xp ?? (isCorrect ? exercises.XP_CORRECT : exercises.XP_WRONG);

        // За экзамен опыт начисляется по итогу, а не по каждому ответу
        if (exercises.exam) {
            try {
                exercises.exam.onAnswer(word, isCorrect, exercises._currentMode);
            } catch (e) {
                console.error('Экзамен не смог учесть ответ:', e);
            }
        } else {
            try {
                await dbService.addXP(gained);
            } catch (e) {
                console.error('Не удалось начислить XP:', e);
            }
        }

        // Ответы в упражнениях — самый частый сигнал о том, знает человек
        // слово или нет, но раньше они не влияли ни на что, кроме XP
        if (word?.id) {
            try {
                // Состояние читаем из базы, а не из очереди: на экзамене одно
                // слово спрашивают дважды разными заданиями, и обе копии в
                // очереди помнят историю на момент её сборки. Второй ответ
                // затирал бы первый вместо того, чтобы к нему прибавиться
                const stored = (await dbService.getWordById(word.id)) || word;
                masteryUtils.registerAnswer(stored, isCorrect);

                const поля = {
                    recent: stored.recent,
                    attempts: stored.attempts,
                    correct: stored.correct,
                    mastery: stored.mastery,

                    // Чтобы в следующий раз спросить иначе — см. pickByStage
                    lastMode: exercises._currentMode || stored.lastMode || null
                };

                if (exercises._movesSchedule(word)) {
                    srs.applyTo(stored, isCorrect ? 3 : 1);
                    Object.assign(поля, {
                        interval: stored.interval,
                        ease: stored.ease,
                        phase: stored.phase,
                        stepIndex: stored.stepIndex,
                        nextReview: stored.nextReview,
                        repetitions: stored.repetitions,
                        status: stored.status
                    });
                }

                await dbService.updateWord(word.id, поля);
                Object.assign(word, поля);
            } catch (e) {
                console.error('Не удалось сохранить результат ответа:', e);
            }
        }

        // В свободной тренировке и на экзамене счётчиков урока нет
        if (!exercises.exam && !exercises.isRoomMode && typeof training !== 'undefined' && training.state?.data) {
            training.state.data.xpEarned = (training.state.data.xpEarned || 0) + gained;
        }
    },

    /**
     * Ответ вводом. Правильный ответ приходит в data-correct кнопки:
     * в onclick он ломался на апострофе — «Wie geht's» и подобных.
     */
    checkInput: (btn) => {
        const correct = btn.dataset.correct ?? '';
        const exType = btn.dataset.mode || 'input';

        const input = document.getElementById('ex-input');
        const feedback = document.getElementById('ex-feedback');

        const selected = input.value.trim();

        // У некоторых форм допустимо несколько написаний («hat gemacht»
        // и «haben gemacht»), поэтому сверяемся со списком, а не со строкой
        const accepted = exercises.acceptedAnswers?.length ? exercises.acceptedAnswers : [correct];
        const isCorrect = germanUtils.matchesAnswer(selected, accepted);
        exercises.acceptedAnswers = null;

        input.disabled = true;
        btn.disabled = true;
        feedback.classList.remove('hidden');

        exercises.awardXP(isCorrect);

        if (isCorrect) {
            input.classList.remove('bg-slate-900', 'border-slate-600');
            input.classList.add('bg-green-900/40', 'border-green-500', 'text-green-400');
            
            feedback.className = "mt-4 font-bold text-lg p-3 rounded-xl bg-green-600 border border-green-400 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]";
            feedback.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Richtig!`;
            setTimeout(exercises.next, 1500);
        } else {
            // ЛОГИРОВАНИЕ ОШИБКИ
            const currentWord = exercises.queue[exercises.currentIndex];
            if (typeof dbService !== 'undefined' && dbService.logMistake) {
                dbService.logMistake(currentWord.id, exType, selected);
            }

            input.classList.remove('bg-slate-900', 'border-slate-600');
            input.classList.add('bg-red-900/40', 'border-red-500', 'text-red-400', 'line-through');
            
            feedback.className = "mt-4 font-bold text-lg p-3 rounded-xl bg-red-600 border border-red-400 text-white";
            feedback.innerHTML = `
                <div class="flex items-center justify-center mb-1"><i class="fa-solid fa-xmark mr-2"></i> Falsch!</div>
                <div class="text-red-100 text-sm font-normal pt-2 border-t border-red-400/50">
                    ${t('exercises.correctIs')}: <b class="text-white text-base tracking-wide">${correct}</b>
                </div>`;
            setTimeout(exercises.next, 3000);
        }
    },

    next: async () => {
        exercises.currentIndex++;
        
        if (!exercises.isRoomMode && typeof training !== 'undefined' && training.state && training.state.data) {
            await lessonStateManager.updateState('practice', exercises.currentIndex, training.state.data);
        }

        if (exercises.currentIndex < exercises.queue.length) {
            exercises.renderCurrent();
        } else {
            exercises.onFinish();
        }
    }
};