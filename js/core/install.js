import { dialog } from './dialog.js';
import { t } from '../i18n/i18n.js';

/**
 * Установка приложения на устройство (§2 ТЗ).
 *
 * Chrome на Android показывает свой пункт «Установить приложение» в меню
 * браузера, но найти его удаётся не всем, а в части оболочек он выглядит как
 * обычный ярлык на сайт. Поэтому перехватываем beforeinstallprompt и даём
 * кнопку внутри приложения.
 *
 * Слушатель ставится сразу при загрузке модуля: событие может прийти раньше,
 * чем отрисуется профиль, и повторно оно не приходит.
 */

let deferredPrompt = null;
const listeners = new Set();

const notify = () => listeners.forEach(cb => {
    try { cb(); } catch (e) { console.error('[Установка] Ошибка слушателя:', e); }
});

window.addEventListener('beforeinstallprompt', (e) => {
    // Без preventDefault Chrome показал бы свою мини-плашку
    e.preventDefault();
    deferredPrompt = e;
    console.log('[Установка] Приложение готово к установке');
    notify();
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    console.log('[Установка] Приложение установлено');
    notify();
});

export const install = {

    /** Уже запущено как приложение, а не вкладка. */
    isStandalone: () =>
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        navigator.standalone === true,

    /** Браузер подтвердил, что установка возможна. */
    get canPrompt() {
        return !!deferredPrompt;
    },

    /** iOS ставит приложение только вручную, события установки там нет. */
    isIos: () =>
        /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),

    /** Подписка на изменение готовности (кнопка появляется/исчезает). */
    onChange: (callback) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
    },

    /**
     * Показ системного окна установки.
     * @returns {Promise<'accepted'|'dismissed'|'unavailable'>}
     */
    prompt: async () => {
        if (!deferredPrompt) return 'unavailable';

        const event = deferredPrompt;
        deferredPrompt = null;      // повторно использовать событие нельзя
        notify();

        event.prompt();
        const { outcome } = await event.userChoice;
        console.log('[Установка] Ответ пользователя:', outcome);
        return outcome;
    },

    /**
     * Почему установка недоступна.
     *
     * Chrome молча не предлагает установку, если не выполнено хотя бы одно
     * условие, и понять какое — без DevTools невозможно. На телефоне DevTools
     * нет, поэтому проверяем всё сами и показываем список.
     */
    diagnose: async () => {
        const checks = [];
        const add = (ok, key, detail) => checks.push({ ok, key, detail });

        add(window.isSecureContext, 'install.checkSecure', location.protocol);

        // Манифест
        let manifest = null;
        try {
            const link = document.querySelector('link[rel="manifest"]');
            const res = await fetch(link ? link.href : 'manifest.json', { cache: 'no-store' });
            const text = await res.text();
            manifest = JSON.parse(text);
            add(true, 'install.checkManifest', `${res.status} ${res.headers.get('content-type') || ''}`.trim());
        } catch (e) {
            // Частая причина на хостингах с правилом «всё на index.html»:
            // вместо манифеста приезжает HTML и разбор падает
            add(false, 'install.checkManifest', String(e.message || e));
        }

        if (manifest) {
            const icons = manifest.icons || [];
            const has192 = icons.some(i => (i.sizes || '').split(' ').includes('192x192'));
            const has512 = icons.some(i => (i.sizes || '').split(' ').includes('512x512'));
            add(has192 && has512, 'install.checkIcons', icons.map(i => i.sizes).join(', '));

            const okDisplay = ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display);
            add(okDisplay, 'install.checkDisplay', manifest.display || '—');

            // Проверяем, что иконки реально отдаются
            for (const icon of icons.slice(0, 2)) {
                try {
                    const url = new URL(icon.src, location.href).href;
                    const res = await fetch(url, { cache: 'no-store' });
                    const type = res.headers.get('content-type') || '';
                    add(res.ok && type.startsWith('image/'), 'install.checkIconFile',
                        `${icon.sizes}: ${res.status} ${type}`);
                } catch (e) {
                    add(false, 'install.checkIconFile', `${icon.sizes}: ${e.message || e}`);
                }
            }
        }

        // Service worker
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            add(!!reg, 'install.checkSw', reg ? reg.scope : '—');
            add(!!navigator.serviceWorker.controller, 'install.checkSwActive',
                navigator.serviceWorker.controller ? 'ok' : t('install.needReload'));
        } else {
            add(false, 'install.checkSw', 'API недоступен');
        }

        add(install.canPrompt || install.isStandalone(), 'install.checkPromptable',
            install.isStandalone() ? t('install.already') : (install.canPrompt ? 'ok' : t('install.noEvent')));

        return checks;
    },

    /** Диалог с результатом проверки. */
    showDiagnostics: async () => {
        const checks = await install.diagnose();

        const lines = checks.map(c =>
            `${c.ok ? '✅' : '❌'} ${t(c.key)}${c.detail ? `\n     ${c.detail}` : ''}`
        ).join('\n');

        const failed = checks.filter(c => !c.ok).length;
        const header = install.isStandalone()
            ? t('install.already')
            : (failed === 0 ? t('install.allOk') : t('install.someFailed', { count: failed }));

        await dialog.alert(`${header}\n\n${lines}\n\n${t('install.manualHint')}`, { title: t('install.diagTitle') });
    }
};
