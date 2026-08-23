import { config } from '../config.js';
import { dateUtils } from './dates.js';
import { t } from '../i18n/i18n.js';

/**
 * Напоминание о занятии (§41 ТЗ, часть без сервера).
 *
 * Честная граница возможного: полноценные push требуют сервера, который
 * разбудит устройство, — а весь смысл проекта в том, чтобы обходиться без
 * серверов. Поэтому здесь то, что работает на одной статике:
 *
 *   - пока приложение открыто, в назначенное время приходит уведомление;
 *   - при возвращении в приложение проверяется, не пропущен ли сегодняшний
 *     план, и если время уже прошло — напоминание показывается сразу.
 *
 * Чего это не умеет: разбудить закрытое приложение. Об этом сказано прямо
 * в настройках, чтобы напоминание не выглядело сломанным.
 */

const ENABLED_KEY = 'reminder_enabled';
const TIME_KEY = 'reminder_time';
const SHOWN_KEY = 'reminder_shown';

let timer = null;

export const reminder = {

    DEFAULT_TIME: '19:00',

    isSupported: () => typeof window !== 'undefined' && 'Notification' in window,

    isEnabled: () => config.get(ENABLED_KEY) === '1',

    /** Время в формате ЧЧ:ММ. */
    getTime: () => config.get(TIME_KEY) || reminder.DEFAULT_TIME,

    permission: () => (reminder.isSupported() ? Notification.permission : 'unsupported'),

    /**
     * Включение: спрашиваем разрешение и запоминаем выбор.
     * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
     */
    enable: async (time) => {
        if (!reminder.isSupported()) return 'unsupported';

        const permission = Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();

        if (permission !== 'granted') {
            config.set(ENABLED_KEY, '0');
            return permission;
        }

        config.set(ENABLED_KEY, '1');
        config.set(TIME_KEY, time || reminder.getTime());
        reminder.schedule();

        return 'granted';
    },

    disable: () => {
        config.set(ENABLED_KEY, '0');
        if (timer) { clearTimeout(timer); timer = null; }
    },

    /** Сегодняшнее напоминание уже показывали. */
    _shownToday: () => config.get(SHOWN_KEY) === dateUtils.today(),
    _markShown: () => config.set(SHOWN_KEY, dateUtils.today()),

    /**
     * Ставит таймер на ближайшее назначенное время.
     * Вызывается при запуске и при возвращении в приложение.
     */
    schedule: () => {
        if (timer) { clearTimeout(timer); timer = null; }
        if (!reminder.isEnabled() || reminder.permission() !== 'granted') return;

        const [hours, minutes] = reminder.getTime().split(':').map(Number);
        const now = new Date();
        const target = new Date();
        target.setHours(hours || 0, minutes || 0, 0, 0);

        // Время уже прошло: показываем сразу, если сегодня ещё не показывали,
        // и ждём завтрашнего
        if (target <= now) {
            if (!reminder._shownToday()) reminder.fire();
            target.setDate(target.getDate() + 1);
        }

        const delay = target - now;

        // setTimeout на сутки вперёд ненадёжен, а вкладка столько и не живёт:
        // ограничиваем шестью часами и переставляем таймер заново
        timer = setTimeout(reminder.schedule, Math.min(delay, 6 * 60 * 60 * 1000));
    },

    /**
     * Показ уведомления, если план на сегодня ещё не пройден.
     * Проверку плана передаём снаружи: ядро не должно знать про расписание.
     */
    checkPlan: null,

    fire: async () => {
        if (reminder.permission() !== 'granted') return false;

        // Незачем напоминать тому, кто уже позанимался
        if (reminder.checkPlan) {
            try {
                const pending = await reminder.checkPlan();
                if (!pending) return false;
            } catch (e) {
                console.error('[Напоминание] Не удалось проверить план:', e);
            }
        }

        reminder._markShown();

        try {
            new Notification(t('reminder.title'), {
                body: t('reminder.body'),
                icon: 'assets/icon-192.png',
                badge: 'assets/icon-192.png',
                tag: 'wortschatz-daily'
            });
            return true;
        } catch (e) {
            console.error('[Напоминание] Не удалось показать уведомление:', e);
            return false;
        }
    }
};
