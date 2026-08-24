/**
 * Локализация интерфейса (§33 ТЗ).
 *
 * Переключатель языка в настройках существовал с самого начала, но ничего
 * не делал: строки были вшиты в разметку по-русски.
 *
 * Как устроено:
 *   - t('ключ') возвращает строку текущего языка, синхронно — иначе её
 *     нельзя подставить в шаблонную строку при сборке разметки;
 *   - t('ключ', { count: 5 }) подставляет параметры вида {count};
 *   - plural('ключ', 5) выбирает форму по правилам языка через Intl.PluralRules:
 *     «1 день / 2 дня / 5 дней» в русском, «1 day / 2 days» в английском;
 *   - неизвестный ключ не роняет экран: берётся русский вариант, а если нет
 *     и его — сам ключ, и в консоль уходит предупреждение.
 *
 * Смена языка требует перезагрузки страницы: разметка собирается строками
 * при рендере, живой перерисовки всех экранов нет.
 */

import { ru } from './ru.js';
import { uk } from './uk.js';
import { en } from './en.js';

const LOCALES = { ru, uk, en };
const FALLBACK = 'ru';

export const LANGUAGES = [
    { code: 'ru', label: 'Русский' },
    { code: 'uk', label: 'Українська' },
    { code: 'en', label: 'English' }
];

/** Язык, на который ИИ переводит слова и на котором обращается к пользователю. */
const AI_LANGUAGE_NAMES = {
    ru: { target: 'русский', targetAcc: 'русский язык', name: 'Russian' },
    uk: { target: 'українську', targetAcc: 'українську мову', name: 'Ukrainian' },
    en: { target: 'English', targetAcc: 'English', name: 'English' }
};

let currentLanguage = FALLBACK;
const missingKeys = new Set();

/** Достаёт значение по пути вида 'dashboard.hello'. */
function lookup(dict, key) {
    return key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), dict);
}

function substitute(template, params) {
    if (!params) return template;
    return String(template).replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match
    );
}

export const i18n = {

    get language() {
        return currentLanguage;
    },

    setLanguage(code) {
        currentLanguage = LOCALES[code] ? code : FALLBACK;
        document.documentElement.lang = currentLanguage;
        return currentLanguage;
    },

    isSupported: (code) => !!LOCALES[code],

    /** Как называть язык пользователя в промптах к ИИ. */
    aiLanguage: () => AI_LANGUAGE_NAMES[currentLanguage] || AI_LANGUAGE_NAMES[FALLBACK],

    t(key, params) {
        let value = lookup(LOCALES[currentLanguage], key);

        if (value === undefined) {
            value = lookup(LOCALES[FALLBACK], key);
            if (value === undefined) {
                if (!missingKeys.has(key)) {
                    missingKeys.add(key);
                    console.warn(`[i18n] Нет перевода для ключа: ${key}`);
                }
                return key;
            }
        }

        // Для ключей с формами множественного числа нужен plural(), а не t()
        if (value && typeof value === 'object') return key;

        return substitute(value, params);
    },

    /**
     * Форма множественного числа.
     * В словаре ключ хранится объектом: { one, few, many, other }.
     */
    plural(key, count, params) {
        const forms = lookup(LOCALES[currentLanguage], key) || lookup(LOCALES[FALLBACK], key);

        if (!forms || typeof forms !== 'object') {
            return i18n.t(key, { count, ...params });
        }

        const rule = new Intl.PluralRules(currentLanguage).select(count);
        const template = forms[rule] ?? forms.other ?? forms.many ?? forms.one;

        return substitute(template, { count, ...params });
    },

    /**
     * Подставляет переводы в статическую разметку index.html.
     *   data-i18n            → текст элемента
     *   data-i18n-html       → разметка элемента
     *   data-i18n-placeholder → атрибут placeholder
     */
    applyToDom(root = document) {
        root.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = i18n.t(el.dataset.i18n);
        });
        root.querySelectorAll('[data-i18n-html]').forEach(el => {
            el.innerHTML = i18n.t(el.dataset.i18nHtml);
        });
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = i18n.t(el.dataset.i18nPlaceholder);
        });
        root.querySelectorAll('[data-i18n-content]').forEach(el => {
            el.setAttribute('content', i18n.t(el.dataset.i18nContent));
        });

        // Подписи для экранного чтеца. Нужны там, где на кнопке только
        // значок: «плюс» и крестик закрытия читались как «кнопка» и
        // ничего не говорили о том, что произойдёт
        root.querySelectorAll('[data-i18n-aria]').forEach(el => {
            el.setAttribute('aria-label', i18n.t(el.dataset.i18nAria));
        });
    },

    /** Список ключей, которых не нашлось — удобно для проверки полноты перевода. */
    getMissingKeys: () => [...missingKeys]
};

export const t = (key, params) => i18n.t(key, params);
export const plural = (key, count, params) => i18n.plural(key, count, params);
