import { config } from '../config.js';

/**
 * Полноэкранный режим по требованию (§36 ТЗ, оформление).
 *
 * Зачем. На Android снизу остаётся системная панель жестов, и в светлой
 * системной теме она белая. Приложение её не рисует и покрасить не может:
 * измерения с устройства показали, что браузер отдаёт странице 745 точек
 * из 800, а безопасная зона равна нулю — этой области для страницы просто
 * не существует. Единственный способ убрать полосу из веба — попросить
 * систему спрятать панели целиком.
 *
 * Через манифест это делается сразу и навсегда, но вместе с нижней
 * панелью пропадает верхняя, а с ней часы и заряд. Поэтому здесь то же
 * самое, но выключателем: хочешь — прячешь, не хочешь — живёшь с полосой
 * и часами.
 *
 * Ограничение честное: войти в полноэкранный режим браузер разрешает
 * только по действию человека. Восстановить его при запуске нельзя —
 * поэтому после перезапуска ждём первого касания.
 */

const KEY = 'fullscreen_enabled';

let ждёмКасания = false;

const элемент = () => document.documentElement;

export const fullscreen = {

    isSupported: () => typeof document !== 'undefined'
        && !!(элемент().requestFullscreen || элемент().webkitRequestFullscreen),

    isActive: () => !!(document.fullscreenElement || document.webkitFullscreenElement),

    isEnabled: () => config.get(KEY) === '1',

    /** Вход. Возвращает false, если браузер отказал. */
    enter: async () => {
        if (!fullscreen.isSupported() || fullscreen.isActive()) return fullscreen.isActive();

        try {
            const el = элемент();
            if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
            else await el.webkitRequestFullscreen();
            return true;
        } catch (e) {
            console.warn('[Полный экран] Браузер отказал:', e.message);
            return false;
        }
    },

    exit: async () => {
        if (!fullscreen.isActive()) return;

        try {
            if (document.exitFullscreen) await document.exitFullscreen();
            else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        } catch (e) {
            console.warn('[Полный экран] Не удалось выйти:', e.message);
        }
    },

    /** Переключение из настроек. Запоминает выбор. */
    toggle: async (нужен) => {
        config.set(KEY, нужен ? '1' : '0');

        if (нужен) return await fullscreen.enter();

        await fullscreen.exit();
        return false;
    },

    /**
     * Восстановление после запуска.
     *
     * Сразу нельзя: без действия человека браузер откажет. Поэтому
     * подписываемся на первое касание и снимаем подписку тут же — второй
     * попытки не будет, чтобы приложение не лезло в полный экран
     * посреди работы, если человек вышел из него системным жестом.
     */
    restore: () => {
        if (!fullscreen.isEnabled() || !fullscreen.isSupported()) return;
        if (fullscreen.isActive() || ждёмКасания) return;

        ждёмКасания = true;

        const однажды = () => {
            document.removeEventListener('pointerdown', однажды);
            ждёмКасания = false;
            fullscreen.enter();
        };

        document.addEventListener('pointerdown', однажды, { once: true });
    }
};
