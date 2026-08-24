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

    /**
     * Подъём той части SDK, которая нужна для входа: app и auth, 255 КБ.
     *
     * Firestore сюда не входит намеренно. Раньше вход тянул все три файла
     * разом — 923 КБ, — и на первом входе с телефона это стоило секунд.
     * Всплывающее окно за это время успевало стать заблокированным:
     * разрешение на window.open живёт доли секунды после нажатия и ожидания
     * не переживает. Второй раз всё работало, потому что файлы уже в кэше, —
     * из-за этого ошибка и выглядела необъяснимой.
     */
    _initAuth: async () => {
        if (authInstance) return sdk;

        if (!auth.isConfigured()) {
            throw new Error(t('auth.notConfigured'));
        }

        const [appModule, authModule] = await Promise.all([
            import('../../vendor/firebase/firebase-app.js'),
            import('../../vendor/firebase/firebase-auth.js')
        ]);

        sdk = { ...sdk, ...appModule, ...authModule };

        firebaseApp = firebaseApp || sdk.initializeApp(firebaseConfig);
        authInstance = sdk.getAuth(firebaseApp);

        return sdk;
    },

    /** Дополнительно Firestore — нужен только синхронизации. */
    _initStore: async () => {
        await auth._initAuth();
        if (firestoreInstance) return sdk;

        const storeModule = await import('../../vendor/firebase/firebase-firestore.js');
        sdk = { ...sdk, ...storeModule };
        firestoreInstance = sdk.getFirestore(firebaseApp);

        return sdk;
    },

    /**
     * Тихая предзагрузка перед тем, как пользователь дотянется до кнопки.
     *
     * Вызывается при показе экрана со входом. Ошибку глотаем: это
     * подготовка, а не действие, и падать ей незачем — кнопка всё равно
     * загрузит нужное сама, просто медленнее.
     */
    warmUp: () => {
        if (!auth.isConfigured() || authInstance) return;
        auth._initAuth().catch(() => {});
    },

    /** Firestore и функции работы с ним — для модуля синхронизации. */
    getDb: async () => {
        await auth._initStore();
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
     * Пометка «мы только что уходили на вход переходом по адресу».
     *
     * Нужна, чтобы не обвинять вход в неудаче там, где его и не было:
     * сообщение «вход не завершился» получал всякий, у кого просто остался
     * незаконченный первый запуск.
     */
    REDIRECT_KEY: 'ws_cloud_redirect_pending',

    /** Забирает пометку: второй раз она уже не сработает. */
    takeRedirectFlag: () => {
        const был = localStorage.getItem(auth.REDIRECT_KEY) === '1';
        localStorage.removeItem(auth.REDIRECT_KEY);
        return был;
    },

    /**
     * Восстановление сессии при запуске.
     * Если пользователь раньше не входил — SDK не трогаем совсем.
     */
    restore: async () => {
        if (initialised || !auth.isConfigured() || !auth.hasSignedInBefore()) return null;
        initialised = true;

        try {
            await auth._initAuth();
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
        await auth._initAuth();
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
                // На Safari вход переходом до конца не доходит: он уводит на
                // домен Firebase и возвращается обратно, а прочитать своё
                // же состояние SDK уже не может — хранилище разделено по
                // доменам. Лечится это размещением обработчика входа на
                // своём домене, чего GitHub Pages не умеет. Поэтому там,
                // где переход заведомо не сработает, честнее сказать прямо,
                // чем уводить человека и вернуть его ни с чем
                if (!auth._redirectCanWork()) {
                    const error = new Error(t('auth.popupNeeded'));
                    error.code = 'auth/popup-required';
                    throw error;
                }

                console.warn('[Авторизация] Всплывающее окно недоступно, переходим по адресу.');

                // Помечаем заранее: после возврата страница должна поднять
                // сессию, и только при этой пометке уместно сообщать о
                // неудавшемся входе. Без неё «вход не завершился» показывался
                // всякому, у кого остался черновик первого запуска
                auth._rememberSignIn(true);
                localStorage.setItem(auth.REDIRECT_KEY, '1');

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

    /**
     * Дойдёт ли вход переходом по адресу до конца.
     *
     * Safari и всё на его движке (а на iPhone это все браузеры) разделяют
     * хранилище по доменам, и вернувшись с домена Firebase, SDK не находит
     * своего состояния. Обходится это только размещением обработчика входа
     * на собственном домене — на GitHub Pages такого нет.
     */
    _redirectCanWork: (ua = navigator.userAgent || '', touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) => {
        // На iPhone и iPad движок один у всех браузеров, включая Chrome:
        // ограничение хранилища от смены оболочки не зависит
        const iOS = /iPad|iPhone|iPod|CriOS|FxiOS/.test(ua) || touchMac;
        const safari = /Safari/.test(ua) && !/Chrome|Chromium|Android|Edg|OPR/.test(ua);

        return !iOS && !safari;
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
            'auth/too-many-requests': 'auth.tooManyRequests',
            'auth/operation-not-allowed': 'auth.providerDisabled',
            'auth/invalid-api-key': 'auth.badConfig',
            'auth/configuration-not-found': 'auth.badConfig'
        };

        // Домен подставляем в текст: иначе непонятно, что именно добавлять
        // в список разрешённых, а он зависит от того, откуда открыто
        // приложение — localhost, домен Netlify или что-то ещё
        if (e?.code === 'auth/unauthorized-domain') {
            const error = new Error(t('auth.unauthorizedDomain', { domain: location.hostname }));
            error.code = e.code;
            return error;
        }

        const key = map[e?.code];
        const error = new Error(
            key ? t(key) : `${e?.message || t('auth.unknown')}${e?.code ? ` [${e.code}]` : ''}`
        );
        error.code = e?.code;
        return error;
    }
};
