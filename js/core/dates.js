import { i18n } from '../i18n/i18n.js';

/**
 * Работа с датами учебного плана.
 *
 * Везде используется ЛОКАЛЬНАЯ дата в формате YYYY-MM-DD.
 * Раньше в коде встречался `new Date().toISOString().split('T')[0]` — это UTC,
 * и для пользователя в UTC+3 сразу после полуночи он возвращал вчерашний день:
 * план дня и состояние урока разъезжались.
 */
export const dateUtils = {

    /** Локальная дата в формате YYYY-MM-DD. */
    toKey: (date = new Date()) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    /** Сегодняшняя дата в формате YYYY-MM-DD. */
    today: () => dateUtils.toKey(new Date()),

    /** Дата через N дней (N может быть отрицательным). */
    addDays: (dateKey, days) => {
        const [y, m, d] = dateKey.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + days);
        return dateUtils.toKey(date);
    },

    /** Разница в днях между двумя датами-ключами (b - a). */
    diffDays: (a, b) => {
        const [ay, am, ad] = a.split('-').map(Number);
        const [by, bm, bd] = b.split('-').map(Number);
        const dateA = new Date(ay, am - 1, ad);
        const dateB = new Date(by, bm - 1, bd);
        return Math.round((dateB - dateA) / 86400000);
    },

    /** Человекочитаемая дата: «23 августа», «23 серпня», «August 23». */
    format: (dateKey) => {
        const [y, m, d] = dateKey.split('-').map(Number);
        const date = new Date(y, m - 1, d);

        return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(date);
    }
};
