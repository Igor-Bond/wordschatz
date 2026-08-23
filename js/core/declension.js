/**
 * Склонение прилагательных (§6 ТЗ).
 *
 * Окончание зависит от трёх вещей сразу: какой перед прилагательным
 * артикль, какого рода и числа существительное и в каком оно падеже.
 * Отсюда таблица на три типа × четыре рода × три падежа.
 *
 * Ни ИИ, ни Wiktionary здесь не нужны: это правило, одинаковое для всех
 * прилагательных. Формы собираются на месте, офлайн и бесплатно —
 * хранить их в карточке было бы тратой места на то, что вычисляется.
 *
 * Genitiv не поддерживается: по §7 ТЗ он заменён на Dativ во всём
 * приложении, и таблица без него втрое читаемее на телефоне.
 */

/**
 * Окончания по типу склонения.
 *
 *   weak   — после определённого артикля (der, dieser, jeder)
 *   mixed  — после неопределённого и притяжательного (ein, kein, mein)
 *   strong — без артикля вовсе
 */
const ENDINGS = {
    weak: {
        nominativ: { m: 'e',  f: 'e',  n: 'e',  pl: 'en' },
        akkusativ: { m: 'en', f: 'e',  n: 'e',  pl: 'en' },
        dativ:     { m: 'en', f: 'en', n: 'en', pl: 'en' }
    },
    mixed: {
        nominativ: { m: 'er', f: 'e',  n: 'es', pl: 'en' },
        akkusativ: { m: 'en', f: 'e',  n: 'es', pl: 'en' },
        dativ:     { m: 'en', f: 'en', n: 'en', pl: 'en' }
    },
    strong: {
        nominativ: { m: 'er', f: 'e',  n: 'es', pl: 'e'  },
        akkusativ: { m: 'en', f: 'e',  n: 'es', pl: 'e'  },
        dativ:     { m: 'em', f: 'er', n: 'em', pl: 'en' }
    }
};

/** Артикли перед прилагательным — для сборки примера целиком. */
const ARTICLES = {
    weak: {
        nominativ: { m: 'der', f: 'die', n: 'das', pl: 'die' },
        akkusativ: { m: 'den', f: 'die', n: 'das', pl: 'die' },
        dativ:     { m: 'dem', f: 'der', n: 'dem', pl: 'den' }
    },
    mixed: {
        nominativ: { m: 'ein',   f: 'eine',  n: 'ein',   pl: 'keine'  },
        akkusativ: { m: 'einen', f: 'eine',  n: 'ein',   pl: 'keine'  },
        dativ:     { m: 'einem', f: 'einer', n: 'einem', pl: 'keinen' }
    },
    strong: {
        nominativ: { m: '', f: '', n: '', pl: '' },
        akkusativ: { m: '', f: '', n: '', pl: '' },
        dativ:     { m: '', f: '', n: '', pl: '' }
    }
};

export const declension = {

    TYPES: ['weak', 'mixed', 'strong'],
    GENDERS: ['m', 'f', 'n', 'pl'],
    CASES: ['nominativ', 'akkusativ', 'dativ'],

    /** Род существительного по артиклю — для связи с карточкой слова. */
    GENDER_BY_ARTICLE: { der: 'm', die: 'f', das: 'n' },

    /**
     * Основа, к которой приклеивается окончание.
     *
     * Три особых случая, и все предсказуемые:
     *   hoch   → hoh-   (буква c выпадает)
     *   dunkel → dunkl- (в -el выпадает e)
     *   teuer  → teur-  (в -er выпадает e)
     *
     * Ещё есть прилагательные на -a (rosa, lila): они не склоняются вовсе.
     */
    stem: (adjective) => {
        const word = String(adjective ?? '').trim().toLowerCase();
        if (!word) return '';

        if (word === 'hoch') return 'hoh';

        // Безударное -el после согласной теряет e: dunkel → dunkl,
        // edel → edl, nobel → nobl. У «viel» перед -el гласная, там ничего
        // не выпадает
        if (/[^aeiouäöü]el$/.test(word)) return word.slice(0, -2) + 'l';

        // В -er e выпадает только после дифтонга: teuer → teur, sauer → saur.
        // После согласной оно остаётся (bitter → bittere), и «leer» со
        // «schwer» тоже не трогаются — там -er часть корня
        if (/(au|eu|äu)er$/.test(word)) return word.slice(0, -2) + 'r';

        return word;
    },

    /** Не склоняются: rosa, lila, prima и прочие заимствования на гласную. */
    isIndeclinable: (adjective) => /a$/i.test(String(adjective ?? '').trim()),

    /**
     * Одна форма.
     *
     * @param {string} adjective словарная форма, например «hell»
     * @param {'weak'|'mixed'|'strong'} type тип склонения
     * @param {'m'|'f'|'n'|'pl'} gender род или множественное число
     * @param {'nominativ'|'akkusativ'|'dativ'} kase падеж
     */
    form: (adjective, type, gender, kase) => {
        const base = String(adjective ?? '').trim().toLowerCase();
        if (!base) return '';
        if (declension.isIndeclinable(base)) return base;

        const ending = ENDINGS[type]?.[kase]?.[gender];
        if (!ending) return base;

        return declension.stem(base) + ending;
    },

    /** Артикль для этой же ячейки. Для сильного склонения — пустая строка. */
    article: (type, gender, kase) => ARTICLES[type]?.[kase]?.[gender] ?? '',

    /**
     * Существительное во множественном числе в дательном получает -n:
     * «die Leute», но «den Leuten». Без этого в задании появлялась
     * неграмматичная фраза «keinen hellen Leute».
     */
    nounForm: (noun, gender, kase) => {
        const base = String(noun ?? '').trim();
        if (!base || gender !== 'pl' || kase !== 'dativ') return base;
        // Множественное на -n или -s второе -n не берёт: Frauen, Autos
        if (/[ns]$/i.test(base)) return base;
        return base + 'n';
    },

    /**
     * Словосочетание целиком: «dem hellen Raum».
     * Существительное подставляет вызывающий — оно задаёт род.
     */
    phrase: (adjective, type, gender, kase, noun = '') => {
        const article = declension.article(type, gender, kase);
        const form = declension.form(adjective, type, gender, kase);
        return [article, form, declension.nounForm(noun, gender, kase)].filter(Boolean).join(' ');
    },

    /**
     * Полная таблица: { weak: { nominativ: { m, f, n, pl }, … }, … }.
     * Для показа целиком — например, в раскрывающемся блоке карточки.
     */
    table: (adjective) => Object.fromEntries(
        declension.TYPES.map(type => [
            type,
            Object.fromEntries(declension.CASES.map(kase => [
                kase,
                Object.fromEntries(declension.GENDERS.map(gender => [
                    gender,
                    declension.form(adjective, type, gender, kase)
                ]))
            ]))
        ])
    ),

    /**
     * Три формы именительного падежа мужского рода.
     *
     * Суть правила в одной строке: «der helle · ein heller · heller».
     * Именно на этих трёх формах видно, что окончание задаётся артиклем.
     */
    summary: (adjective) => declension.TYPES.map(type => ({
        type,
        article: declension.article(type, 'm', 'nominativ'),
        form: declension.form(adjective, type, 'm', 'nominativ')
    }))
};
