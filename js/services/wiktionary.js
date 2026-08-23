import { germanUtils } from '../core/german.js';
import { t } from '../i18n/i18n.js';

/**
 * Сверка карточек с немецким Wiktionary.
 *
 * Карточки пишет языковая модель, и ошибку в роде или в Perfekt заметить
 * некому: приложение уверенно учит неправильному. Wiktionary отдаёт формы
 * в виде разметки шаблонов, бесплатно, без ключа и с разрешённым CORS —
 * это единственный источник правды, доступный клиенту напрямую.
 *
 * Разбираем только сводные шаблоны («Übersicht»): в них лежит ровно то, что
 * есть в нашей карточке, и они устроены одинаково у всех статей.
 */

const API = 'https://de.wiktionary.org/w/api.php';

/** Не долбим чужой сервис: пауза между запросами. */
const PAUSE_MS = 250;

const TEMPLATES = {
    noun: 'Deutsch Substantiv Übersicht',
    verb: 'Deutsch Verb Übersicht',
    adjective: 'Deutsch Adjektiv Übersicht'
};

const GENUS = { m: 'der', f: 'die', n: 'das' };

export const wiktionary = {

    /** Состояния проверки, они же значения поля verified. */
    STATUS: {
        UNCHECKED: 0,
        OK: 1,
        MISMATCH: 2,
        NOT_FOUND: 3
    },

    /**
     * Заголовок статьи. Артикль и возвратное «sich» в Wiktionary не входят
     * в название, а существительные там всегда с большой буквы.
     */
    pageTitle: (word) => {
        let text = String(word?.word ?? '').trim();
        text = text.replace(/^(der|die|das)\s+/i, '').replace(/^sich\s+/i, '');

        // Составные записи вида «warten auf» — берём первое слово
        const first = text.split(/\s+/)[0] || '';
        if (!first) return null;

        return word?.type === 'noun'
            ? first.charAt(0).toUpperCase() + first.slice(1)
            : first;
    },

    /** Разметку статьи запрашиваем целиком: разделов немного, ответ невелик. */
    fetchWikitext: async (title) => {
        const url = `${API}?action=parse&page=${encodeURIComponent(title)}`
            + '&prop=wikitext&formatversion=2&format=json&origin=*';

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Wiktionary: HTTP ${response.status}`);

        const data = await response.json();
        if (data.error) return null;          // статьи нет — это не сбой

        return data.parse?.wikitext || null;
    },

    /** Значение параметра шаблона: снимаем вики-разметку и сноски. */
    _cleanValue: (raw) => String(raw ?? '')
        .replace(/<ref[\s\S]*?(\/>|<\/ref>)/gi, '')
        .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
        .replace(/'{2,}/g, '')
        .replace(/\{\{[^}]*\}\}/g, '')
        .trim(),

    /**
     * Все сводные шаблоны с этим именем, каждый — словарём параметров.
     *
     * Шаблон на странице не один: у омографов вроде «der See» (озеро) и
     * «die See» (море) отдельный раздел и отдельный блок форм на каждое
     * значение. Разбирая только первый, мы бы «исправляли» верную карточку
     * по формам чужого слова.
     *
     * Значения бывают с вариантами: «Dativ Singular» и «Dativ Singular*».
     */
    parseTemplates: (wikitext, name) => {
        const templates = [];
        let from = 0;

        while (true) {
            const start = wikitext.indexOf(`{{${name}`, from);
            if (start < 0) break;

            // Шаблон заканчивается «}}» на отдельной строке
            const end = wikitext.indexOf('\n}}', start);
            const body = wikitext.slice(start, end < 0 ? wikitext.length : end);
            from = end < 0 ? wikitext.length : end + 3;

            const fields = {};
            for (const line of body.split('\n')) {
                const match = line.match(/^\|([^=]+)=(.*)$/);
                if (!match) continue;

                const key = match[1].trim();
                const value = wiktionary._cleanValue(match[2]);
                if (value) fields[key] = value;
            }

            if (Object.keys(fields).length) templates.push(fields);
        }

        return templates;
    },

    /** Все значения параметра вместе с вариантами «*», «2», «3». */
    _variants: (fields, key) => Object.entries(fields)
        .filter(([k]) => k === key || k.startsWith(`${key}*`) || /^\d$/.test(k.slice(key.length).trim()))
        .map(([, v]) => v)
        .filter(Boolean),

    /** Один блок форм в сравнимом виде. */
    _readTemplate: (fields, type) => {
        if (type === 'noun') {
            const genus = (fields['Genus'] || fields['Genus 1'] || '').toLowerCase().trim();
            return {
                type,
                gender: GENUS[genus] || null,
                plural: wiktionary._variants(fields, 'Nominativ Plural'),
                dativ: wiktionary._variants(fields, 'Dativ Singular'),
                akkusativ: wiktionary._variants(fields, 'Akkusativ Singular')
            };
        }

        if (type === 'verb') {
            return {
                type,
                present: {
                    ich: fields['Präsens_ich'] || null,
                    du: fields['Präsens_du'] || null,
                    er: fields['Präsens_er, sie, es'] || fields['Präsens_er,sie,es'] || null
                },
                preterite: [fields['Präteritum_ich']].filter(Boolean),
                participle_ii: [fields['Partizip II']].filter(Boolean),
                auxiliary: (fields['Hilfsverb'] || '').split(',')[0].trim() || null,

                // Повелительное наклонение и Konjunktiv II статья отдаёт
                // наравне с остальным, а мы их выбрасывали: карточка глагола
                // из-за этого выглядела пустой на две строки
                imperativeSingular: wiktionary._variants(fields, 'Imperativ Singular'),
                imperativePlural: wiktionary._variants(fields, 'Imperativ Plural'),
                konjunktiv2: wiktionary._variants(fields, 'Konjunktiv II_ich')
            };
        }

        return {
            type,
            comparative: wiktionary._variants(fields, 'Komparativ'),
            // В шаблоне превосходная степень без «am», в словарях — с ним
            superlative: wiktionary._variants(fields, 'Superlativ').map(s => /^am\s/i.test(s) ? s : `am ${s}`)
        };
    },

    /**
     * Разбор статьи в формы, сравнимые с нашей карточкой.
     *
     * Если значений у слова несколько, выбираем блок по роду нашей карточки:
     * «das Band» сверяется с формами среднего рода (die Bänder), а не
     * мужского (die Bände). Когда род не совпал ни с одним блоком, не
     * утверждаем ничего: поправить верную карточку хуже, чем пропустить
     * неверную.
     *
     * @returns {Object|null} формы либо { ambiguous: true }
     */
    parseEntry: (wikitext, type, word = null) => {
        const templateName = TEMPLATES[type];
        if (!templateName) return null;

        const templates = wiktionary.parseTemplates(wikitext, templateName);
        if (!templates.length) return null;

        const variants = templates.map(f => wiktionary._readTemplate(f, type));
        if (variants.length === 1) return variants[0];

        if (type === 'noun') {
            const ourGender = word ? germanUtils.getGender(word) : null;
            const matching = variants.filter(v => v.gender && v.gender === ourGender);

            if (matching.length === 1) return matching[0];
            return { type, ambiguous: true };
        }

        // Несколько блоков у глагола или прилагательного — это разные
        // значения с разными формами, различить их нечем
        return { type, ambiguous: true };
    },

    /** Одно слово: разметка → разобранные формы. */
    lookup: async (word) => {
        const title = wiktionary.pageTitle(word);
        if (!title) return null;

        const wikitext = await wiktionary.fetchWikitext(title);
        if (!wikitext) return null;

        return wiktionary.parseEntry(wikitext, word.type, word);
    },

    /** Форма без артикля и лишних пробелов — для сравнения. */
    _bare: (value) => String(value ?? '')
        .replace(/^(der|die|das|dem|den|des|ein|eine|einem|einen)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),

    /** Артикль для формы: в шаблоне лежит голое слово. */
    _withArticle: (field, gender, form) => {
        if (field === 'plural') return `die ${form}`;
        if (field === 'dativ') return `${gender === 'die' ? 'der' : 'dem'} ${form}`;
        if (field === 'akkusativ') {
            return `${({ der: 'den', die: 'die', das: 'das' })[gender] || 'den'} ${form}`;
        }
        return form;
    },

    /**
     * Расхождения между карточкой и статьёй.
     *
     * Сравниваем только там, где обе стороны непусты: пустое поле — это
     * задача дозаполнения, а не ошибка. Варианты формы считаем равноправными,
     * иначе «Tisch» и устаревшее «Tische» в дательном шли бы как ошибка.
     *
     * У каждого расхождения лежит готовое исправление: набор полей для
     * записи в базу, если пользователь согласится.
     *
     * @returns {Array} [{ field, ours, theirs, fix }]
     */
    compare: (word, entry) => {
        if (!entry || entry.ambiguous) return [];

        const diffs = [];
        const gender = entry.gender || germanUtils.getGender(word);

        const check = (field, ours, accepted, fix) => {
            const mine = wiktionary._bare(ours);
            const theirs = (Array.isArray(accepted) ? accepted : [accepted]).filter(Boolean);
            if (!mine || !theirs.length) return;
            if (theirs.some(v => wiktionary._bare(v) === mine)) return;

            const correct = wiktionary._withArticle(field, gender, theirs[0]);
            diffs.push({ field, ours: String(ours).trim(), theirs: correct, fix: fix ? fix(theirs[0]) : { [field]: correct } });
        };

        if (entry.type === 'noun') {
            const ourGender = germanUtils.getGender(word);
            if (ourGender && entry.gender && ourGender !== entry.gender) {
                // Артикль стоит и в самом слове — исправляем оба места,
                // иначе карточка осталась бы противоречивой
                const base = germanUtils.parseNoun(word.word).base;
                diffs.push({
                    field: 'gender',
                    ours: `${ourGender} ${base}`,
                    theirs: `${entry.gender} ${base}`,
                    fix: { gender: entry.gender, word: `${entry.gender} ${base}` }
                });
            }
            check('plural', word.plural, entry.plural);
            check('dativ', word.dativ, entry.dativ);
            check('akkusativ', word.akkusativ, entry.akkusativ);
        } else if (entry.type === 'verb') {
            const conjugation = germanUtils.getConjugation(word) || {};
            for (const person of ['ich', 'du', 'er']) {
                check(`präsens_${person}`, conjugation[person], entry.present?.[person],
                    (form) => ({ conjugation: { ...conjugation, [person]: form } }));
            }
            check('preterite', word.preterite, entry.preterite);
            check('participle_ii', word.participle_ii, entry.participle_ii);
            check('auxiliary', word.auxiliary, entry.auxiliary);
            check('imperative_singular', word.imperative_singular, entry.imperativeSingular);
            check('imperative_plural', word.imperative_plural, entry.imperativePlural);
            check('konjunktiv2', word.konjunktiv2, entry.konjunktiv2);
        } else {
            check('comparative', word.comparative, entry.comparative);
            check('superlative', word.superlative, entry.superlative);
        }

        return diffs;
    },

    /**
     * Чем можно закрыть пустые поля карточки.
     * Артикли подставляем сами: в шаблоне лежат голые формы.
     */
    fillFrom: (word, entry) => {
        // У многозначного слова формы разных значений различаются
        // (die Bände против die Bänder) — заполнять наугад нельзя
        if (!entry || entry.ambiguous) return {};

        const changes = {};
        const empty = (v) => !String(v ?? '').trim();

        if (entry.type === 'noun') {
            // Род статьи главнее нашего: если он разошёлся, подставлять
            // артикли по своему было бы закреплением ошибки
            const gender = entry.gender || germanUtils.getGender(word);

            if (!germanUtils.getGender(word) && entry.gender) changes.gender = entry.gender;
            if (empty(word.plural) && entry.plural[0]) changes.plural = wiktionary._withArticle('plural', gender, entry.plural[0]);
            if (empty(word.dativ) && entry.dativ[0]) changes.dativ = wiktionary._withArticle('dativ', gender, entry.dativ[0]);
            if (empty(word.akkusativ) && entry.akkusativ[0]) changes.akkusativ = wiktionary._withArticle('akkusativ', gender, entry.akkusativ[0]);
        } else if (entry.type === 'verb') {
            if (empty(word.preterite) && entry.preterite[0]) changes.preterite = entry.preterite[0];
            if (empty(word.participle_ii) && entry.participle_ii[0]) changes.participle_ii = entry.participle_ii[0];
            if (empty(word.auxiliary) && entry.auxiliary) changes.auxiliary = entry.auxiliary;
            if (empty(word.imperative_singular) && entry.imperativeSingular[0]) changes.imperative_singular = entry.imperativeSingular[0];
            if (empty(word.imperative_plural) && entry.imperativePlural[0]) changes.imperative_plural = entry.imperativePlural[0];
            if (empty(word.konjunktiv2) && entry.konjunktiv2[0]) changes.konjunktiv2 = entry.konjunktiv2[0];

            // Спряжение дополняем по лицам: в шаблоне их три из шести,
            // остальные останутся за моделью
            const current = germanUtils.getConjugation(word) || {};
            const merged = { ...current };
            let touched = false;

            for (const person of ['ich', 'du', 'er']) {
                if (!current[person] && entry.present?.[person]) {
                    merged[person] = entry.present[person];
                    touched = true;
                }
            }

            if (touched) changes.conjugation = merged;
        } else {
            if (empty(word.comparative) && entry.comparative[0]) changes.comparative = entry.comparative[0];
            if (empty(word.superlative) && entry.superlative[0]) changes.superlative = entry.superlative[0];
        }

        return changes;
    },

    /**
     * Сверка карточек до сохранения в базу.
     *
     * Раньше ошибку модели можно было заметить только после того, как слово
     * попало в план и его несколько дней учили неправильно. Здесь неверные
     * формы правятся сразу, а пустые заполняются — и то и другое бесплатно.
     *
     * Карточки меняются на месте.
     *
     * @param {Array} cards карточки от ИИ, ещё не в базе
     * @param {Function} onProgress (обработано, всего)
     * @returns {Promise<{fixed:number, filled:number, unchecked:number}>}
     */
    enrich: async (cards, onProgress = null) => {
        let fixed = 0, filled = 0, unchecked = 0;

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];

            if (['noun', 'verb', 'adjective'].includes(card.type)) {
                try {
                    const entry = await wiktionary.lookup(card);

                    if (!entry) {
                        card.verified = wiktionary.STATUS.NOT_FOUND;
                    } else {
                        const fill = wiktionary.fillFrom(card, entry);
                        if (Object.keys(fill).length) { Object.assign(card, fill); filled++; }

                        const diffs = wiktionary.compare(card, entry);
                        if (diffs.length) {
                            for (const diff of diffs) Object.assign(card, diff.fix || {});
                            fixed++;
                        }

                        card.verified = wiktionary.STATUS.OK;
                        card.mismatches = [];
                    }

                    card.verifiedAt = Date.now();
                } catch (e) {
                    // Сеть отвалилась — слово просто остаётся непроверенным
                    // и попадёт в общую очередь сверки
                    console.error('[Wiktionary] Не сверилось при генерации:', card.word, e);
                    card.verified = wiktionary.STATUS.UNCHECKED;
                    unchecked++;
                }
            }

            if (onProgress) onProgress(i + 1, cards.length);
            if (i < cards.length - 1) await new Promise(r => setTimeout(r, PAUSE_MS));
        }

        return { fixed, filled, unchecked };
    },

    /**
     * Итог сверки словами.
     *
     * Разметку собирает вызывающий модуль, здесь только текст и признак
     * «есть о чём беспокоиться» — иначе одна и та же логика разъехалась бы
     * по экрану темы и экрану добавления.
     *
     * @returns {{text: string, alarming: boolean}|null}
     */
    summary: (check) => {
        if (!check) return null;

        const parts = [];
        if (check.fixed) parts.push(t('cycle.checkFixed', { count: check.fixed }));
        if (check.filled) parts.push(t('cycle.checkFilled', { count: check.filled }));
        if (check.unchecked) parts.push(t('cycle.checkUnchecked', { count: check.unchecked }));

        return {
            text: parts.length ? parts.join(' · ') : t('cycle.checkClean'),
            alarming: check.fixed > 0 || check.unchecked > 0
        };
    },

    /**
     * Проверка списка слов подряд.
     *
     * @param {Array} words слова из базы
     * @param {Function} onProgress (обработано, всего, слово)
     * @returns {Promise<Array>} [{ word, status, diffs, fill }]
     */
    checkAll: async (words, onProgress = null) => {
        const results = [];

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            let result = { word, status: wiktionary.STATUS.NOT_FOUND, diffs: [], fill: {} };

            try {
                const entry = await wiktionary.lookup(word);
                if (entry) {
                    const diffs = wiktionary.compare(word, entry);
                    result = {
                        word,
                        status: diffs.length ? wiktionary.STATUS.MISMATCH : wiktionary.STATUS.OK,
                        diffs,
                        fill: wiktionary.fillFrom(word, entry)
                    };
                }
            } catch (e) {
                // Обрыв сети — это не «статьи нет»: оставляем слово
                // непроверенным, иначе после одной попытки без интернета
                // оно навсегда выпало бы из очереди на сверку
                console.error('[Wiktionary] Сбой проверки:', word.word, e);
                result.status = wiktionary.STATUS.UNCHECKED;
                result.error = String(e.message || e);
            }

            results.push(result);
            if (onProgress) onProgress(i + 1, words.length, word);

            if (i < words.length - 1) await new Promise(r => setTimeout(r, PAUSE_MS));
        }

        return results;
    }
};
