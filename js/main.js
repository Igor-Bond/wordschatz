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
import { i18n, t, plural, LANGUAGES } from './i18n/i18n.js';
import { db, dbService } from './services/db.js';
import { aiService } from './services/ai.js';
import { auth } from './services/auth.js';
import { sync } from './services/sync.js';
import { dateUtils } from './core/dates.js';
import { srs } from './core/srs.js';
import { dialog } from './core/dialog.js';
import { germanUtils } from './core/german.js';
import { quiz } from './core/quiz.js';
import { lessonStateManager } from './core/lessonState.js';
import { install } from './core/install.js';
import { viewport } from './core/viewport.js';
import { actions } from './core/actions.js';
import { reminder } from './core/reminder.js';
import { speech } from './core/speech.js';
import { wiktionary } from './services/wiktionary.js';
import { masteryUtils } from './core/mastery.js';
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
    i18n, t, plural,
    config, db, dbService, aiService, auth, sync, dateUtils, srs, germanUtils, quiz, dialog, lessonStateManager, scheduler,
    install, masteryUtils, wiktionary, speech, reminder, viewport, actions,
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

/**
 * Синхронизация при уходе со страницы.
 *
 * Раньше обмен запускался только при старте приложения и по кнопке: слова,
 * добавленные за сессию, до следующего запуска существовали лишь на этом
 * устройстве. Переключение приложения на телефоне — самый частый момент
 * «ухода», его и ловим.
 */
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Приложение могли не закрывать сутки: за полночь серия сгорает,
        // а цифра в шапке осталась бы вчерашней
        scheduler.refreshStreak().catch(() => {});

        // Заодно переставляем будильник: пока вкладка была свёрнута,
        // назначенное время могло пройти
        reminder.schedule();
        return;
    }

    if (!auth.isSignedIn || sync.inProgress) return;
    sync.run({ silent: true }).catch(() => {});
});

// Событие готовности к установке приходит уже после первого рендера профиля —
// перерисовываем блок, иначе кнопка появится только при следующем заходе
install.onChange(() => {
    const stats = document.getElementById('prof-mode-stats');
    if (stats && !stats.classList.contains('hidden')) profile.renderStats();
});

// Язык выставляем до первого рендера: разметка собирается строками,
// живой перерисовки при смене языка нет
i18n.setLanguage(config.get('ui_lang') || 'ru');

// Модульные скрипты выполняются до DOMContentLoaded, так что подписка успевает
document.addEventListener('DOMContentLoaded', () => {
    i18n.applyToDom();   // статические строки index.html

    // До первой отрисовки: иначе меню успевает встать по застрявшей высоте
    viewport.init();

    // Один слушатель на весь документ вместо onclick в разметке
    actions.init();

    app.init();
});
