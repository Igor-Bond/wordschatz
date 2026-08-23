/**
 * Освоенность слова (§14 ТЗ).
 *
 * Раньше поле mastery накапливалось: каждая оценка карточки прибавляла
 * «оценка × 5», включая «Снова». Слово, забытое десять раз, набирало
 * полсотни процентов, упасть счётчик мог только на экзамене, а ответы в
 * упражнениях не учитывались вовсе.
 *
 * Здесь освоенность не копится, а вычисляется из фактического состояния:
 * длины интервала SRS (слово пережило проверку временем) и точности
 * последних ответов. Пересчёт идёт при каждом ответе, поэтому цифра
 * исправляется задним числом и не расходится с реальностью.
 */

/** Сколько последних ответов учитываем. */
const WINDOW = 8;

/** С какого интервала слово считается осевшим в памяти (как «зрелые» карточки в Anki). */
const MATURE_DAYS = 21;

export const masteryUtils = {

    MATURE_DAYS,

    /**
     * Вклад интервала: 0–25 пока слово в изучении, 25–55 на интервалах до
     * недели, 55–80 до трёх недель, дальше 80–100.
     */
    intervalScore: (word) => {
        const interval = word?.interval || 0;
        const repetitions = word?.repetitions || 0;
        const phase = word?.phase || (interval > 0 && repetitions > 0 ? 'review' : 'learning');

        if (phase === 'learning' || interval <= 0) {
            return Math.min(25, repetitions * 8);
        }

        if (interval < 7) return 25 + ((interval - 1) / 6) * 30;
        if (interval < MATURE_DAYS) return 55 + ((interval - 7) / 14) * 25;

        // К трём месяцам выходим на сотню
        return Math.min(100, 80 + ((interval - MATURE_DAYS) / 69) * 20);
    },

    /** Последние ответы: массив из 0 и 1. */
    recent: (word) => (Array.isArray(word?.recent) ? word.recent.slice(-WINDOW) : []),

    /**
     * Доля верных ответов за последние ответы.
     * Пока ответов мало, считаем показатель неизвестным — штрафовать
     * новое слово за отсутствие истории нечестно.
     */
    accuracy: (word) => {
        const recent = masteryUtils.recent(word);
        if (recent.length < 3) return null;
        return recent.reduce((sum, v) => sum + v, 0) / recent.length;
    },

    /** Множитель к интервалу: от 0.7 при сплошных ошибках до 1.0. */
    accuracyScore: (word) => {
        const accuracy = masteryUtils.accuracy(word);
        if (accuracy === null) return 1;
        return 0.7 + 0.3 * accuracy;
    },

    /** Освоенность 0–100. */
    compute: (word) => Math.round(masteryUtils.intervalScore(word) * masteryUtils.accuracyScore(word)),

    /**
     * Слово освоено: пережило интервал в три недели и не сыпется на ответах.
     * Это и есть содержательный ответ на вопрос «сколько слов я знаю».
     */
    isLearned: (word) => {
        if ((word?.interval || 0) < MATURE_DAYS) return false;
        const accuracy = masteryUtils.accuracy(word);
        return accuracy === null || accuracy >= 0.85;
    },

    /**
     * Проблемное слово: часто ошибаемся или SRS уже понизил лёгкость.
     * Ручную пометку не заменяет, а дополняет.
     */
    isWeak: (word) => {
        if (word?.isDifficult) return true;

        const recent = masteryUtils.recent(word);
        if (recent.length >= 4) {
            const accuracy = recent.reduce((sum, v) => sum + v, 0) / recent.length;
            if (accuracy < 0.6) return true;
        }

        return (word?.ease || 2.5) <= 2.0 && (word?.repetitions || 0) >= 3;
    },

    /**
     * Учёт ответа: дописываем в окно, обновляем счётчики и пересчитываем
     * освоенность. Слово меняется на месте — вызывающий сохраняет его сам.
     *
     * @param {Object} word слово из базы
     * @param {boolean} correct ответ верный
     */
    registerAnswer: (word, correct) => {
        const recent = masteryUtils.recent(word);
        recent.push(correct ? 1 : 0);

        word.recent = recent.slice(-WINDOW);
        word.attempts = (word.attempts || 0) + 1;
        word.correct = (word.correct || 0) + (correct ? 1 : 0);
        word.mastery = masteryUtils.compute(word);

        return word;
    },

    /** Пересчёт без нового ответа — после изменения интервала. */
    refresh: (word) => {
        word.mastery = masteryUtils.compute(word);
        return word;
    }
};
