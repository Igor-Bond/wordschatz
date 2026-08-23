import { firebaseConfig } from '../firebase.config.js';
import { t } from '../i18n/i18n.js';

/**
 * Вход через Google и доступ к Firestore (§37 ТЗ).
 *
 * SDK подключается динамическим import при первом обращении. Статические
 * импорты тянули бы почти мегабайт при каждом запуске — в том числе тем,
 * кто в аккаунт вообще не входит и работает локально.
 *
 * Всплывающее окно входа блокируется в некоторых браузерах и не работает
 * в установленном PWA, поэтому при неудаче уходим на вход переходом по адресу.
 */

let sdk = null;              // загруженные модули Firebase
let firebaseApp = null;
let authInstance = null;
let firestoreInstance = null;

const listeners = new Set();
let currentUser = null;
let initialised = false;

export const auth = {

    /** Настроен ли Firebase вообще. */
    isConfigured: () => !!firebaseConfig?.apiKey && !!firebaseConfig?.projectId,

    /** Текущий пользователь или null. */
    get user() {
        return currentUser;
    },

    get isSignedIn() {
        return !!currentUser;
    },

    /** Загрузка SDK и подъём приложения — только когда действительно нужно. */
    _init: async () => {
        if (firebaseApp) return sdk;

        if (!auth.isConfigured()) {
            throw new Error(t('auth.notConfigured'));
        }

        const [appModule, authModule, storeModule] = await Promise.all([
            import('../../vendor/firebase/firebase-app.js'),
            import('../../vendor/firebase/firebase-auth.js'),
            import('../../vendor/firebase/firebase-firestore.js')
        ]);

        sdk = { ...appModule, ...authModule, ...storeModule };

        firebaseApp = sdk.initializeApp(firebaseConfig);
        authInstance = sdk.getAuth(firebaseApp);
        firestoreInstance = sdk.getFirestore(firebaseApp);

        return sdk;
    },

    /** Firestore и функции работы с ним — для модуля синхронизации. */
    getDb: async () => {
        await auth._init();
        return { db: firestoreInstance, fs: sdk };
    },

    /**
     * Подписка на состояние входа.
     * Возвращает функцию отписки; текущее состояние отдаётся сразу.
     */
    onChange: (callback) => {
        listeners.add(callback);
        callback(currentUser);
        return () => listeners.delete(callback);
    },

    _notify: (user) => {
        currentUser = user;
        listeners.forEach(cb => {
            try { cb(user); } catch (e) { console.error('[Авторизация] Ошибка слушателя:', e); }
        });
    },

    /**
     * Признак прошлого входа.
     *
     * Своя пометка нужна потому, что узнать о сессии у Firebase можно только
     * подняв SDK — а это почти мегабайт при каждом запуске у тех, кто
     * в аккаунт не входил вовсе.
     */
    SIGNED_IN_KEY: 'ws_cloud_signed_in',

    _rememberSignIn: (value) => {
        if (value) localStorage.setItem(auth.SIGNED_IN_KEY, '1');
        else localStorage.removeItem(auth.SIGNED_IN_KEY);
    },

    hasSignedInBefore: () => localStorage.getItem(auth.SIGNED_IN_KEY) === '1',

    /**
     * Восстановление сессии при запуске.
     * Если пользователь раньше не входил — SDK не трогаем совсем.
     */
    restore: async () => {
        if (initialised || !auth.isConfigured() || !auth.hasSignedInBefore()) return null;
        initialised = true;

        try {
            await auth._init();
            await sdk.setPersistence(authInstance, sdk.browserLocalPersistence);

            // Возврат после входа переходом по адресу
            await sdk.getRedirectResult(authInstance).catch(() => null);

            return await new Promise(resolve => {
                const unsubscribe = sdk.onAuthStateChanged(authInstance, user => {
                    auth._notify(user);
                    unsubscribe();
                    resolve(user);
                });
            });
        } catch (e) {
            console.error('[Авторизация] Не удалось восстановить сессию:', e);
            return null;
        }
    },

    /** Вход через Google. */
    signIn: async () => {
        await auth._init();
        await sdk.setPersistence(authInstance, sdk.browserLocalPersistence);

        const provider = new sdk.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
            const result = await sdk.signInWithPopup(authInstance, provider);
            auth._rememberSignIn(true);
            auth._notify(result.user);
            return result.user;
        } catch (e) {
            // Всплывающее окно заблокировано или недоступно в установленном
            // PWA — уходим на вход переходом, страница вернётся сама
            if (auth._popupUnavailable(e)) {
                console.warn('[Авторизация] Всплывающее окно недоступно, переходим по адресу.');
                // Помечаем заранее: после возврата страница должна поднять сессию
                auth._rememberSignIn(true);
                await sdk.signInWithRedirect(authInstance, provider);
                return null;
            }
            throw auth._describe(e);
        }
    },

    signOut: async () => {
        auth._rememberSignIn(false);
        if (!authInstance) return;

        await sdk.signOut(authInstance);
        auth._notify(null);
    },

    _popupUnavailable: (e) => [
        'auth/popup-blocked',
        'auth/operation-not-supported-in-this-environment',
        'auth/cancelled-popup-request'
    ].includes(e?.code),

    /** Понятный текст вместо кода ошибки Firebase. */
    _describe: (e) => {
        const map = {
            'auth/popup-closed-by-user': 'auth.popupClosed',
            'auth/network-request-failed': 'auth.network',
            'auth/unauthorized-domain': 'auth.unauthorizedDomain',
            'auth/too-many-requests': 'auth.tooManyRequests'
        };

        const key = map[e?.code];
        const error = new Error(key ? t(key) : (e?.message || t('auth.unknown')));
        error.code = e?.code;
        return error;
    }
};
