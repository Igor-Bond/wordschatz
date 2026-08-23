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

const APP_VERSION = 'v3';
const CACHE_NAME = `wortschatz-${APP_VERSION}`;

const PRECACHE_URLS = [
    './',
    'index.html',
    'manifest.json',
    'css/style.css',

    // Локальные зависимости
    'vendor/tailwind.min.js',
    'vendor/dexie.min.js',
    'vendor/fontawesome/css/fontawesome.min.css',
    'vendor/fontawesome/css/solid.min.css',
    'vendor/fontawesome/webfonts/fa-solid-900.woff2',

    // Ядро
    'js/config.js',
    'js/app.js',
    'js/services/db.js',
    'js/services/ai.js',
    'js/core/dates.js',
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
    'js/modules/room.js',
    'js/modules/chat.js',
    'js/modules/control.js',

    // Иконки
    'assets/icon-192.png',
    'assets/icon-512.png'
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
const isAppCode = (url) =>
    url.pathname.includes('/js/') || url.pathname.endsWith('/css/style.css');

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
