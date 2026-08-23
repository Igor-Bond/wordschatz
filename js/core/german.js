/**
 * Разбор немецких форм из полей карточки.
 *
 * Поля приходят от ИИ свободным текстом, и раньше каждое задание разбирало
 * их на месте — с ошибками, которые учили неправильному:
 *   - существительное без артикля молча считалось словом мужского рода;
 *   - Perfekt собирался как «haben gemacht» вместо «hat gemacht»;
 *   - из строки «helfen + Dativ» в качестве предлога вытаскивалось «helfen».
 *
 * Здесь всё это разбирается один раз и честно возвращает null, когда
 * определить форму нельзя — задание тогда просто не предлагается.
 */

export const germanUtils = {

    ARTICLES: ['der', 'die', 'das'],

    /** Предлоги, которые встречаются в управлении глаголов. */
    PREPOSITIONS: [
        'an', 'auf', 'aus', 'bei', 'bis', 'durch', 'für', 'gegen', 'gegenüber',
        'hinter', 'in', 'mit', 'nach', 'neben', 'ohne', 'seit', 'über', 'um',
        'unter', 'von', 'vor', 'zu', 'zwischen', 'wegen', 'trotz', 'während'
    ],

    /** Падежи и то, как их может написать модель. */
    CASES: [
        { key: 'Akkusativ', pattern: /akkusativ|akk\.?(?:\s|$|\))|\bakk\b|\bа?ккузатив/i },
        { key: 'Dativ',     pattern: /dativ|dat\.?(?:\s|$|\))|\bdat\b|датив/i },
        { key: 'Genitiv',   pattern: /genitiv|gen\.?(?:\s|$|\))|\bgen\b|генитив/i },
        { key: 'Nominativ', pattern: /nominativ|nom\.?(?:\s|$|\))|\bnom\b/i }
    ],

    // ======================================================
    //  Существительные
    // ======================================================

    /**
     * Разбирает «der Tisch» на артикль и само слово.
     * Если артикля нет — article будет null, и это НЕ повод считать слово
     * мужским родом.
     */
    parseNoun: (raw) => {
        const text = String(raw ?? '').trim();
        const parts = text.split(/\s+/);

        if (parts.length > 1 && germanUtils.ARTICLES.includes(parts[0].toLowerCase())) {
            return { article: parts[0].toLowerCase(), base: parts.slice(1).join(' ') };
        }
        return { article: null, base: text };
    },

    /**
     * Род существительного.
     * Сначала смотрим отдельное поле gender, потом артикль в самом слове —
     * старые карточки поля не имеют.
     */
    getGender: (word) => {
        if (!word) return null;

        const stored = String(word.gender ?? '').toLowerCase();
        if (germanUtils.ARTICLES.includes(stored)) return stored;

        return germanUtils.parseNoun(word.word).article;
    },

    /** Можно ли спрашивать артикль у этого слова. */
    hasKnownArticle: (word) => {
        if (!word || word.type !== 'noun') return false;
        return germanUtils.getGender(word) !== null;
    },

    /** Слово без артикля: «der Tisch» → «Tisch». */
    stripArticle: (word) => germanUtils.parseNoun(word?.word).base,

    /** Цвет рода — общепринятая мнемоника: der синий, die красный, das зелёный. */
    GENDER_COLORS: {
        der: 'text-blue-400',
        die: 'text-red-400',
        das: 'text-green-400'
    },

    // ======================================================
    //  Спряжение
    // ======================================================

    PERSONS: ['ich', 'du', 'er', 'wir', 'ihr', 'sie'],

    PERSON_LABELS: { ich: 'ich', du: 'du', er: 'er/sie/es', wir: 'wir', ihr: 'ihr', sie: 'sie/Sie' },

    /**
     * Спряжение объектом.
     * Новые карточки хранят его в conjugation, старые — строкой в present.
     */
    getConjugation: (word) => {
        if (word?.conjugation && typeof word.conjugation === 'object') {
            const filled = Object.entries(word.conjugation)
                .filter(([, form]) => String(form ?? '').trim());
            if (filled.length) return Object.fromEntries(filled);
        }
        return null;
    },

    // ======================================================
    //  Глаголы
    // ======================================================

    /**
     * Perfekt в том виде, в каком его приводят словари: «hat gemacht»,
     * «ist gegangen».
     *
     * @returns {{primary: string, accepted: string[]}|null}
     */
    perfektForm: (word) => {
        const participle = String(word?.participle_ii ?? '').trim();
        if (!participle) return null;

        const usesSein = /\bsein\b|\bist\b/i.test(String(word.auxiliary ?? ''));
        const third = usesSein ? 'ist' : 'hat';
        const infinitive = usesSein ? 'sein' : 'haben';

        return {
            primary: `${third} ${participle}`,
            // Форму с инфинитивом тоже принимаем: так Perfekt подают
            // некоторые учебники, и наказывать за это не за что
            accepted: [`${third} ${participle}`, `${infinitive} ${participle}`]
        };
    },

    /** Präteritum: третье лицо единственного числа. */
    preteritumForm: (word) => {
        const form = String(word?.preterite ?? '').trim();
        return form ? { primary: form, accepted: [form] } : null;
    },

    // ======================================================
    //  Управление глаголов (Rektion)
    // ======================================================

    /**
     * Разбирает строку управления в предлог и падеж.
     *
     * «warten auf + Akkusativ» → { preposition: 'auf', kase: 'Akkusativ' }
     * «helfen + Dativ»         → { preposition: null,  kase: 'Dativ' }
     * «sich freuen über + Akk» → { preposition: 'über', kase: 'Akkusativ' }
     */
    parseRektion: (raw) => {
        const text = String(raw ?? '').trim();
        if (!text) return { preposition: null, kase: null };

        // Падеж ищем по всей строке
        const found = germanUtils.CASES.find(c => c.pattern.test(text));
        const kase = found ? found.key : null;

        // Предлог — только настоящий предлог из списка, а не первое слово:
        // в «helfen + Dativ» первое слово это глагол
        const tokens = text.toLowerCase().match(/[a-zäöüß]+/g) || [];
        const preposition = tokens.find(tok => germanUtils.PREPOSITIONS.includes(tok)) || null;

        return { preposition, kase };
    },

    /** Есть ли что спрашивать по управлению этого глагола. */
    hasRektion: (word) => {
        if (!word || word.type !== 'verb' || !word.rektion) return false;
        const parsed = germanUtils.parseRektion(word.rektion);
        return !!(parsed.preposition || parsed.kase);
    },

    // ======================================================
    //  Сравнение ответов
    // ======================================================

    /** Нормализация ввода: регистр, лишние пробелы, местоимение перед формой. */
    normalizeAnswer: (text) => String(text ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/^(ich|du|er|sie|es|wir|ihr)\s+/, '')
        .trim(),

    /** Совпал ли ответ с одним из допустимых вариантов. */
    matchesAnswer: (input, accepted) => {
        const normalized = germanUtils.normalizeAnswer(input);
        return (accepted || []).some(a => germanUtils.normalizeAnswer(a) === normalized);
    }
};
