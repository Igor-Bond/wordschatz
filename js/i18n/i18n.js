/**
 * Строки интерфейса (§33 ТЗ).
 *
 * Приложение русскоязычное, и выбор языка из него убран. Раньше здесь
 * жили три словаря, переключатель в настройках и шаг в первом запуске —
 * а пользовался всем этим один человек, для которого русский и был
 * родным. Английский с украинским существовали как обещание, которое
 * никто не собирался востребовать, и стоили полутора тысяч строк
 * перевода, требующих сопровождения при каждой новой надписи.
 *
 * Хуже того, переключение было ловушкой: интерфейс менял язык, а уже
 * сохранённые переводы слов оставались на прежнем. Словарь после
 * переключения оказывался смешанным, и починить это можно было только
 * перезаписью всех карточек. Предупреждение об этом висело в настройках
 * рядом с самим переключателем.
 *
 * Что осталось:
 *   - t('ключ') — строка, синхронно: её подставляют в шаблонные строки
 *     при сборке разметки, поэтому обещание тут не годится;
 *   - t('ключ', { count: 5 }) — подстановка параметров вида {count};
 *   - plural('ключ', 5) — форма числа по правилам русского через
 *     Intl.PluralRules: «1 день / 2 дня / 5 дней»;
 *   - неизвестный ключ не роняет экран: возвращается сам ключ, а в
 *     консоль уходит предупреждение.
 */

import { ru } from './ru.js';

const LANGUAGE = 'ru';

/** Как называть язык пользователя в промптах к ИИ. */
const AI_LANGUAGE = { target: 'русский', targetAcc: 'русский язык', name: 'Russian' };

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

    /** Код языка — нужен Intl для дат и разбору статей Wiktionary. */
    get language() {
        return LANGUAGE;
    },

    aiLanguage: () => AI_LANGUAGE,

    t(key, params) {
        const value = lookup(ru, key);

        if (value === undefined) {
            if (!missingKeys.has(key)) {
                missingKeys.add(key);
                console.warn(`[i18n] Нет строки для ключа: ${key}`);
            }
            return key;
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
        const forms = lookup(ru, key);

        if (!forms || typeof forms !== 'object') {
            return i18n.t(key, { count, ...params });
        }

        const rule = new Intl.PluralRules(LANGUAGE).select(count);
        const template = forms[rule] ?? forms.other ?? forms.many ?? forms.one;

        return substitute(template, { count, ...params });
    },

    /**
     * Подставляет строки в статическую разметку index.html.
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

    /** Ключи, которых не нашлось — удобно для проверки полноты словаря. */
    getMissingKeys: () => [...missingKeys]
};

export const t = (key, params) => i18n.t(key, params);
export const plural = (key, count, params) => i18n.plural(key, count, params);
