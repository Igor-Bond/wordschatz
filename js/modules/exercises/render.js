/**
 * Отрисовка заданий.
 *
 * Десять видов, и у каждого своя разметка: выбор перевода, поиск пары,
 * артикль, форма глагола, пропущенное слово, окончание прилагательного,
 * управление, аудирование. Сборка предложения и слова живёт отдельно,
 * в builder.js: у неё, в отличие от остальных, есть своё состояние.
 *
 * Общее у всех одно: функция возвращает строку разметки и ничего не
 * вставляет в страницу сама. Вставляет renderCurrent из stages.js —
 * поэтому задание можно и показать, и проверить в отрыве от экрана.
 */

import { exercises } from './shared.js';
import { actions } from '../../core/actions.js';
import { quiz } from '../../core/quiz.js';
import { declension } from '../../core/declension.js';
import { germanUtils } from '../../core/german.js';
import { t } from '../../i18n/i18n.js';
import { dbService } from '../../services/db.js';
import { training } from '../training.js';

export const render = {
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
                <h3 id="ex-prompt" class="text-sm font-bold text-slate-400 mb-6">${t('exercises.writeInGerman')}</h3>
                <h2 class="text-3xl font-black text-amber-500 mb-8">${word.translation}</h2>

                <!-- Подпись берём из видимого вопроса над полем: дублировать её
                     в aria-label значило бы завести второй текст, который
                     разойдётся с первым при первой же правке -->
                <input type="text" id="ex-input" aria-labelledby="ex-prompt" autocomplete="off" autocapitalize="off" spellcheck="false"
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
                    <label for="ex-input" class="block text-xs font-bold text-amber-500 mb-2">${label}</label>
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

        /*
         * Подсказки без артиклей — иначе ответ виден, не читая.
         *
         * Подсказки той же части речи заводились, чтобы был выбор:
         * случайные слова его не создавали. Но брались они как есть,
         * вместе с артиклем — «die Tür», «der Tisch», — а пропущенное
         * слово подставляется в предложение без него. Из трёх плашек
         * одна всегда оказывалась без «der/die/das», и она же была
         * ответом. Выбирать можно было вообще не зная немецкого.
         */
        const distractors = quiz.pickDistractors(word, allWords, 2)
            .map(w => germanUtils.stripArticle(w));

        const hints = quiz.shuffle([...distractors, targetMatch]);

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 id="ex-prompt" class="text-sm font-bold text-slate-400 mb-6">${t('exercises.fillBlank')}</h3>
                <p class="text-slate-400 text-xs mb-4">${t('exercises.translationLabel')}: ${word.example_ru || word.translation}</p>
                <h2 class="text-2xl font-black text-slate-100 mb-8 leading-relaxed">${masked}</h2>
                
                <div class="flex flex-wrap justify-center gap-2 mb-6">
                    ${hints.map(h => `<span class="bg-slate-800 text-slate-400 px-3 py-1 rounded-lg text-sm border border-slate-700 select-none">${h}</span>`).join('')}
                </div>

                <div class="mb-6">
                    <input type="text" id="ex-input" aria-labelledby="ex-prompt" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold shadow-inner transition-colors" placeholder="${t('exercises.wordPlaceholder')}">
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
                    <label for="ex-input" class="block text-xs font-bold text-amber-500 mb-2">${t('exercises.writeWhatYouHear')}</label>
                    <input type="text" id="ex-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold shadow-inner transition-colors" autocomplete="off">
                </div>
                <button data-action="exercises.checkInput" data-correct="${actions.attr(word.word)}" data-mode="listening" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">${t('exercises.check')}</button>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
                
            </div>
        `;
    },
};
