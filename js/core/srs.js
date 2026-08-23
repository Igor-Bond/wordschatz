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
const srs = {

    /** Шаги заучивания в минутах: сначала через 10 минут, потом через день. */
    LEARNING_STEPS: [10, 24 * 60],

    MIN_EASE: 1.3,
    MAX_EASE: 3.0,
    MAX_INTERVAL_DAYS: 365,

    /** Доля, на которую случайно раздвигается интервал (±5%). */
    FUZZ: 0.05,

    MINUTE: 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,

    clampEase: (ease) => Math.min(srs.MAX_EASE, Math.max(srs.MIN_EASE, ease)),

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
                // Остаёмся на текущем шаге
                ease = srs.clampEase(ease - 0.15);
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

    /** Человекочитаемый срок следующего показа — для подписей на кнопках. */
    describeNext: (quality, word) => {
        const result = srs.calculate(quality, word);
        const ms = result.nextReview - Date.now();

        if (ms < 60 * srs.MINUTE) return `${Math.round(ms / srs.MINUTE)} мин`;
        const days = Math.round(ms / srs.DAY);
        if (days < 1) return '< 1 дня';
        if (days === 1) return '1 день';
        if (days < 5) return `${days} дня`;
        if (days < 30) return `${days} дней`;
        const months = Math.round(days / 30);
        return months === 1 ? '1 мес' : `${months} мес`;
    }
};
