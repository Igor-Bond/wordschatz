import { profile } from './shared.js';
import { auth } from '../../services/auth.js';
import { sync } from '../../services/sync.js';
import { install } from '../../core/install.js';
import { push } from '../../core/push.js';
import { dialog } from '../../core/dialog.js';
import { config } from '../../config.js';
import { i18n, t, plural } from '../../i18n/i18n.js';
import { dbService } from '../../services/db.js';

/** Установка приложения и облако: вход, обмен, выход. */

export const account = {

    /**
     * Аккаунт и синхронизация (§37 ТЗ).
     * Если Firebase не настроен, блок не показывается вовсе.
     */
    /**
     * Установка на устройство.
     *
     * Пункт «Установить приложение» в меню браузера находят не все, а в
     * некоторых оболочках он делает обычный ярлык на сайт. Своя кнопка
     * вызывает то же системное окно, а проверка объясняет, почему браузер
     * установку не предлагает.
     */
    renderInstallCard: () => {
        if (install.isStandalone()) return '';

        const button = install.canPrompt
            ? `<button onclick="profile.installApp()" id="prof-install-btn"
                   class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold rounded-xl active:scale-95 transition-all">
                   <i class="fa-solid fa-download mr-2"></i>${t('install.button')}
               </button>`
            : `<p class="text-xs text-slate-500 mb-3">${install.isIos() ? t('install.iosHint') : t('install.notReady')}</p>
               <button onclick="install.showDiagnostics()"
                   class="w-full py-2.5 bg-slate-900 border border-slate-600 text-slate-300 text-xs font-bold rounded-xl hover:border-amber-500 hover:text-amber-500 active:scale-95 transition-all">
                   ${t('install.check')}
               </button>`;

        return `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md" id="prof-install-card">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-amber-500 shrink-0">
                        <i class="fa-solid fa-mobile-screen-button"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-bold text-slate-200">${t('install.title')}</p>
                        <p class="text-[10px] text-slate-500">${t('install.subtitle')}</p>
                    </div>
                </div>
                ${button}
            </div>
        `;
    },

    installApp: async () => {
        const btn = document.getElementById('prof-install-btn');
        if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }

        const outcome = await install.prompt();

        if (outcome === 'unavailable') await install.showDiagnostics();
        else if (outcome === 'accepted') await dialog.alert(t('install.done'));

        await profile.renderStats();
    },

    renderAccountCard: () => {
        if (!auth.isConfigured()) return '';

        const user = auth.user;
        const last = Number(config.get(sync.LAST_SYNC_KEY) || 0);
        const when = last
            ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(last))
            : t('sync.never');

        if (!user) {
            // Греем SDK заранее: нажатие не должно ждать загрузки, иначе
            // всплывающее окно успевает стать заблокированным
            auth.warmUp();

            return `
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md">
                    <p class="text-xs text-slate-400 mb-3">${t('auth.notSignedIn')}</p>
                    <button onclick="profile.signIn()" id="prof-signin-btn"
                        class="w-full py-3 bg-white hover:bg-slate-100 text-slate-800 text-sm font-bold rounded-xl active:scale-95 transition-all">
                        ${t('auth.signIn')}
                    </button>
                    <p id="prof-auth-error" class="hidden text-xs text-red-400 mt-2"></p>
                </div>
            `;
        }

        return `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-9 h-9 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-amber-500 shrink-0">
                        <i class="fa-solid fa-cloud"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-xs text-slate-300 truncate">${profile.escapeAttr(user.email || user.displayName || '')}</p>
                        <p id="prof-sync-status" class="text-[10px] text-slate-500">${t('sync.lastSync', { when })}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="profile.syncNow()" id="prof-sync-btn"
                        class="flex-1 py-2.5 bg-slate-900 border border-slate-600 text-slate-300 text-xs font-bold rounded-xl hover:border-amber-500 hover:text-amber-500 active:scale-95 transition-all">
                        ${t('sync.now')}
                    </button>
                    <button onclick="profile.signOut()"
                        class="px-4 py-2.5 bg-slate-900 border border-slate-600 text-slate-400 text-xs font-bold rounded-xl hover:border-red-900 hover:text-red-400 active:scale-95 transition-all">
                        ${t('auth.signOut')}
                    </button>
                </div>
                <p id="prof-auth-error" class="hidden text-xs text-red-400 mt-2"></p>
            </div>
        `;
    },

    signIn: async () => {
        const btn = document.getElementById('prof-signin-btn');
        const error = document.getElementById('prof-auth-error');
        if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }

        try {
            const user = await auth.signIn();
            if (!user) return;   // ушли на вход переходом по адресу

            await profile.resolveFirstSignIn(user.uid);
            await profile.render();
        } catch (e) {
            if (error) { error.textContent = e.message; error.classList.remove('hidden'); }
            if (btn) { btn.disabled = false; btn.classList.remove('opacity-60'); }
        }
    },

    /**
     * Первый вход там, где локальный словарь уже не пуст.
     * Молча сливать или молча затирать нельзя — спрашиваем.
     */
    resolveFirstSignIn: async (uid) => {
        const state = await sync.inspectFirstSignIn(uid);

        if (state.conflict) {
            const choice = await dialog.choose(
                t('auth.conflictText', {
                    local: plural('common.word', state.localWords),
                    remote: plural('common.word', state.remoteWords)
                }),
                [
                    { value: 'merge', label: t('auth.conflictMerge'), hint: t('auth.conflictMergeHint'), primary: true },
                    { value: 'cloud', label: t('auth.conflictCloud'), hint: t('auth.conflictCloudHint'), danger: true }
                ],
                { title: t('auth.conflictTitle') }
            );

            if (choice === null) return;
            if (choice === 'cloud') {
                await sync.replaceLocalWithCloud(uid);
                location.reload();
                return;
            }
        }

        await sync.run();
    },

    syncNow: async () => {
        const btn = document.getElementById('prof-sync-btn');
        const status = document.getElementById('prof-sync-status');
        if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }
        if (status) status.textContent = t('sync.inProgress');

        try {
            await sync.run();
            await profile.render();
        } catch (e) {
            if (status) status.textContent = e.message;
        } finally {
            if (btn) { btn.disabled = false; btn.classList.remove('opacity-60'); }
        }
    },

    signOut: async () => {
        await auth.signOut();
        await profile.render();
    },

    /**
     * Уведомление на закрытое приложение (§41 ТЗ).
     *
     * Блок рисуется пустым и наполняется после проверки: узнать, есть ли
     * подписка, можно только асинхронно, а держать разметку в ожидании
     * ради одной строки незачем.
     */
    renderPushCard: () => {
        if (!push.isConfigured()) return '';

        // Наполнит fillPushCard после отрисовки
        return `<div id="prof-push-card"></div>`;
    },

    fillPushCard: async () => {
        const box = document.getElementById('prof-push-card');
        if (!box || !push.isConfigured()) return;

        const состояние = await push.status();

        if (!состояние.available) {
            box.innerHTML = `
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md">
                    <p class="text-xs font-bold text-slate-300 mb-1">${t('push.setting')}</p>
                    <p class="text-[11px] text-slate-500">${состояние.reason}</p>
                </div>`;
            return;
        }

        box.innerHTML = `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-300">${t('push.setting')}</p>
                        <p class="text-[11px] text-slate-500 mt-1 leading-relaxed">${t('push.hint')}</p>
                    </div>
                    <button onclick="profile.togglePush()" id="prof-push-btn"
                        class="shrink-0 px-3 py-2 text-xs font-bold rounded-xl active:scale-95 transition-all ${
                            состояние.active
                                ? 'bg-slate-900 border border-slate-600 text-slate-300 hover:border-red-900 hover:text-red-400'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                        }">
                        ${состояние.active ? t('push.disable') : t('push.enable')}
                    </button>
                </div>
                <p id="prof-push-error" class="hidden text-xs text-red-400 mt-2"></p>
            </div>`;
    },

    togglePush: async () => {
        const btn = document.getElementById('prof-push-btn');
        const error = document.getElementById('prof-push-error');
        if (btn) { btn.disabled = true; btn.textContent = t('push.working'); }
        error?.classList.add('hidden');

        try {
            const состояние = await push.status();

            if (состояние.active) await push.disable();
            else {
                const итог = await push.enable();
                if (!итог.ok && error) {
                    error.textContent = итог.reason;
                    error.classList.remove('hidden');
                }
            }
        } catch (e) {
            console.error('[Push] Не удалось переключить:', e);
            if (error) {
                error.textContent = `${t('push.failed')}: ${e.message}`;
                error.classList.remove('hidden');
            }
        }

        await profile.fillPushCard();
    },

};
