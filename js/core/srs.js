import { t, plural } from '../i18n/i18n.js';

/**
 * Интервальное повторение (§17 ТЗ), подход Anki в упрощённом виде.
 *
 * Что изменилось по сравнению с первой версией:
 *   - появилась фаза заучивания с короткими шагами. Раньше ответ «Снова»
 *     ставил интервал 0, слово возвращалось только на следующий день —
 *     то есть забытое слово ждало сутки;
 *   - забытое зрелое слово («провал») не обнуляется полностью, а возвращается
 *     в заучивание с урезанным интервалом;
 *   - интервал слегка рандомизируется, иначе слова, выученные в один день,
 *     навсегда слипаются в одну пачку и дают пиковые дни;
 *   - интервал ограничен сверху, лёгкость — снизу и сверху.
 *
 * Оценки: 1 — Снова, 2 — Трудно, 3 — Хорошо, 4 — Легко.
 */
export const srs = {

    /** Шаги заучивания в минутах: сначала через 10 минут, потом через день. */
    LEARNING_STEPS: [10, 24 * 60],

    /** Во сколько раз «Трудно» откладывает показ по сравнению с «Снова». */
    HARD_STEP_FACTOR: 2,

    MIN_EASE: 1.3,
    MAX_EASE: 3.0,
    DEFAULT_EASE: 2.5,
    MAX_INTERVAL_DAYS: 365,

    /**
     * Насколько верный ответ возвращает лёгкость к обычной.
     *
     * Пока оценок было четыре, поднять лёгкость можно было кнопкой
     * «Легко». Ответ в упражнении двоичен — верно или нет, — и «Легко»
     * взять неоткуда. Получилось храповое колесо: каждая ошибка роняет
     * лёгкость на 0,2, а вернуть её нечем. Проверка на четырёхстах днях
     * показала, куда это ведёт: доля трудных слов растёт 8 % → 23 % →
     * 52 % и дальше, пока трудными не станут все. Заодно разрастаются
     * повторения — у слова с лёгкостью 1,3 интервал растёт втрое
     * медленнее положенного.
     *
     * Поэтому верный ответ лёгкость чуть-чуть возвращает. Восстановление
     * вчетверо медленнее наказания: четыре верных ответа гасят одну
     * ошибку, так что «трудное» остаётся содержательной пометкой, а не
     * приговором навсегда. Выше обычных 2,5 этот путь не поднимает —
     * по-настоящему лёгким слово делает только кнопка «Легко».
     */
    EASE_RECOVERY: 0.05,

    /** Доля, на которую случайно раздвигается интервал (±5%). */
    FUZZ: 0.05,

    MINUTE: 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,

    /**
     * Лёгкость в границах и без дробной пыли.
     *
     * Округление до сотых нужно из-за накопления: лёгкость меняется
     * шагами по 0,05 и 0,2, и после десятка сложений вместо 2,5
     * получается 2,499999999999999. В базе это выглядит мусором, а
     * сравнение с порогом «трудного» слова начинает зависеть от того,
     * сколько раз слово успели спросить.
     */
    clampEase: (ease) => Math.round(
        Math.min(srs.MAX_EASE, Math.max(srs.MIN_EASE, ease)) * 100
    ) / 100,

    /**
     * Задержка для оценки «Трудно» в заучивании.
     *
     * Удваиваем текущий шаг, но не больше половины того, что дало бы
     * «Хорошо»: на последнем шаге удвоение давало два дня против одного
     * у «Хорошо», то есть более трудный ответ откладывал слово дальше.
     */
    hardDelayMinutes: (stepIndex) => {
        const current = srs.LEARNING_STEPS[stepIndex];
        const nextStep = srs.LEARNING_STEPS[stepIndex + 1];
        const goodDelay = nextStep ?? 24 * 60;   // с последнего шага «Хорошо» выпускает на день

        return Math.min(current * srs.HARD_STEP_FACTOR, goodDelay / 2);
    },

    /** Разброс, чтобы повторения не собирались в один день. */
    applyFuzz: (days) => {
        if (days < 2) return days;
        const spread = days * srs.FUZZ;
        return Math.max(1, Math.round(days + (Math.random() * 2 - 1) * spread));
    },

    /**
     * Пересчёт состояния слова после ответа.
     *
     * @param {number} quality 1..4
     * @param {Object} word текущее состояние слова
     * @returns {{interval:number, ease:number, phase:string, stepIndex:number, nextReview:number}}
     */
    calculate: (quality, word = {}) => {
        const now = Date.now();
        let ease = typeof word.ease === 'number' ? word.ease : 2.5;
        let interval = typeof word.interval === 'number' ? word.interval : 0;

        // Слова из старых версий фазы не имеют: считаем зрелыми, если интервал уже набран
        let phase = word.phase || (interval > 0 && word.repetitions > 0 ? 'review' : 'learning');
        let stepIndex = typeof word.stepIndex === 'number' ? word.stepIndex : 0;

        if (phase === 'learning') {
            if (quality === 1) {
                stepIndex = 0;
                ease = srs.clampEase(ease - 0.2);
            } else if (quality === 2) {
                // «Трудно»: остаёмся на шаге, но ждём вдвое дольше.
                // Без множителя кнопка показывала те же 10 минут, что и
                // «Снова», и две первые оценки выглядели одинаково.
                ease = srs.clampEase(ease - 0.15);
                return {
                    interval: 0, ease, phase: 'learning', stepIndex,
                    nextReview: now + srs.hardDelayMinutes(stepIndex) * srs.MINUTE
                };
            } else if (quality === 3) {
                stepIndex += 1;
            } else {
                // «Легко» — сразу выпускаем из заучивания
                ease = srs.clampEase(ease + 0.15);
                return {
                    interval: 4, ease, phase: 'review', stepIndex: 0,
                    nextReview: now + 4 * srs.DAY
                };
            }

            if (stepIndex >= srs.LEARNING_STEPS.length) {
                // Шаги пройдены — слово переходит в обычные повторения
                return {
                    interval: 1, ease, phase: 'review', stepIndex: 0,
                    nextReview: now + srs.DAY
                };
            }

            return {
                interval: 0, ease, phase: 'learning', stepIndex,
                nextReview: now + srs.LEARNING_STEPS[stepIndex] * srs.MINUTE
            };
        }

        // --- Фаза повторения ---
        if (quality === 1) {
            // Провал: слово возвращается в заучивание, но прежний прогресс
            // не сгорает полностью — интервал ополовинивается
            ease = srs.clampEase(ease - 0.2);
            return {
                interval: Math.max(1, Math.round(interval * 0.5)),
                ease, phase: 'learning', stepIndex: 0,
                nextReview: now + srs.LEARNING_STEPS[0] * srs.MINUTE
            };
        }

        let next;
        if (quality === 2) {
            ease = srs.clampEase(ease - 0.15);
            next = interval * 1.2;
        } else if (quality === 3) {
            next = interval * ease;

            // Лёгкость подтягивается к обычной, но не выше неё
            if (ease < srs.DEFAULT_EASE) {
                ease = srs.clampEase(Math.min(srs.DEFAULT_EASE, ease + srs.EASE_RECOVERY));
            }
        } else {
            ease = srs.clampEase(ease + 0.15);
            next = interval * ease * 1.3;
        }

        next = Math.min(srs.MAX_INTERVAL_DAYS, Math.max(1, Math.round(next)));
        next = Math.min(srs.MAX_INTERVAL_DAYS, srs.applyFuzz(next));

        return {
            interval: next, ease, phase: 'review', stepIndex: 0,
            nextReview: now + next * srs.DAY
        };
    },

    /**
     * Переносит расчёт в само слово и считает повторение состоявшимся.
     *
     * Одно место на оба источника оценки: самооценку на карточке и ответ
     * в упражнении. Раньше расписание умела двигать только карточка, а
     * упражнение — самый содержательный ответ из двух — не влияло на срок
     * возврата слова вовсе.
     *
     * Слово меняется на месте; сохраняет его вызывающий.
     *
     * @param {Object} word слово из базы
     * @param {number} quality 1..4
     * @returns {Object} то же слово
     */
    applyTo: (word, quality) => {
        const next = srs.calculate(quality, word);

        word.interval = next.interval;
        word.ease = next.ease;
        word.phase = next.phase;
        word.stepIndex = next.stepIndex;
        word.nextReview = next.nextReview;
        word.repetitions = (word.repetitions || 0) + 1;

        // Слово тронули — оно больше не «ждёт своего дня»
        if (word.status === 'pending' || word.status === 'new') word.status = 'learning';

        return word;
    },

    /** Человекочитаемый срок следующего показа — для подписей на кнопках. */
    describeNext: (quality, word) => {
        const result = srs.calculate(quality, word);
        const ms = result.nextReview - Date.now();

        if (ms < 60 * srs.MINUTE) return plural('common.minute', Math.round(ms / srs.MINUTE));

        // Часы нужны, чтобы «Трудно» и «Хорошо» не выглядели одинаково
        // на последнем шаге заучивания
        if (ms < srs.DAY) return plural('common.hour', Math.round(ms / (60 * srs.MINUTE)));

        const days = Math.round(ms / srs.DAY);

        // Днями показываем до трёх месяцев: иначе «Хорошо» и «Легко»
        // у зрелого слова оба округлялись до «2 мес»
        if (days <= 90) return plural('common.day', days);

        return plural('common.month', Math.round(days / 30));
    }
};
