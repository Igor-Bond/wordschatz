import { auth } from './services/auth.js';
import { sync } from './services/sync.js';
import { install } from './core/install.js';
import { speech } from './core/speech.js';
import { dialog } from './core/dialog.js';
import { config } from './config.js';
import { VERSION } from './version.js';
import { viewport } from './core/viewport.js';
import { announce } from './core/announce.js';
import { aiService } from './services/ai.js';
import { i18n, t, plural } from './i18n/i18n.js';
import { dbService } from './services/db.js';
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

export const app = {
    init: async () => {
        // Если localStorage пуст, а база уже есть — поднимаем профиль оттуда
        await config.hydrateFromDb();

        if (config.isConfigured()) {
            document.getElementById('app-view').classList.remove('hidden');
            document.getElementById('app-view').classList.add('flex');
            app.initApp();

            // Сессия и синхронизация — в фоне, чтобы не задерживать первый экран
            app.restoreCloudSession();
        } else {
            onboarding.start().catch(e => console.error('[Первый запуск] Не удалось запустить:', e));
        }
    },

    /**
     * Восстановление входа и фоновая синхронизация.
     *
     * SDK Firebase весит почти мегабайт, поэтому поднимается только если
     * пользователь раньше входил: без облака приложение работает как прежде.
     */
    restoreCloudSession: async () => {
        if (!auth.isConfigured()) return;

        try {
            const user = await auth.restore();
            if (!user) return;

            await sync.run({ silent: true });
        } catch (e) {
            console.error('[Облако] Фоновая синхронизация не удалась:', e);
        }
    },

    initApp: () => {
        app.navigate('plan');
    },

    navigate: (viewId) => {
        // Уход с экрана прекращает начатое упражнение. Без сброса режим
        // экзамена или Комнаты пережил бы переход, и ответы следующего урока
        // уходили бы в чужой обработчик — без опыта и с чужим набором заданий
        document.body.classList.remove('lesson-mode');
        exercises.exam = null;
        exercises.isRoomMode = false;
        exercises.allowedModes = null;

        // Управляем активным цветом иконок в нижнем меню
        /*
         * Все пункты меню одного цвета — янтарного, как «План». Раньше
         * невыбранные были серыми, и меню выглядело наполовину погашенным.
         *
         * Текущий экран по-прежнему выделен, но не цветом, а яркостью:
         * убрать различие совсем — значит перестать показывать, где ты
         * находишься.
         */
        document.querySelectorAll('.nav-btn').forEach(btn => {
            const активный = btn.dataset.target === viewId;
            btn.classList.toggle('opacity-45', !активный);
            btn.classList.toggle('hover:opacity-75', !активный);
        });
        
        const main = document.getElementById('main-content');
        
        // Экранный чтец не заметит подмену содержимого — говорим сами
        announce.say(t('nav.' + (viewId === 'cycle' || viewId === 'training' ? 'plan' : viewId)) || viewId);

        // Маршрутизация по модулям приложения
        if (viewId === 'plan') { dashboard.render(); return; }
        if (viewId === 'cycle') { cycle.renderTopicPicker(); return; }
        if (viewId === 'scanner') { scanner.render(); return; }
        if (viewId === 'training') { training.render(); return; }
        if (viewId === 'room') { room.render(); return; }
        if (viewId === 'chat') { chat.render(); return; }
        if (viewId === 'profile') { profile.render(); return; }
        
        // Заглушка на случай неизвестного роута
        main.innerHTML = `
            <div class="fade-in flex flex-col h-full items-center justify-center text-slate-500">
                <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-inner border border-slate-700">
                    <i class="fa-solid fa-tools text-3xl text-amber-500/50"></i>
                </div>
                <h2 class="text-xl font-bold text-slate-300 mb-2">${t('app.moduleInProgress')}</h2>
                <p class="text-sm text-center max-w-xs">${t('app.moduleUnavailable')}</p>
            </div>
        `;
    },

    openSettings: () => {
        const prof = config.getProfile();
        // Берем ключ напрямую из хранилища настроек
        const savedKey = config.get('api_key') || prof.apiKey || ''; 
        
        document.getElementById('settings-api-key').value = savedKey;
        document.getElementById('settings-name').value = prof.name || '';
        document.getElementById('settings-lang').value = prof.uiLang || 'ru';

        // Окно открывается со скрытым ключом, даже если в прошлый раз
        // его показывали
        app.setKeyVisibility(false);

        // Если сохранённого уровня нет в списке (пришёл из облака или из
        // старой версии), select остаётся пустым и сохранение записало бы
        // пустоту — откатываемся на значение по умолчанию
        const levelSelect = document.getElementById('settings-level');
        levelSelect.value = prof.level || 'B1';
        if (!levelSelect.value) levelSelect.value = 'B1';

        // Подписи «5 слов / 10 слов…» зависят от языка, поэтому собираем список здесь
        const goalSelect = document.getElementById('settings-goal');
        goalSelect.innerHTML = [5, 10, 15, 20]
            .map(n => `<option value="${n}">${plural('common.word', n)}</option>`)
            .join('');
        goalSelect.value = prof.dailyGoal || '10';
        document.getElementById('settings-interests').value = prof.interests || '';

        app.fillAbout();

        const modal = document.getElementById('settings-modal');
        const content = document.getElementById('settings-modal-content');
        
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }, 10);
    },

    /**
     * Раздел «Информация» (§35 ТЗ).
     *
     * Версия кэша и объём данных нужны не из любопытства: по ним видно,
     * доехало ли обновление и сколько места занял словарь. Раньше это можно
     * было узнать только через консоль браузера, которой на телефоне нет.
     */
    fillAbout: async () => {
        // Пересчитываем высоту перед показом чисел: без события подстановка
        // могла остаться с момента запуска, и диагностика показывала бы не
        // то, что есть сейчас
        viewport.apply();

        const version = document.getElementById('about-version');
        if (version) version.textContent = 'v' + VERSION;

        const model = document.getElementById('about-model');
        if (model) model.textContent = config.getProfile().model || '—';

        const cache = document.getElementById('about-cache');
        if (cache) {
            try {
                const names = await caches.keys();
                const ours = names.find(n => n.startsWith('wortschatz-'));
                cache.textContent = ours ? ours.replace('wortschatz-', '') : t('settings.aboutNoCache');
            } catch (e) {
                cache.textContent = '—';
            }
        }

        // Размеры экрана и безопасные зоны: жалобы вида «меню уехало вниз»
        // без этих чисел разбираются гаданием, а DevTools на телефоне нет
        const screen = document.getElementById('about-screen');
        if (screen) {
            const проба = document.createElement('div');
            проба.style.cssText = 'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom);padding-top:env(safe-area-inset-top);visibility:hidden';
            document.body.appendChild(проба);

            const стиль = getComputedStyle(проба);
            const снизу = parseInt(стиль.paddingBottom) || 0;
            const сверху = parseInt(стиль.paddingTop) || 0;
            проба.remove();

            const режим = install.isStandalone() ? t("settings.screenApp") : t("settings.screenBrowser");
            screen.textContent = `${window.innerWidth}×${window.innerHeight} · ${режим}`
                + (сверху || снизу ? ` · ${t("settings.screenSafe", { top: сверху, bottom: снизу })}` : "");

            /*
             * Числа по высоте — вернулись по нужде.
             *
             * Меню на iPhone четвёртый раз оказывается выше нижнего края,
             * и гадать больше не на чем: три разные причины дают глазу
             * одинаковую картинку. Эта строка отвечает точно, какая.
             */
            const метрики = document.getElementById('about-metrics');
            if (метрики) {
                const проба2 = document.createElement('div');
                проба2.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100dvh;visibility:hidden';
                document.body.appendChild(проба2);
                const dvh = Math.round(проба2.getBoundingClientRect().height);
                проба2.remove();

                const nav = document.querySelector('nav');
                const низМеню = nav ? Math.round(nav.getBoundingClientRect().bottom) : '—';
                const первая = nav ? nav.querySelector('.nav-btn') : null;
                const подКнопками = первая
                    ? Math.round(window.innerHeight - первая.getBoundingClientRect().bottom)
                    : '—';

                /*
                 * Решающее число: сколько экрана остаётся ПОД окном.
                 *
                 * Прошлый заход упёрся в противоречие. Низ меню совпадает
                 * с низом окна — значит меню на краю; а человек видит под
                 * ним полосу — значит не на краю. Разрешает это положение
                 * самого окна на экране: screenY. Если окно начинается от
                 * верха (0) и ниже него остаётся 59 точек — это не наш
                 * зазор, это место вне окна, и страница туда не рисует
                 * вовсе. Если окно начинается от 59 и упирается в низ —
                 * зазора нет, и дело в отступе.
                 */
                const верхОкна = Number.isFinite(window.screenY) ? window.screenY : 0;
                const высотаЭкрана = (window.screen && window.screen.height) || 0;
                const подОкном = высотаЭкрана
                    ? Math.round(высотаЭкрана - верхОкна - window.innerHeight)
                    : '—';

                // Видимая область отдельно от разметочной: fixed привязан
                // к разметочной, а глаз видит визуальную. Расходятся они
                // редко, но именно в таких случаях, как этот
                const vv = window.visualViewport;
                const видимое = vv ? Math.round(vv.height) : '—';
                const сдвиг = vv ? Math.round(vv.offsetTop) : '—';

                метрики.textContent = `dvh ${dvh} · окно ${window.innerHeight}`
                    + ` · экран ${высотаЭкрана || '—'} · верх ${верхОкна}`
                    + ` · зона ${снизу} · меню ${низМеню} · под кнопками ${подКнопками}`
                    + ` · видимое ${видимое}+${сдвиг} · ПОД ОКНОМ ${подОкном}`;
            }
        }

        const voice = document.getElementById('about-voice');
        if (voice) voice.textContent = await speech.describe();

        const storage = document.getElementById('about-storage');
        if (storage) {
            try {
                const words = await dbService.countWords();
                const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
                const mb = estimate?.usage ? ` · ${(estimate.usage / 1048576).toFixed(1)} МБ` : '';
                storage.textContent = `${plural('common.word', words)}${mb}`;
            } catch (e) {
                storage.textContent = '—';
            }
        }
    },

    closeSettings: () => {
        const modal = document.getElementById('settings-modal');
        const content = document.getElementById('settings-modal-content');
        
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); }, 200);
    },

    saveSettings: async () => {
        const key = document.getElementById('settings-api-key').value.trim();
        const lang = document.getElementById('settings-lang').value;
        const level = document.getElementById('settings-level').value;
        const goal = parseInt(document.getElementById('settings-goal').value);
        const interests = document.getElementById('settings-interests').value.trim();

        const name = document.getElementById('settings-name').value.trim();

        const previousGoal = config.getProfile().dailyGoal;
        const previousLang = config.get('ui_lang') || 'ru';

        /*
         * Смена языка меняет только интерфейс. Уже сохранённые переводы
         * остаются на прежнем языке, а новые слова придут на новом — через
         * неделю словарь окажется смешанным, и задания начнут спрашивать
         * то так, то этак. Предупреждаем до того, как это случится.
         */
        if (lang !== previousLang) {
            const дальше = await dialog.confirm(t('settings.langWarning'), {
                title: t('settings.language'),
                okLabel: t('common.ok')
            });
            if (!дальше) return;
        }

        if (key) config.set('api_key', key);
        if (name) config.set('name', name);
        config.set('ui_lang', lang);
        config.set('level', level);
        config.set('daily_goal', goal);
        config.set('interests', interests);

        // §3 ТЗ: при смене дневной нормы оставшиеся дни темы пересчитываются
        if (goal !== previousGoal) {
            try {
                const activeCycle = await dbService.getActiveCycle();
                if (activeCycle) await scheduler.recalculateFuturePlans(activeCycle.id, goal);
            } catch (e) {
                console.error('Не удалось пересчитать план темы:', e);
            }
        }

        app.closeSettings();

        /*
         * Перезагрузка нужна только при смене языка: живой перерисовки
         * интерфейса нет. Ради нормы или уровня перезапускать всё
         * приложение незачем — выглядело так, будто оно испугалось.
         */
        if (lang !== previousLang) {
            location.reload();
            return;
        }

        await dashboard.render();
    },

    /** Ключ показан или скрыт. */
    setKeyVisibility: (visible) => {
        const field = document.getElementById('settings-api-key');
        const eye = document.getElementById('settings-key-eye');
        if (!field || !eye) return;

        field.type = visible ? 'text' : 'password';
        eye.innerHTML = `<i class="fa-solid fa-eye${visible ? '-slash' : ''}"></i>`;
    },

    toggleKeyVisibility: () => {
        const field = document.getElementById('settings-api-key');
        app.setKeyVisibility(field?.type === 'password');
    },

    /**
     * Проверка подключения к ИИ прямо из настроек.
     *
     * Показывает, какой ключ отвечает, а какой упёрся в квоту или
     * недействителен. Отчёт можно выделить и скопировать — ключи в нём
     * замаскированы.
     */
    runDiagnostics: async () => {
        const btn = document.getElementById('diagnose-btn');
        const box = document.getElementById('diagnose-result');
        if (!btn || !box) return;

        // Свежий ключ из поля, даже если его ещё не сохранили
        const typedKey = document.getElementById('settings-api-key').value.trim();
        if (typedKey) config.set('api_key', typedKey);

        btn.disabled = true;
        box.classList.remove('hidden');
        box.textContent = t('settings.checking');

        try {
            const report = await aiService.diagnose((done, total) => {
                box.textContent = `${t('settings.checking')} ${done}/${total}`;
            });

            const lines = [
                `${t('settings.model')}: ${report.модель}`,
                ...report.результаты.map((r, i) =>
                    `${i + 1}. ${r.ключ} — ${r.статус}` +
                    (r.токены ? `, ${r.токены}` : '') +
                    `, ${r.мс} мс` +
                    (r.модель ? ` [${r.модель}]` : '') +
                    (r.моделей !== undefined ? `\n   моделей доступно: ${r.моделей}` : '') +
                    (r.лучшие ? `\n   лучшие: ${r.лучшие}` : '') +
                    (r.деталь ? `\n   ${r.деталь}` : '')
                ),
                '',
                report.итог
            ];
            box.textContent = lines.join('\n');
        } catch (e) {
            box.textContent = e.message;
        } finally {
            btn.disabled = false;
        }
    },

    /**
     * Полный сброс приложения.
     * Раньше чистился только localStorage, а словарь оставался в IndexedDB:
     * пользователь заново проходил onboarding и получал старые слова.
     */
    resetAll: async () => {
        const confirmed = await dialog.confirm(t('app.resetConfirm'), {
            title: t('settings.reset'),
            danger: true,
            okLabel: t('common.delete')
        });
        if (!confirmed) return;

        // Отложенная запись профиля не должна воссоздать базу после удаления
        config.suspendMirror();

        try {
            // 1. Пользовательские данные в IndexedDB
            await dbService.resetDatabase();
        } catch (e) {
            console.error('Не удалось удалить базу данных:', e);
            await dialog.alert(t('app.resetDbFailed'));
            return;
        }

        // 2. Настройки профиля и API-ключ
        try {
            Object.keys(localStorage)
                .filter((k) => k.startsWith('ws_'))
                .forEach((k) => localStorage.removeItem(k));
        } catch (e) {
            console.error('Не удалось очистить localStorage:', e);
        }

        location.reload();
    },

    /**
     * Баннер обновления: новая версия скачана, но ждёт применения.
     * Вызывается из регистрации Service Worker в index.html.
     */
    showUpdateBanner: () => {
        if (document.getElementById('sw-update-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'sw-update-banner';
        banner.className =
            'fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 ' +
            'bg-slate-800 border border-amber-500/50 text-slate-200 px-4 py-3 rounded-2xl ' +
            'shadow-[0_0_20px_rgba(245,158,11,0.25)] fade-in';
        banner.innerHTML = `
            <i class="fa-solid fa-arrows-rotate text-amber-500"></i>
            <span class="text-sm font-medium">${t('app.updateAvailable')}</span>
            <button id="sw-update-btn" class="ml-1 px-3 py-1.5 bg-amber-500 text-slate-900 text-xs font-black rounded-lg active:scale-95 transition-transform">
                ${t('app.updateButton')}
            </button>
            <button id="sw-update-dismiss" class="text-slate-500 hover:text-slate-300 transition-colors" aria-label="${t('common.close')}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        document.body.appendChild(banner);

        document.getElementById('sw-update-btn').addEventListener('click', async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg && reg.waiting) {
                reg.waiting.postMessage('SKIP_WAITING'); // дальше сработает controllerchange
            } else {
                location.reload();
            }
        });

        document.getElementById('sw-update-dismiss').addEventListener('click', () => {
            banner.remove();
        });
    }
};
