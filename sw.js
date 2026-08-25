/**
 * WortSchatz Pro — Service Worker
 *
 * Стратегии:
 *   - навигация (HTML)      → network-first, офлайн-фолбэк на закэшированный index.html
 *   - код приложения (js/css) → network-first, чтобы обновления доезжали сразу
 *   - vendor / assets       → cache-first, эти файлы меняются только при смене версии
 *   - запросы к Gemini API  → не перехватываем вообще
 *
 * ВАЖНО: при изменении списка файлов или стратегий поднимайте APP_VERSION,
 * иначе у пользователей останется старый кэш.
 */

const APP_VERSION = 'v94';
const CACHE_NAME = `wortschatz-${APP_VERSION}`;

const PRECACHE_URLS = [
    './',
    'index.html',
    'manifest.json',
    'css/style.css',
    'css/tailwind.css',

    // Локальные зависимости
    'vendor/dexie.min.js',
    'vendor/fontawesome/css/fontawesome.min.css',
    'vendor/fontawesome/css/solid.min.css',
    'vendor/fontawesome/webfonts/fa-solid-900.woff2',

    // Ядро
    'js/main.js',
    'js/config.js',
    'js/version.js',
    'js/i18n/i18n.js',
    'js/i18n/ru.js',
    'js/app.js',
    'js/services/db.js',
    'js/services/migrations.js',
    'js/services/auth.js',
    'js/services/sync.js',
    'js/services/wiktionary.js',
    'js/firebase.config.js',
    'vendor/firebase/firebase-app.js',
    'vendor/firebase/firebase-auth.js',
    'vendor/firebase/firebase-firestore.js',
    'js/services/ai.js',
    'js/core/dates.js',
    'js/core/german.js',
    'js/core/quiz.js',
    'js/core/dialog.js',
    'js/core/install.js',
    'js/core/leagues.js',
    'js/core/announce.js',
    'js/core/frequency.js',
    'vendor/frequency-de.js',
    'js/core/viewport.js',
    'js/core/actions.js',
    'js/core/mastery.js',
    'js/core/speech.js',
    'js/core/image.js',
    'js/core/declension.js',
    'js/core/srs.js',
    'js/core/lessonState.js',
    'js/core/scheduler.js',

    // Модули
    'js/modules/onboarding.js',
    'js/modules/dashboard.js',
    'js/modules/cycle.js',
    'js/modules/scanner.js',
    'js/modules/exercises.js',
    'js/modules/training.js',
    'js/modules/profile.js',
    'js/modules/profile/shared.js',
    'js/modules/profile/stats.js',
    'js/modules/profile/quality.js',
    'js/modules/profile/account.js',
    'js/modules/profile/dictionary.js',
    'js/modules/profile/backup.js',
    'js/modules/room.js',
    'js/modules/chat.js',
    'js/modules/control.js',

    // Иконки
    'assets/icon-192.png',
    'assets/icon-512.png',
    'assets/icon-maskable-192.png',
    'assets/icon-maskable-512.png'
];

// --- Установка: складываем всё необходимое в кэш ---
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);

        // addAll падает целиком, если хотя бы один файл недоступен,
        // поэтому кэшируем по одному и логируем проблемные.
        await Promise.all(PRECACHE_URLS.map(async (url) => {
            try {
                await cache.add(new Request(url, { cache: 'reload' }));
            } catch (err) {
                console.error('[SW] Не удалось закэшировать:', url, err);
            }
        }));

        console.log(`[SW] Установлен ${CACHE_NAME}`);
    })());
    // skipWaiting не вызываем: обновление применяется по кнопке в приложении
});

// --- Активация: удаляем кэши прошлых версий ---
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(
            names
                .filter((name) => name.startsWith('wortschatz-') && name !== CACHE_NAME)
                .map((name) => {
                    console.log('[SW] Удаляем старый кэш:', name);
                    return caches.delete(name);
                })
        );
        await self.clients.claim();
    })());
});

// --- Сообщения от страницы ---
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data === 'CLEAR_CACHES') {
        event.waitUntil(
            caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
        );
    }
});

// --- Помощники ---

/*
 * Манифест раздаётся сначала из сети наравне с кодом.
 *
 * Он попадал в общую ветку «сначала кэш», и Android читал старую копию.
 * Заметно это стало на переходе в полноэкранный режим: display в
 * манифесте поменялся, приложение переустановили — а системные панели
 * остались, потому что оболочка приложения строилась по кэшированному
 * манифесту. Файл меньше килобайта, брать его из сети ничего не стоит,
 * а устаревший тихо ломает то, как приложение устанавливается.
 */
const isAppCode = (url) =>
    url.pathname.includes('/js/')
    || url.pathname.endsWith('/css/style.css')
    || url.pathname.endsWith('/manifest.json');

const isStatic = (url) =>
    url.pathname.includes('/vendor/') ||
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png');

async function networkFirst(request, fallbackUrl) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (fallbackUrl) {
            const fallback = await cache.match(fallbackUrl);
            if (fallback) return fallback;
        }
        throw err;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && response.ok) {
        cache.put(request, response.clone());
    }
    return response;
}

// --- Перехват запросов ---
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Только GET: POST к Gemini и прочее не трогаем
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Чужие домены (в том числе Gemini API) отдаём напрямую в сеть
    if (url.origin !== self.location.origin) return;

    // Переходы по страницам
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, 'index.html'));
        return;
    }

    if (isStatic(url)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    if (isAppCode(url)) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Всё остальное: сначала кэш, потом сеть
    event.respondWith(cacheFirst(request));
});

