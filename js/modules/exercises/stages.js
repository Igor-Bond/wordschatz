/**
 * Ход урока и выбор задания.
 *
 * Здесь всё, что решает «какое задание показать этому слову сейчас»:
 * лестница из трёх этапов, правило «не то же, что в прошлый раз», и
 * сам проход по очереди. Отрисовка каждого задания лежит рядом, в
 * render.js, — здесь только выбор и общая рамка вокруг него.
 */

import { exercises } from './shared.js';
import { quiz } from '../../core/quiz.js';
import { declension } from '../../core/declension.js';
import { speech } from '../../core/speech.js';
import { germanUtils } from '../../core/german.js';
import { t } from '../../i18n/i18n.js';
import { training } from '../training.js';

export const stages = {

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
        recognition: ['translation_de_ru', 'translation_ru_de', 'match_pairs', 'article', 'sentence_builder', 'word_builder', 'adjective_ending'],

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
        consolidation: ['translation_ru_de', 'match_pairs', 'article', 'rektion', 'verb_form', 'fill_blanks', 'adjective_ending', 'sentence_builder', 'word_builder'],

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
         * Не то же, что в прошлый раз, — и не то же на вид.
         *
         * Сперва здесь исключался ровно прошлый тип. Этого мало: у
         * нового слова без рода и примера доступны три типа, и два из
         * них — выбор перевода в одну и в другую сторону — для глаза
         * неотличимы, те же четыре кнопки. Правило исправно чередовало
         * их между собой, и человек видел «пары и выбор из четырёх»,
         * то есть два задания вместо десяти.
         *
         * Поэтому исключается всё семейство прошлого типа.
         *
         * Если после этого не остаётся ничего — значит выбора и правда
         * нет, и повтор честен.
         */
        const прошлое = exercises.MODE_FAMILY[word?.lastMode] || word?.lastMode;
        const другие = pool.filter(m => (exercises.MODE_FAMILY[m] || m) !== прошлое);
        if (другие.length) pool = другие;

        return quiz.shuffle(pool)[0];
    },

    /**
     * Типы, неразличимые на вид, — под одним именем.
     *
     * Оба перевода выбором это одни и те же четыре кнопки, отличается
     * только язык вопроса. Для памяти это разные задания — узнать и
     * припомнить, — а для глаза одно и то же.
     */
    MODE_FAMILY: {
        translation_de_ru: 'выбор перевода',
        translation_ru_de: 'выбор перевода'
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

        /** Чем склеивать куски обратно: пробел для слов, пусто для букв. */
        separator: ' ',

        /** Сколько раз собрали неверно. */
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

        // Сборка слова из букв держится на одном лишь слове, поэтому
        // доступна всегда — ради этого и заведена, см. renderWordBuilder.
        // Слова короче трёх букв пропускаем: складывать «Ei» нечего
        if ((!hasRequested || requested.includes('word_builder'))
            && germanUtils.stripArticle(word).replace(/\s/g, '').length > 2) {
            validModes.push('word_builder');
        }

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
        else if (exType === 'word_builder') block = exercises.renderWordBuilder(word);
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
};
