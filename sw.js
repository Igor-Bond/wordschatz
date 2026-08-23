const CACHE_NAME = 'wortschatz-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/config.js',
    '/js/services/db.js',
    '/js/services/ai.js',
    '/js/core/srs.js',
    '/js/core/scheduler.js',
    '/js/modules/onboarding.js',
    '/js/modules/dashboard.js',
    '/js/modules/scanner.js',
    '/js/modules/training.js',
    '/js/modules/profile.js',
    '/js/modules/room.js',
    '/js/modules/chat.js',
    '/js/app.js'
];

// Установка Service Worker и кэширование файлов
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((err) => console.error('Ошибка кэширования при установке:', err))
    );
    self.skipWaiting();
});

// Активация и удаление старого кэша при обновлении версий
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Перехват запросов (возвращаем кэш, если есть, иначе идем в сеть)
self.addEventListener('fetch', (event) => {
    // Не кэшируем запросы к API Gemini
    if (event.request.url.includes('generativelanguage.googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response; // Отдаем из кэша
                }
                // Идем в сеть и динамически добавляем в кэш новые файлы (например, внешние скрипты)
                return fetch(event.request).then((fetchResponse) => {
                    // Проверяем, что ответ валидный, прежде чем кэшировать
                    if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                        return fetchResponse;
                    }
                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return fetchResponse;
                });
            }).catch(() => {
                // Здесь можно отдавать фолбэк для оффлайна
                console.warn('Оффлайн режим, ресурс недоступен:', event.request.url);
            })
    );
});