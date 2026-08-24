import { auth } from '../services/auth.js';
import { config } from '../config.js';
import { t } from '../i18n/i18n.js';

/**
 * Уведомление на закрытое приложение (§41 ТЗ).
 *
 * Локального будильника у веба нет: `setTimeout` живёт ровно столько,
 * сколько живёт вкладка, а расписание уведомлений (`TimestampTrigger`)
 * в Chrome было опытной функцией и убрано. Разбудить закрытое приложение
 * может только сообщение снаружи.
 *
 * Устройство подписывается здесь, подписка ложится в Firestore рядом с
 * остальными данными пользователя, а раз в сутки её забирает расписание
 * GitHub Actions и отправляет push. Для публичного репозитория это
 * бесплатно, и своего сервера не появляется.
 *
 * Что честно сказать про ограничения:
 *   - на Android приходит на закрытое приложение;
 *   - на iOS — только если приложение добавлено на домашний экран;
 *   - на компьютере — пока запущен браузер;
 *   - расписание GitHub идёт по UTC и опаздывает на пять–двадцать минут.
 *
 * Ключ VAPID здесь публичный — он для того и нужен, чтобы лежать в коде.
 * Закрытая половина живёт в секретах репозитория и сюда не попадает.
 */

const ENABLED_KEY = 'push_enabled';

export const push = {

    /**
     * Публичная половина пары VAPID.
     * Пусто — значит push ещё не настроен, и кнопка не показывается.
     */
    PUBLIC_KEY: 'BBGaQF_P-_yo-vyW6hwsltlkwQlUAxUt0JMcJRZyP0wIO5PNhqZfexX4pK2IEe_JPHCvS0FcXSHsIsXrTKxpuPU',

    isSupported: () => typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window,

    /** Настроен ли push вообще: нужен ключ и вход в аккаунт. */
    isConfigured: () => !!push.PUBLIC_KEY && auth.isConfigured(),

    isEnabled: () => config.get(ENABLED_KEY) === '1',

    /** Ключ приходит строкой base64url, а PushManager хочет байты. */
    _keyToBytes: (base64) => {
        const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4))
            .replace(/-/g, '+').replace(/_/g, '/');

        const raw = atob(padded);
        return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    },

    /** Подписка в виде, пригодном для хранения и отправки. */
    _serialise: (subscription) => {
        const json = subscription.toJSON();
        return {
            endpoint: json.endpoint,
            keys: json.keys,
            // По ним отправитель поймёт, чьё это устройство и не пора ли
            // выкинуть протухшую запись
            userAgent: navigator.userAgent.slice(0, 200),
            updatedAt: Date.now()
        };
    },

    /**
     * Ключ документа: из адреса подписки, а не случайный.
     * Так повторная подписка того же устройства не плодит записей.
     */
    _docId: (endpoint) => {
        let hash = 0;
        for (let i = 0; i < endpoint.length; i++) {
            hash = (hash * 31 + endpoint.charCodeAt(i)) | 0;
        }
        return 'sub' + Math.abs(hash).toString(36);
    },

    /**
     * Включение: разрешение, подписка, запись в облако.
     * @returns {Promise<{ok: boolean, reason?: string}>}
     */
    enable: async () => {
        if (!push.isSupported()) return { ok: false, reason: t('push.unsupported') };
        if (!push.isConfigured()) return { ok: false, reason: t('push.notConfigured') };
        if (!auth.isSignedIn) return { ok: false, reason: t('push.needSignIn') };

        const permission = Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();

        if (permission !== 'granted') return { ok: false, reason: t('push.denied') };

        const registration = await navigator.serviceWorker.ready;

        // Повторная подписка возвращает ту же — это нормально
        const subscription = await registration.pushManager.getSubscription()
            || await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: push._keyToBytes(push.PUBLIC_KEY)
            });

        await push._store(push._serialise(subscription));

        config.set(ENABLED_KEY, '1');
        return { ok: true };
    },

    disable: async () => {
        config.set(ENABLED_KEY, '0');

        if (!push.isSupported()) return;

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        await push._remove(subscription.endpoint).catch(e =>
            console.error('[Push] Не удалось убрать подписку из облака:', e));

        await subscription.unsubscribe();
    },

    /** Подписка лежит рядом с остальными данными пользователя. */
    _store: async (data) => {
        const ctx = await auth.getDb();
        const ref = ctx.fs.doc(ctx.db, 'users', auth.user.uid, 'pushSubscriptions', push._docId(data.endpoint));
        await ctx.fs.setDoc(ref, data);
    },

    _remove: async (endpoint) => {
        if (!auth.isSignedIn) return;

        const ctx = await auth.getDb();
        const ref = ctx.fs.doc(ctx.db, 'users', auth.user.uid, 'pushSubscriptions', push._docId(endpoint));
        await ctx.fs.deleteDoc(ref);
    },

    /**
     * Состояние для настроек: включено ли, и если нет — почему нельзя.
     * Отдельная функция, чтобы интерфейс не гадал.
     */
    status: async () => {
        if (!push.isSupported()) return { available: false, reason: t('push.unsupported') };
        if (!push.isConfigured()) return { available: false, reason: t('push.notConfigured') };
        if (!auth.isSignedIn) return { available: false, reason: t('push.needSignIn') };
        if (Notification.permission === 'denied') return { available: false, reason: t('push.blocked') };

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return { available: true, active: !!subscription && push.isEnabled() };
    }
};
