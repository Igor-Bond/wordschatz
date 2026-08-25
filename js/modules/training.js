import { actions } from '../core/actions.js';
import { t, plural } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { auth } from '../services/auth.js';
import { sync } from '../services/sync.js';
import { germanUtils } from '../core/german.js';
import { declension } from '../core/declension.js';
import { frequency } from '../core/frequency.js';
import { speech } from '../core/speech.js';
import { dialog } from '../core/dialog.js';
import { masteryUtils } from '../core/mastery.js';
import { srs } from '../core/srs.js';
import { lessonStateManager } from '../core/lessonState.js';
import { scheduler } from '../core/scheduler.js';
import { exercises } from './exercises.js';

export const training = {
    state: null,
    queue: [],
    currentIndex: 0,
    currentWord: null,

    render: async () => {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500"></div></div>`;

        training.state = await lessonStateManager.getCurrentState();
        const plan = await scheduler.getDailyPlan();

        // Частотный список нужен карточке. Грузим здесь, а не при старте
        // приложения: 124 КБ незачем разбирать тому, кто зашёл посмотреть
        // статистику
        frequency.load().catch(e => console.error('[Частотность] Не загрузилась:', e));

        // Если урок числится завершенным, но в плане появились слова (добавили новые) - сбрасываем статус
        if (training.state.status === 'completed' && (plan.review.length > 0 || plan.newWords.length > 0)) {
            training.state.status = 'not_started';
            training.state.currentStep = 0;
            training.state.data = { xpEarned: 0, newWords: 0, reviewed: 0 };
            await lessonStateManager.updateState('not_started', 0, training.state.data);
        }

        if (training.state.status === 'completed') {
            training.showCompletedScreen();
            return;
        }

        if (training.state.status === 'not_started') {
            /*
             * Одно извлечение на слово за урок.
             *
             * Раньше каждое слово проходило урок дважды: сперва карточкой
             * с самооценкой, через несколько минут — упражнением. Второе
             * извлечение почти ничего не добавляло: прочность следа даёт
             * разнесённость во времени, а здесь между попытками были
             * минуты. Стоило это половины урока.
             *
             * Кто что получает:
             *
             *   трудное слово  — карточку. Ему полезно пересмотреть запись
             *                    целиком: перевод, пример, формы, звучание.
             *                    Заодно четыре кнопки оценки дают оттенок,
             *                    которого у двоичного ответа нет;
             *   остальные      — упражнение, и его результат сам двигает
             *                    расписание (см. awardXP);
             *   новое слово    — карточку и сразу упражнение. Тут это не
             *                    повтор: карточка показывает, упражнение
             *                    спрашивает в первый раз.
             *
             * Сначала карточку получали все слова этапа узнавания — я
             * решил, что упражнение для едва знакомого слова рановато.
             * Рассуждение было неверным: задания этапа узнавания ничего не
             * требуют писать, ответ там целиком на экране. Зато без
             * упражнений оставались двадцать самых новых слов в день —
             * ровно те, где разнообразие нужнее всего, и ровно те, ради
             * которых этап узнавания расширяли до шести типов заданий.
             */
            const поКарточке = plan.review.filter(w => masteryUtils.isWeak(w));
            const поЗаданию = plan.review.filter(w => !masteryUtils.isWeak(w));

            training.state.data.reviewQueue = поКарточке;
            training.state.data.newWordsQueue = plan.newWords;
            training.state.data.practiceQueue = [...поЗаданию, ...plan.newWords];

            /*
             * Чьё расписание двигает ответ в упражнении.
             *
             * Новые слова тоже — и это не двойной счёт. На карточке
             * кнопка «Хорошо» обещает показать слово снова через десять
             * минут, а «Трудно» — через двадцать. Обещание было пустым:
             * урок идёт одним проходом, второй раз за день слово не
             * появлялось, и на деле оно возвращалось назавтра.
             *
             * Упражнение по новому слову приходит как раз через несколько
             * минут после карточки — это и есть тот короткий шаг. Пусть
             * он им и засчитывается: тогда лестница заучивания работает
             * как задумана, а подпись на кнопке перестаёт врать.
             */
            training.state.data.scheduleByExercise =
                [...поЗаданию, ...plan.newWords].map(w => w.id);
            // Запоминаем день учебного цикла, чтобы отметить его выполненным в конце
            training.state.data.dayPlanId = plan.dayPlan ? plan.dayPlan.id : null;

            if (plan.review.length > 0) {
                await training.startStep('review', training.state.data.reviewQueue, 0);
            } else if (plan.newWords.length > 0) {
                await training.startStep('new_words', training.state.data.newWordsQueue, 0);
            } else if (training.state.data.practiceQueue.length > 0) {
                await training.startStep('practice', training.state.data.practiceQueue, 0);
            } else {
                training.showCompletedScreen();
            }
        } else if (training.state.status === 'review') {
            await training.startStep('review', training.state.data.reviewQueue, training.state.currentStep);
        } else if (training.state.status === 'new_words') {
            await training.startStep('new_words', training.state.data.newWordsQueue, training.state.currentStep);
        } else if (training.state.status === 'practice') {
            await training.startStep('practice', training.state.data.practiceQueue, training.state.currentStep);
        }
    },

    startStep: async (stepName, wordsList, startIndex = 0) => {
        await lessonStateManager.updateState(stepName, startIndex, training.state.data);
        training.state.status = stepName;
        training.state.currentStep = startIndex;
        
        training.queue = wordsList || [];
        training.currentIndex = startIndex;
        
        if (training.queue.length === 0 || training.currentIndex >= training.queue.length) {
            training.nextStep();
            return;
        }

        training.showCard();
    },

    /**
     * Завершение урока: закрываем состояние урока и отмечаем день учебного
     * цикла выполненным. Без второго шага цикл никогда бы не дошёл до контроля.
     */
    finishLesson: async () => {
        await lessonStateManager.completeLesson();

        const dayPlanId = training.state?.data?.dayPlanId;
        if (dayPlanId) await scheduler.completeDayPlan(dayPlanId);

        // Серия дней растёт по факту пройденного урока, а не от захода в приложение
        await scheduler.registerLessonCompleted();

        // Результаты урока — самое ценное, что стоит отдать в облако сразу
        if (auth.isSignedIn) sync.run({ silent: true }).catch(() => {});
    },

    nextStep: async () => {
        // ФИКС: Берем замороженные очереди из состояния, а не запрашиваем БД
        const data = training.state.data;
        const practiceWords = data.practiceQueue || [];
        
        if (training.state.status === 'review') {
            if (data.newWordsQueue && data.newWordsQueue.length > 0) {
                await training.startStep('new_words', data.newWordsQueue, 0);
            } else if (practiceWords.length > 0) {
                await training.startStep('practice', practiceWords, 0);
            } else {
                await training.finishLesson();
                training.showCompletedScreen();
            }
        } else if (training.state.status === 'new_words') {
            if (practiceWords.length > 0) {
                await training.startStep('practice', practiceWords, 0);
            } else {
                await training.finishLesson();
                training.showCompletedScreen();
            }
        } else if (training.state.status === 'practice') {
            // Когда практика пройдена - завершаем урок
            await training.finishLesson();
            training.showCompletedScreen();
        }
    },

    /**
     * Полная таблица склонения.
     *
     * Тридцать шесть клеток в карточку не влезают и на телефоне читаются
     * кашей, поэтому они живут в отдельном окне: три блока по типу артикля,
     * в каждом четыре рода на три падежа.
     */
    showDeclension: async () => {
        const word = training.currentWord;
        if (!word) return;

        const t2 = declension.table(word.word);
        const подписи = { m: t('declension.m'), f: t('declension.f'), n: t('declension.n'), pl: t('declension.pl') };

        const блок = (type) => `
            <div class="mb-3 last:mb-0">
                <div class="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">${t('declension.' + type)}</div>
                <div class="grid grid-cols-5 gap-x-1 gap-y-0.5 text-[11px]">
                    <span></span>
                    ${declension.GENDERS.map(g => `<span class="text-slate-500">${подписи[g]}</span>`).join('')}
                    ${declension.CASES.map(kase => `
                        <span class="text-slate-500">${t('declension.' + kase)}</span>
                        ${declension.GENDERS.map(g => `<span class="text-slate-200 font-bold truncate">${training.esc(t2[type][kase][g])}</span>`).join('')}
                    `).join('')}
                </div>
            </div>`;

        await dialog.custom(
            declension.TYPES.map(блок).join(''),
            { title: `${word.word} — ${t('declension.label')}` }
        );
    },

    /** Экранирование: слова приходят от ИИ и из Wiktionary. */
    esc: (str) => String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;'),

    /**
     * Метки под переводом: уровень, тема и признак сверки.
     *
     * Всё это уже лежало в базе и нигде не показывалось. Уровень отвечает
     * на вопрос «это базовое слово или продвинутое», тема напоминает, откуда
     * оно взялось, а галочка — что формы сверены со словарём, а не написаны
     * моделью на глаз.
     */
    renderTags: (word) => {
        const tags = [];

        if (word.level) {
            tags.push(`<span class="text-[10px] font-bold text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded border border-slate-600">${training.esc(word.level)}</span>`);
        }

        if (word.topic) {
            tags.push(`<span class="text-[10px] text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded border border-slate-700 max-w-[45%] truncate">${training.esc(word.topic)}</span>`);
        }

        if (word.verified === 1) {
            tags.push(`<span class="text-[10px] text-green-500/90" title="${training.esc(t('profile.verifiedBadge'))}"><i class="fa-solid fa-circle-check"></i></span>`);
        }

        // Насколько слово ходовое. Показываем только «ядро»: знать, что
        // перед тобой одно из первой тысячи, приятно и полезно, а метка
        // «редкое» на карточке, которую всё равно учишь, только злит
        if (frequency.ready && frequency.band(word.word) === 'core') {
            const место = frequency.rank(word.word);
            tags.push(`<span class="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/20"
                             title="${training.esc(t('frequency.rank', { rank: место }))}">${training.esc(t('frequency.core'))}</span>`);
        }

        return tags.length
            ? `<div class="flex items-center justify-center gap-1.5 flex-wrap mb-3">${tags.join('')}</div>`
            : '';
    },

    showCard: () => {
        const main = document.getElementById('main-content');
        
        // --- ИНТЕГРАЦИЯ УПРАЖНЕНИЙ (ЭТАП 2.2) ---
        if (training.state.status === 'practice') {
            // Слова, для которых упражнение — единственное извлечение за
            // урок: их расписание двигает именно оно
            exercises.schedulingIds = new Set(training.state.data.scheduleByExercise || []);

            exercises.start(training.queue, training.currentIndex, async () => {
                await training.finishLesson();
                training.state.status = 'completed';
                training.showCompletedScreen();
            });
            return;
        }

        // Занятие идёт — шапка приложения уступает место карточке
        document.body.classList.add('lesson-mode');

        training.currentWord = training.queue[training.currentIndex];
        const progress = ((training.currentIndex) / training.queue.length) * 100;
        const word = training.currentWord;

        let stepTitle = training.state.status === 'review' ? t('training.review') : t('training.newWords');
        let stepColor = training.state.status === 'review' ? 'blue-400' : 'green-400';

        /**
         * Строка таблицы. Раньше эта разметка была выписана вручную
         * четырнадцать раз, и любое поле забыть было проще, чем добавить.
         */
        const row = (label, value) => value
            ? `<div class="flex justify-between items-center py-2 border-b border-slate-700/50"><span class="text-slate-400 text-sm">${label}</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${value}</span></div>`
            : '';

        let tableRows = '';
        let conjugationBlock = '';

        if (word.type === 'noun') {
            tableRows += row('Plural', word.plural);
            tableRows += row('Dativ', word.dativ);
            // Akkusativ запрашивается у модели и хранится, но на карточке
            // не показывался — у слабых существительных это отдельная форма
            tableRows += row('Akkusativ', word.akkusativ);
        } else if (word.type === 'verb') {
            tableRows += row('Präteritum', word.preterite);

            // «hat genommen», а не «haben genommen»: именно эту форму
            // спрашивает упражнение, и так её подают словари
            const perfekt = germanUtils.perfektForm(word);
            if (perfekt) tableRows += row('Perfekt', perfekt.primary);

            tableRows += row('Konjunktiv II', word.konjunktiv2);

            // Повелительное наклонение двумя формами в одной строке:
            // «atme! / atmet!» — так его и подают учебники
            const imperative = [word.imperative_singular, word.imperative_plural]
                .filter(f => String(f ?? '').trim())
                .map(f => `${f}!`)
                .join(' / ');
            tableRows += row('Imperativ', imperative);

            tableRows += row('Rektion', word.rektion);

            // Präsens теперь приходит объектом из шести форм. Карточка читала
            // старое строковое поле present, поэтому у новых глаголов настоящее
            // время пропало с экрана вовсе — при том что данные есть
            const conjugation = germanUtils.getConjugation(word);
            if (conjugation) {
                // Местоимение и форма в одну строку: в две строки на ячейку
                // блок занимал 127 px из 354, отведённых карточке на телефоне
                const cells = germanUtils.PERSONS
                    .filter(p => conjugation[p])
                    .map(p => `
                        <div class="flex items-baseline gap-1.5 min-w-0">
                            <span class="text-[10px] text-slate-500 shrink-0">${germanUtils.PERSON_LABELS[p]}</span>
                            <span class="text-sm font-bold text-slate-100 break-words">${conjugation[p]}</span>
                        </div>`)
                    .join('');

                conjugationBlock = `
                    <div class="bg-[#1b2234] rounded-xl px-4 py-2.5 mb-4 border border-slate-700/70 shadow-inner">
                        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Präsens</div>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-1">${cells}</div>
                    </div>`;
            }
        } else if (word.type === 'adjective') {
            tableRows += row('Komparativ', word.comparative);
            tableRows += row('Superlativ', word.superlative);

            // Суть правила в одну строку: окончание задаётся артиклем.
            // Полная таблица — по нажатию, она не помещается в карточку
            const краткое = declension.summary(word.word)
                .map(f => `${f.article ? f.article + ' ' : ''}<b class="text-slate-100">${f.form}</b>`)
                .join(' · ');

            tableRows += `
                <div class="flex justify-between items-center py-2 border-b border-slate-700/50 gap-3">
                    <span class="text-slate-400 text-sm shrink-0">${t('declension.label')}</span>
                    <button onclick="training.showDeclension()" class="text-sm text-right text-slate-300 hover:text-amber-500 transition-colors">
                        ${краткое} <i class="fa-solid fa-table-cells text-[10px] ml-1 opacity-60"></i>
                    </button>
                </div>`;
        }

        tableRows += row(t('card.synonyms'), word.synonym);
        tableRows += row(t('card.antonyms'), word.gegenteil);

        const grammarBlock = (tableRows
            ? `<div class="bg-[#1b2234] rounded-xl px-4 py-1 mb-5 border border-slate-700/70 shadow-inner">${tableRows}</div>`
            : '') + conjugationBlock;

        main.innerHTML = `
            <!--
                Экран урока разбит на три части: шапка с прогрессом, прокручиваемая
                карточка и закреплённые внизу кнопки. Раньше всё было одним потоком,
                и у слова с полным набором полей содержимое занимало 948 px при
                видимых 746 — кнопки оценки уходили под экран, и до них
                приходилось долистывать.
            -->
            <div class="max-w-lg mx-auto h-full flex flex-col pt-2 fade-in">
                <div class="flex items-center justify-between mb-1.5 shrink-0">
                    <span class="text-[10px] font-bold text-${stepColor} uppercase tracking-wider bg-${stepColor}/10 px-2 py-1 rounded border border-${stepColor}/20 shadow-sm">${stepTitle}</span>
                    <span class="text-xs font-bold text-slate-500">${t('training.wordOf', { current: training.currentIndex + 1, total: training.queue.length })}</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-2 mb-3 border border-slate-700 overflow-hidden shrink-0">
                    <div class="bg-amber-500 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                </div>

                <!--
                    Карточка прокручивается внутри себя, и на телефоне это
                    читалось как обрезанный текст: содержимое просто упиралось
                    в кнопки. Поэтому под ней подсказка, что ниже есть ещё;
                    она исчезает, когда прокручивать больше некуда.

                    Затемнения внизу карточки нет намеренно: оно гасило
                    последние строки примера, и текст выглядел испорченным —
                    ровно та жалоба, ради которой подсказку и добавляли.
                -->
                <div class="flex-1 min-h-0 relative">
                    <div id="card-scroll" class="h-full overflow-y-auto hide-scrollbar pb-1">
                        <!-- overflow-hidden здесь нет намеренно: он ломает прилипание слова
                                 к верху при прокрутке. Скругление углов держат сами блоки -->
                            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative">
                            <div id="card-front" class="p-8 flex flex-col items-center justify-center text-center relative z-10 min-h-[200px] transition-all duration-200">
                                <span class="text-xs font-black text-slate-500 uppercase tracking-widest mb-4" id="card-type">${t("wordTypes." + (["noun","verb","adjective","phrase"].includes(word.type) ? word.type : "phrase"))}</span>
                                <div class="flex items-center justify-center gap-4 mb-2 w-full">
                                    <h2 lang="de" class="text-3xl font-black text-slate-100 break-words" id="card-word">${word.word}</h2>
                                    <button data-action="training.playAudio" data-word="${actions.attr(word.word)}" class="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-amber-500 transition-colors shrink-0 shadow-lg" id="training-audio-btn">
                                        <i class="fa-solid fa-volume-high text-lg"></i>
                                    </button>
                                </div>
                                ${word.ipa
                                    ? `<span class="text-xs text-slate-500 font-mono" id="card-ipa">[${training.esc(word.ipa)}]</span>`
                                    : ''}
                            </div>

                            <div id="card-back" class="hidden flex-col p-4 bg-[#171d2b] border-t border-slate-700/50 rounded-b-2xl">
                                <h3 class="text-2xl font-bold text-amber-500 text-center mb-3 drop-shadow-md">${word.translation}</h3>

                                <!--
                                    Уровень, тема и признак сверки хранились в базе,
                                    но нигде не показывались: понять, базовое это слово
                                    или продвинутое и проверены ли его формы, было нельзя
                                -->
                                ${training.renderTags(word)}
                                ${grammarBlock}
                                <div class="bg-[#1b2234] p-3 rounded-xl border border-slate-700/70 shadow-inner">
                                    <p lang="de" class="text-slate-200 text-sm font-bold italic mb-1.5">"${word.example_de || ''}"</p>
                                    <p class="text-slate-400 text-xs">${word.example_ru || ''}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!--
                    Подсказка живёт отдельной строкой, а не поверх карточки:
                    плашка поверх закрывала перевод примера. Строка есть всегда,
                    меняется только видимость — иначе карточка прыгала бы на её
                    высоту, когда прокручивать становится нечего.
                -->
                <div id="card-more" class="shrink-0 h-6 flex justify-center items-center opacity-0 transition-opacity duration-200">
                    <span class="text-[10px] font-bold text-amber-500/90">
                        <i class="fa-solid fa-chevron-down mr-1"></i>${t('training.scrollHint')}
                    </span>
                </div>

                <div id="controls-front" class="shrink-0 pb-2">
                    <button onclick="training.flipCard()" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xl font-black rounded-xl shadow-lg active:scale-95 transition-all">
                        ${t('training.showAnswer')}
                    </button>
                </div>

                <div id="controls-back" class="shrink-0 pb-2 hidden grid-cols-4 gap-2">
                    <button onclick="training.rate(1)" class="flex flex-col items-center justify-center py-3.5 bg-[#3a2024] border border-[#522a2f] text-[#ff7171] rounded-xl active:scale-95 transition-transform hover:bg-[#47272c]">
                        <span class="text-[10px] opacity-70 mb-0.5">${srs.describeNext(1, word)}</span>
                        <span class="font-bold">${t('training.again')}</span>
                    </button>
                    <button onclick="training.rate(2)" class="flex flex-col items-center justify-center py-3.5 bg-[#3b271d] border border-[#553625] text-[#ff9e5e] rounded-xl active:scale-95 transition-transform hover:bg-[#4d3326]">
                        <span class="text-[10px] opacity-70 mb-0.5">${srs.describeNext(2, word)}</span>
                        <span class="font-bold">${t('training.hard')}</span>
                    </button>
                    <button onclick="training.rate(3)" class="flex flex-col items-center justify-center py-3.5 bg-[#1d3528] border border-[#264b38] text-[#5cd589] rounded-xl active:scale-95 transition-transform hover:bg-[#254433]">
                        <span class="text-[10px] opacity-70 mb-0.5">${srs.describeNext(3, word)}</span>
                        <span class="font-bold">${t('training.good')}</span>
                    </button>
                    <button onclick="training.rate(4)" class="flex flex-col items-center justify-center py-3.5 bg-[#1e2a45] border border-[#293d68] text-[#719fff] rounded-xl active:scale-95 transition-transform hover:bg-[#263556]">
                        <span class="text-[10px] opacity-70 mb-0.5">${srs.describeNext(4, word)}</span>
                        <span class="font-bold">${t('training.easy')}</span>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Озвучка. Принимает либо строку, либо кнопку с data-word: из разметки
     * приходит элемент, из кода аудирования — сразу текст.
     */
    playAudio: async (source) => {
        const text = source instanceof Element ? source.dataset.word : source;
        const btn = document.getElementById('training-audio-btn');
        const idle = () => { if (btn) btn.innerHTML = `<i class="fa-solid fa-volume-high text-lg"></i>`; };

        const spoken = await speech.speak(text, {
            onStart: () => { if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-lg"></i>`; },
            onEnd: idle
        });

        // Молчание без объяснения выглядит как поломка кнопки, а причина
        // в системе: немецкого голоса на устройстве может просто не быть
        if (!spoken) {
            idle();
            await dialog.alert(t('speech.noVoiceHint'), { title: t('speech.noVoiceTitle') });
        }
    },

    flipCard: () => {
        document.getElementById('card-back').classList.remove('hidden');
        document.getElementById('card-back').classList.add('flex');
        document.getElementById('controls-front').classList.add('hidden');
        document.getElementById('controls-back').classList.remove('hidden');
        document.getElementById('controls-back').classList.add('grid');

        // Пока слово было вопросом, ему полагалась половина экрана.
        // После ответа эти двести пикселей нужнее грамматике
        const front = document.getElementById('card-front');
        front.classList.remove('p-8', 'min-h-[200px]');

        // Слово прилипает к верху прокручиваемой области: пока читаешь
        // грамматику и пример, само слово уезжало вверх, и на экране
        // оставался только его пустой нижний край
        front.classList.add('p-3', 'min-h-0', 'sticky', 'top-0', 'z-20', 'bg-[#21293c]', 'rounded-t-2xl', 'border-b', 'border-slate-700/50');

        // Кнопка озвучки задавала высоту закреплённой полосы — уменьшаем
        // вместе с ней
        const audio = document.getElementById('training-audio-btn');
        if (audio) {
            audio.classList.replace('w-12', 'w-10');
            audio.classList.replace('h-12', 'h-10');
        }

        document.getElementById('card-type').classList.add('hidden');
        document.getElementById('card-word').classList.replace('text-3xl', 'text-2xl');

        training.updateScrollHint();
    },

    /**
     * Подсказка о прокрутке карточки.
     *
     * Без неё содержимое просто упиралось в кнопки, и это читалось как
     * обрезанный текст — на телефоне под ответ остаётся около 400 px,
     * а полная карточка занимает вдвое больше.
     */
    updateScrollHint: () => {
        const scroll = document.getElementById('card-scroll');
        const more = document.getElementById('card-more');
        if (!scroll || !more) return;

        const apply = () => {
            const остаток = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop;
            more.classList.toggle('opacity-0', остаток <= 8);
        };

        if (!scroll.dataset.hintBound) {
            scroll.addEventListener('scroll', apply, { passive: true });
            scroll.dataset.hintBound = '1';
        }

        // Считаем сразу и ещё раз на следующем кадре: сразу — потому что
        // в свёрнутом приложении кадры не рисуются и rAF не сработает,
        // повторно — потому что разметку только что вставили и размеры
        // могут ещё не устояться
        apply();
        requestAnimationFrame(apply);
    },

    rate: async (quality) => {
        let word = training.currentWord;
        
        srs.applyTo(word, quality);

        // «Снова» и «Трудно» — это не вспомнил или вспомнил с трудом,
        // освоенность от них расти не должна
        masteryUtils.registerAnswer(word, quality >= 3);

        await dbService.putWord(word);

        const xpMap = { 1: 1, 2: 3, 3: 5, 4: 8 };
        const gainedXP = xpMap[quality];
        
        training.state.data.xpEarned = (training.state.data.xpEarned || 0) + gainedXP;
        
        if (training.state.status === 'new_words') {
            training.state.data.newWords = (training.state.data.newWords || 0) + 1;
        } else {
            training.state.data.reviewed = (training.state.data.reviewed || 0) + 1;
        }
        
        // Различаем повторение и новое слово — график показывает их отдельно
        await dbService.addXP(gainedXP, training.state.status === 'new_words' ? { newWords: 1 } : { reviews: 1 });

        training.currentIndex++;
        await lessonStateManager.updateState(training.state.status, training.currentIndex, training.state.data);

        if (training.currentIndex < training.queue.length) {
            training.showCard();
        } else {
            training.nextStep();
        }
    },

    showCompletedScreen: async () => {
        document.body.classList.remove('lesson-mode');
        const user = await dbService.getUser();
        const main = document.getElementById('main-content');
        const stateData = training.state?.data || { newWords: 0, reviewed: 0, xpEarned: 0 };
        
        main.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center fade-in max-w-sm mx-auto">
                <div class="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(245,158,11,0.4)] border-4 border-slate-900">
                    <i class="fa-solid fa-trophy text-5xl text-slate-900"></i>
                </div>
                
                <h2 class="text-3xl font-black text-slate-100 mb-2">${t('training.doneTitle')}</h2>
                <p class="text-slate-400 mb-8">${t('training.doneText')}</p>
                
                <div class="w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg mb-8 space-y-4">
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 font-bold">${t('training.learnedNew')}</span>
                        <span class="text-green-400 font-black text-xl">+${stateData.newWords || 0}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 font-bold">${t('training.reviewed')}</span>
                        <span class="text-blue-400 font-black text-xl">${stateData.reviewed || 0}</span>
                    </div>
                    <div class="h-px w-full bg-slate-700 my-2"></div>
                    <div class="flex justify-between items-center">
                        <span class="text-amber-500 font-bold">${t('training.xpEarned')}</span>
                        <span class="text-amber-500 font-black text-2xl">+${stateData.xpEarned || 0}</span>
                    </div>
                    <div class="flex justify-between items-center pt-2">
                        <span class="text-slate-400 font-bold">${t('training.currentLeague')}</span>
                        <span class="text-white font-bold px-3 py-1 bg-slate-700 rounded-lg">${t('leagues.' + dbService.normalizeLeague(user.league))}</span>
                    </div>
                </div>
                
                <button onclick="app.navigate('plan')" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg active:scale-95 transition-transform">
                    ${t('training.backToBase')}
                </button>
            </div>
        `;
    }
};
