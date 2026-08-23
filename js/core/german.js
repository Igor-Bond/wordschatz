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

        // Карточки, созданные до перехода на объект, хранят строку
        // «ich mache, du machst, er macht» — разбираем её на лету
        const text = String(word?.present ?? '').trim();
        if (!text) return null;

        const result = {};
        for (const chunk of text.split(/[,;]/)) {
            const match = chunk.trim().match(/^([a-zäöüß/]+)\s+(.+)$/i);
            if (!match) continue;

            const raw = match[1].toLowerCase();
            const first = raw.split('/')[0];

            // «sie» — это и третье лицо единственного числа, и вежливое
            // множественное. Различаем по тому, что уже занято: в строке
            // они идут по порядку, третье лицо раньше
            let pronoun = { ich: 'ich', du: 'du', er: 'er', es: 'er', wir: 'wir', ihr: 'ihr' }[first];
            if (!pronoun && first === 'sie') pronoun = result.er ? 'sie' : 'er';

            if (pronoun && !result[pronoun]) result[pronoun] = match[2].trim();
        }

        return Object.keys(result).length ? result : null;
    },

    /**
     * Каких форм не хватает карточке.
     *
     * Модель иногда возвращает слово с одним переводом и без грамматики.
     * Заметить это на глаз можно только пролистав словарь, поэтому считаем.
     * Синонимы, антонимы и Rektion в список не входят: их просили заполнять
     * только при наличии, выдумывать их не надо.
     */
    missingFields: (word) => {
        const empty = (v) => !String(v ?? '').trim();
        const missing = [];

        if (empty(word?.translation)) missing.push('translation');
        if (empty(word?.example_de)) missing.push('example_de');
        if (empty(word?.example_ru)) missing.push('example_ru');

        // Транскрипция есть в Wiktionary почти у каждого слова и достаётся
        // бесплатно. У фраз её не спрашиваем: статьи под них обычно нет,
        // а разбор берёт заголовком первое слово
        if (['noun', 'verb', 'adjective'].includes(word?.type) && empty(word?.ipa)) missing.push('ipa');

        if (word?.type === 'noun') {
            if (!germanUtils.getGender(word)) missing.push('gender');
            if (empty(word.plural)) missing.push('plural');
            if (empty(word.dativ)) missing.push('dativ');
            if (empty(word.akkusativ)) missing.push('akkusativ');
        } else if (word?.type === 'verb') {
            const conjugation = germanUtils.getConjugation(word);
            if (!conjugation || Object.keys(conjugation).length < 6) missing.push('conjugation');
            if (empty(word.preterite)) missing.push('preterite');
            if (empty(word.participle_ii)) missing.push('participle_ii');
            if (empty(word.auxiliary)) missing.push('auxiliary');

            // Wiktionary отдаёт эти формы даром, поэтому спрашивать их
            // не жалко: пустыми они остаются только у слов, которых там нет
            if (empty(word.imperative_singular)) missing.push('imperative_singular');
            if (empty(word.konjunktiv2)) missing.push('konjunktiv2');
        } else if (word?.type === 'adjective') {
            if (empty(word.comparative)) missing.push('comparative');
            if (empty(word.superlative)) missing.push('superlative');
        }

        return missing;
    },

    /** Доля заполненных обязательных полей, 0–100. */
    completeness: (word) => {
        const total = { noun: 8, verb: 10, adjective: 6 }[word?.type] || 3;
        const missing = germanUtils.missingFields(word).length;
        return Math.round(((total - missing) / total) * 100);
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
