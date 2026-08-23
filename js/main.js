/**
 * Точка входа приложения.
 *
 * Раньше index.html подключал семнадцать отдельных <script>, и всё держалось
 * на порядке тегов и глобальных переменных: переставил строку — сломал
 * приложение. Теперь зависимости объявлены явно через import, а браузер сам
 * разбирается с порядком загрузки.
 *
 * Здесь же:
 *   - модули выкладываются в window ради inline-обработчиков onclick;
 *   - регистрируется service worker;
 *   - запускается приложение.
 */

import { config } from './config.js';
import { db, dbService } from './services/db.js';
import { aiService } from './services/ai.js';
import { dateUtils } from './core/dates.js';
import { srs } from './core/srs.js';
import { lessonStateManager } from './core/lessonState.js';
import { scheduler } from './core/scheduler.js';
import { onboarding } from './modules/onboarding.js';
import { dashboard } from './modules/dashboard.js';
import { cycle } from './modules/cycle.js';
import { scanner } from './modules/scanner.js';
import { exercises } from './modules/exercises.js';
import { training } from './modules/training.js';
import { profile } from './modules/profile.js';
import { room } from './modules/room.js';
import { chat } from './modules/chat.js';
import { control } from './modules/control.js';
import { app } from './app.js';

/**
 * Разметка собирается строками и содержит около семидесяти inline-обработчиков
 * вида onclick="room.startExerciseMode(...)". Они выполняются в глобальной
 * области, а область модуля глобальной не является — поэтому модули
 * выкладываются в window.
 *
 * Это временно: обработчики нужно постепенно переводить на addEventListener,
 * после чего блок исчезнет.
 */
Object.assign(window, {
    config, db, dbService, aiService, dateUtils, srs, lessonStateManager, scheduler,
    onboarding, dashboard, cycle, scanner, exercises, training, profile, room, chat, control, app
});

// --- Service Worker: офлайн-режим и установка PWA ---
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // Была ли страница уже под управлением SW до этой загрузки.
    // Без этой проверки первая же установка вызвала бы лишнюю перезагрузку.
    const hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register('sw.js', { type: 'classic' })
        .then((reg) => {
            console.log('[PWA] Service Worker зарегистрирован:', reg.scope);

            reg.addEventListener('updatefound', () => {
                const sw = reg.installing;
                if (!sw) return;
                sw.addEventListener('statechange', () => {
                    if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                        app.showUpdateBanner();
                    }
                });
            });
        })
        .catch((err) => console.error('[PWA] Ошибка регистрации Service Worker:', err));

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        reloading = true;
        location.reload();
    });
}

window.addEventListener('load', registerServiceWorker);

// Модульные скрипты выполняются до DOMContentLoaded, так что подписка успевает
document.addEventListener('DOMContentLoaded', app.init);
