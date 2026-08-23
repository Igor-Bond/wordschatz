/**
 * Подбор вариантов ответа для заданий с выбором.
 *
 * Раньше дистракторы брались случайно из всего словаря:
 *   allWords.filter(...).sort(() => 0.5 - Math.random()).slice(0, 3)
 *
 * Из-за этого на вопрос «как будет по-немецки готовить» среди вариантов
 * оказывались der Tisch, die Lampe, hell и kochen — глагол вычислялся
 * по части речи, без всякого знания слова. А если в словаре попадались
 * два слова с одинаковым переводом, верный по смыслу ответ засчитывался
 * как ошибка.
 */

export const quiz = {

    /**
     * Честное перемешивание (Фишер—Йейтс).
     * sort(() => 0.5 - Math.random()) перемешиванием не является:
     * компаратор неконсистентен, распределение смещено, и правильный
     * ответ чаще оказывается на одних и тех же позициях.
     */
    shuffle: (array) => {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    },

    _norm: (value) => String(value ?? '').trim().toLowerCase(),

    /**
     * Подбирает правдоподобные неправильные варианты.
     *
     * Порядок предпочтения:
     *   1. та же часть речи и та же тема — самые трудные и полезные;
     *   2. та же часть речи;
     *   3. любые слова — если словарь ещё маленький.
     *
     * Отсеиваются слова с тем же переводом или написанием, что у цели,
     * и повторяющиеся переводы между самими вариантами.
     *
     * @param {Object} target слово, к которому подбираем
     * @param {Array} pool весь словарь
     * @param {number} count сколько нужно вариантов
     */
    pickDistractors: (target, pool, count = 3) => {
        const targetWord = quiz._norm(target.word);
        const targetTranslation = quiz._norm(target.translation);

        const candidates = (pool || []).filter(w =>
            w && w.id !== target.id &&
            quiz._norm(w.word) !== targetWord &&
            quiz._norm(w.translation) !== targetTranslation
        );

        const sameTypeSameTopic = candidates.filter(w =>
            w.type === target.type && w.topic && w.topic === target.topic
        );
        const sameType = candidates.filter(w => w.type === target.type);

        const picked = [];
        const usedIds = new Set();
        const usedTranslations = new Set();

        const take = (list) => {
            for (const word of quiz.shuffle(list)) {
                if (picked.length >= count) return;
                if (usedIds.has(word.id)) continue;

                // Два варианта с одинаковым переводом — заведомая путаница
                const key = quiz._norm(word.translation);
                if (usedTranslations.has(key)) continue;

                usedIds.add(word.id);
                usedTranslations.add(key);
                picked.push(word);
            }
        };

        take(sameTypeSameTopic);
        take(sameType);
        take(candidates);

        return picked;
    },

    /** Готовый перемешанный набор «правильный + дистракторы». */
    buildOptions: (target, pool, count = 3) =>
        quiz.shuffle([target, ...quiz.pickDistractors(target, pool, count)])
};
