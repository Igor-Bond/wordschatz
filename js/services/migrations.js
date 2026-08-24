/**
 * Превращения записей при переходе между версиями схемы.
 *
 * Вынесены из db.js по одной причине: миграция портит данные молча и
 * необратимо, а проверить её там было нельзя — код жил внутри
 * `db.version(N).upgrade(...)` и запускался только при настоящем
 * обновлении базы у настоящего пользователя. Здесь это обычные функции
 * над одной записью, и на них есть проверки.
 *
 * Каждая функция меняет переданный объект на месте — так их и вызывает
 * Dexie внутри `.modify()`.
 */

/**
 * Освоенность из состояния интервального повторения.
 *
 * Нужна миграции 5: прежнее поле копилось прибавками, включая ответ
 * «Снова», и показывало выученным то, чего человек не знал. Истории
 * ответов у старых слов нет, но интервал — честное свидетельство.
 */
export function computeMastery(word) {
    const interval = word.interval || 0;
    const repetitions = word.repetitions || 0;
    const phase = word.phase || (interval > 0 && repetitions > 0 ? 'review' : 'learning');

    if (phase === 'learning' || interval <= 0) return Math.min(25, repetitions * 8);
    if (interval < 7) return Math.round(25 + ((interval - 1) / 6) * 30);
    if (interval < 21) return Math.round(55 + ((interval - 7) / 14) * 25);

    return Math.min(100, Math.round(80 + ((interval - 21) / 69) * 20));
}

/**
 * Разбор строки спряжения вида «ich mache, du machst, er/sie/es macht».
 * Возвращает null, если разобрать нечего.
 */
export function parsePresentString(present) {
    const text = String(present ?? '').trim();
    if (!text) return null;

    const PRONOUNS = {
        ich: 'ich', du: 'du', er: 'er', sie: 'er', es: 'er',
        wir: 'wir', ihr: 'ihr'
    };

    const result = {};
    for (const chunk of text.split(/[,;]/)) {
        const match = chunk.trim().match(/^([a-zäöüß/]+)\s+(.+)$/i);
        if (!match) continue;

        // «er/sie/es macht» — берём первое местоимение
        const pronoun = PRONOUNS[match[1].toLowerCase().split('/')[0]];
        if (pronoun && !result[pronoun]) result[pronoun] = match[2].trim();
    }

    return Object.keys(result).length ? result : null;
}

export const migrations = {

    /** Версия 2: статус, освоенность и принадлежность циклу. */
    toV2: (word) => {
        if (!word.status) word.status = 'existing';
        if (typeof word.mastery === 'undefined') word.mastery = 0;
        if (typeof word.cycleId === 'undefined') word.cycleId = null;
        return word;
    },

    /**
     * Версия 3: метка изменения и мягкое удаление.
     *
     * Без updatedAt синхронизация невозможна вовсе, а без deletedAt
     * удаление не доехало бы до облака — запись просто исчезла бы
     * локально и вернулась с другого устройства.
     */
    toV3: (record, now = Date.now()) => {
        if (!record.updatedAt) record.updatedAt = record.createdAt || now;
        if (typeof record.deletedAt === 'undefined') record.deletedAt = null;
        return record;
    },

    /** Версия 4: род отдельным полем, спряжение объектом, признак сверки. */
    toV4: (word) => {
        // «der Tisch» → gender: 'der'. Для старых карточек это бесплатно
        // и сразу чинит задание на артикли
        if (word.gender === undefined) {
            const parts = String(word.word ?? '').trim().split(/\s+/);
            const first = (parts[0] || '').toLowerCase();
            word.gender = (parts.length > 1 && ['der', 'die', 'das'].includes(first)) ? first : null;
        }

        // Спряжение хранилось строкой — из неё нельзя было спросить
        // конкретное лицо
        if (word.conjugation === undefined) {
            word.conjugation = parsePresentString(word.present);
        }

        if (word.akkusativ === undefined) word.akkusativ = null;

        // Карточка сгенерирована ИИ и человеком не проверялась
        if (word.verified === undefined) word.verified = 0;

        return word;
    },

    /** Версия 5: история ответов и пересчёт освоенности. */
    toV5: (word, now = Date.now()) => {
        if (!Array.isArray(word.recent)) word.recent = [];
        if (typeof word.attempts !== 'number') word.attempts = 0;
        if (typeof word.correct !== 'number') word.correct = 0;

        word.mastery = computeMastery(word);
        word.updatedAt = now;

        return word;
    }
};
