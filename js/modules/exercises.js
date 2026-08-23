import { quiz } from '../core/quiz.js';
import { masteryUtils } from '../core/mastery.js';
import { germanUtils } from '../core/german.js';
import { t, plural } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { lessonStateManager } from '../core/lessonState.js';
import { training } from './training.js';

export const exercises = {

    /** Опыт за задание: верно и неверно (за попытку тоже что-то даём). */
    XP_CORRECT: 4,
    XP_WRONG: 1,

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
        // Узнать среди вариантов
        recognition: ['translation_de_ru', 'match_pairs', 'article'],

        // Выбор потруднее плюс первые задания с вводом
        consolidation: ['translation_ru_de', 'article', 'rektion', 'verb_form', 'fill_blanks'],

        // Написать самому
        production: ['translation_ru_de_input', 'verb_form', 'fill_blanks', 'listening', 'sentence_builder']
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

        const pool = preferred.length ? preferred : validModes;
        return quiz.shuffle(pool)[0];
    },

    queue: [],
    currentIndex: 0,
    onFinish: null,
    isRoomMode: false,
    allowedModes: null,
    
    builderState: {
        words: [],
        selected: [],
        correct: []
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
        const main = document.getElementById('main-content');
        const word = exercises.queue[exercises.currentIndex];
        const progress = (exercises.currentIndex / exercises.queue.length) * 100;

        let title = exercises.isRoomMode ? t('exercises.freeTraining') : t('exercises.practice');

        // Шапка с прогрессом закреплена, само задание прокручивается:
        // у длинных заданий вроде сборки предложения содержимое не помещается
        let html = `
            <div class="max-w-lg mx-auto h-full flex flex-col pt-2 fade-in">
                <div class="flex items-center justify-between mb-2 shrink-0">
                    <span class="text-[10px] font-bold text-purple-400 uppercase tracking-wider bg-purple-400/10 px-2 py-1 rounded border border-purple-400/20 shadow-sm">${title}</span>
                    <span class="text-xs font-bold text-slate-500">${t('exercises.taskOf', { current: exercises.currentIndex + 1, total: exercises.queue.length })}</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-2 mb-4 border border-slate-700 overflow-hidden shrink-0 mt-1">
                    <div class="bg-purple-500 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
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
        if ((!hasRequested || requested.includes('listening')) && word.word) validModes.push('listening');
        if ((!hasRequested || requested.includes('translation_ru_de_input')) && word.word) validModes.push('translation_ru_de_input');

        if (validModes.length === 0) validModes.push('translation_de_ru');

        // В Комнате режим выбран пользователем — этап не навязываем
        const exType = hasRequested
            ? quiz.shuffle(validModes)[0]
            : exercises.pickByStage(word, validModes);

        let block = null;
        if (exType === 'translation_ru_de_input') block = exercises.renderProductionQuiz(word);
        else if (exType === 'article') block = exercises.renderArticleQuiz(word);
        else if (exType === 'verb_form') block = exercises.renderVerbQuiz(word);
        else if (exType === 'fill_blanks') block = await exercises.renderFillBlanksQuiz(word);
        else if (exType === 'sentence_builder') block = exercises.renderSentenceBuilder(word);
        else if (exType === 'listening') block = exercises.renderListeningQuiz(word);
        else if (exType === 'rektion') block = exercises.renderRektionQuiz(word);
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
            return `<button onclick="exercises.checkChoice(this, '${opt.id}', '${word.id}', '${direction}')" class="w-full py-4 bg-slate-900 border-2 border-slate-700 text-slate-300 font-bold rounded-xl text-left px-5 hover:border-amber-500 active:scale-95 transition-all ${btnClass}">${answerText}</button>`;
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

                <button onclick="exercises.checkInput('${full.replace(/'/g, "\\'")}', 'translation_ru_de_input')"
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
                    <button onclick="exercises.checkChoice(this, 'der', '${article}', 'article')" class="py-4 bg-blue-900/30 border-2 border-blue-900/50 text-blue-400 font-bold rounded-xl text-xl hover:bg-blue-900/50 active:scale-95 transition-all">DER</button>
                    <button onclick="exercises.checkChoice(this, 'die', '${article}', 'article')" class="py-4 bg-red-900/30 border-2 border-red-900/50 text-red-400 font-bold rounded-xl text-xl hover:bg-red-900/50 active:scale-95 transition-all">DIE</button>
                    <button onclick="exercises.checkChoice(this, 'das', '${article}', 'article')" class="py-4 bg-green-900/30 border-2 border-green-900/50 text-green-400 font-bold rounded-xl text-xl hover:bg-green-900/50 active:scale-95 transition-all">DAS</button>
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
                <button onclick="exercises.checkInput('${targetForm.replace(/'/g, "\\'")}', 'verb_form')" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">${t('exercises.check')}</button>
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
                <button onclick="exercises.checkInput('${targetMatch.replace(/'/g, "\\'")}', 'fill_blanks')" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">${t('exercises.check')}</button>
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
                        <button onclick="exercises.checkChoice(this, '${opt}', '${correct}', 'rektion')" class="py-4 bg-slate-900 border-2 border-slate-700 hover:border-amber-500 text-amber-500 font-bold rounded-xl text-lg uppercase tracking-wider active:scale-95 transition-all">${opt}</button>
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
                
                <button onclick="training.playAudio('${word.word.replace(/'/g, "\\'")}')" class="w-20 h-20 mx-auto bg-amber-500 text-slate-900 rounded-full flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(245,158,11,0.4)] mb-8 active:scale-95 transition-transform" id="training-audio-btn">
                    <i class="fa-solid fa-headphones"></i>
                </button>

                <div class="mb-6 text-left">
                    <label class="block text-xs font-bold text-amber-500 mb-2">${t('exercises.writeWhatYouHear')}</label>
                    <input type="text" id="ex-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold shadow-inner transition-colors" autocomplete="off">
                </div>
                <button onclick="exercises.checkInput('${word.word.replace(/'/g, "\\'")}', 'listening')" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">${t('exercises.check')}</button>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
                
                <script>setTimeout(() => training.playAudio('${word.word.replace(/'/g, "\\'")}'), 300);</script>
            </div>
        `;
    },

    renderSentenceBuilder: (word) => {
        const cleanSentence = word.example_de.replace(/[.,!?]/g, '');
        const words = cleanSentence.split(' ').filter(w => w.length > 0);
        
        exercises.builderState.correct = [...words];
        exercises.builderState.words = quiz.shuffle(words);
        exercises.builderState.selected = [];

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

    checkBuilder: () => {
        const feedback = document.getElementById('ex-feedback');
        const skipBtn = document.getElementById('sb-skip-btn');
        if (skipBtn) skipBtn.disabled = true;

        const isCorrect = exercises.builderSentence() === exercises.builderState.correct.join(' ');

        exercises.awardXP(isCorrect);
        feedback.classList.remove('hidden');
        if (isCorrect) {
            feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-green-600 border border-green-400 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]";
            feedback.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Richtig!`;
            setTimeout(exercises.next, 1500);
        } else {
            // ЛОГИРОВАНИЕ ОШИБКИ
            const currentWord = exercises.queue[exercises.currentIndex];
            if (typeof dbService !== 'undefined' && dbService.logMistake) {
                dbService.logMistake(currentWord.id, 'sentence_builder', exercises.builderSentence());
            }

            feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-red-600 border border-red-400 text-white";
            feedback.innerHTML = `<i class="fa-solid fa-xmark mr-2"></i> Falsch! ${t('exercises.tapToRemove')}`;
            if (skipBtn) skipBtn.disabled = false; 
        }
    },

    skipBuilder: () => {
        const feedback = document.getElementById('ex-feedback');
        const skipBtn = document.getElementById('sb-skip-btn');
        if (skipBtn) skipBtn.disabled = true;
        
        const wordBtns = document.querySelectorAll('#sb-source button');
        wordBtns.forEach(b => b.disabled = true);
        
        const correctSentence = exercises.builderState.correct.join(' ');
        
        // ЛОГИРОВАНИЕ ОШИБКИ (ПРОПУСК = ОШИБКА)
        const currentWord = exercises.queue[exercises.currentIndex];
        if (typeof dbService !== 'undefined' && dbService.logMistake) {
            dbService.logMistake(currentWord.id, 'sentence_builder', 'SKIPPED');
        }

        feedback.classList.remove('hidden');
        feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-slate-900/80 border border-slate-600/50 text-slate-300";
        feedback.innerHTML = `
            <span class="text-slate-400 text-xs font-normal block mb-1 uppercase tracking-widest">${t('exercises.correctAnswer')}</span>
            <b class="text-amber-500 text-base leading-snug block">${correctSentence}</b>
        `;
        
        setTimeout(exercises.next, 3000);
    },

    checkChoice: (btn, selected, correct, exType = 'choice') => {
        const btns = document.getElementById('ex-buttons').children;
        for (let b of btns) {
            b.disabled = true;
            
            const onclickStr = b.getAttribute('onclick') || '';
            const match = onclickStr.match(/checkChoice\(this,\s*'([^']+)'/);
            const btnValue = match ? match[1] : null;

            const originalText = b.innerText.trim();
            b.className = b.className.replace(/(bg|border|text)-\S+/g, ' ').replace('hover:border-amber-500', '').trim();

            if (btnValue === correct) {
                b.classList.add('bg-green-600', 'border-green-400', 'text-white', 'shadow-[0_0_15px_rgba(22,163,74,0.5)]', 'scale-105', 'z-10');
                b.innerHTML = `<span class="flex items-center justify-center gap-2 w-full"><i class="fa-solid fa-check text-xl"></i> <span>${originalText}</span></span>`;
            } else if (btnValue === selected && selected !== correct) {
                // ЛОГИРОВАНИЕ ОШИБКИ
                const currentWord = exercises.queue[exercises.currentIndex];
                if (typeof dbService !== 'undefined' && dbService.logMistake) {
                    dbService.logMistake(currentWord.id, exType, selected);
                }

                b.classList.add('bg-red-600', 'border-red-400', 'text-white');
                b.innerHTML = `<span class="flex items-center justify-center gap-2 w-full"><i class="fa-solid fa-xmark text-xl"></i> <span class="line-through opacity-80">${originalText}</span></span>`;
            } else {
                b.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-500', 'opacity-40', 'scale-95');
                b.innerHTML = `<span class="flex items-center justify-center w-full">${originalText}</span>`;
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
     * Начисление опыта за задание.
     *
     * Раньше XP давали только карточки и экзамен — половина урока
     * (все девять типов упражнений) не вознаграждалась вовсе.
     */
    awardXP: async (isCorrect) => {
        const gained = isCorrect ? exercises.XP_CORRECT : exercises.XP_WRONG;

        try {
            await dbService.addXP(gained);
        } catch (e) {
            console.error('Не удалось начислить XP:', e);
        }

        // Ответы в упражнениях — самый частый сигнал о том, знает человек
        // слово или нет, но раньше они не влияли ни на что, кроме XP
        const word = exercises.queue?.[exercises.currentIndex];
        if (word?.id) {
            masteryUtils.registerAnswer(word, isCorrect);
            try {
                await dbService.updateWord(word.id, {
                    recent: word.recent,
                    attempts: word.attempts,
                    correct: word.correct,
                    mastery: word.mastery
                });
            } catch (e) {
                console.error('Не удалось сохранить результат ответа:', e);
            }
        }

        // В свободной тренировке счётчиков урока нет
        if (!exercises.isRoomMode && typeof training !== 'undefined' && training.state?.data) {
            training.state.data.xpEarned = (training.state.data.xpEarned || 0) + gained;
        }
    },

    checkInput: (correct, exType = 'input') => {
        const input = document.getElementById('ex-input');
        const feedback = document.getElementById('ex-feedback');
        const btn = document.getElementById('ex-submit');
        
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