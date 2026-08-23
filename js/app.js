const app = {
    init: async () => {
        // Если localStorage пуст, а база уже есть — поднимаем профиль оттуда
        await config.hydrateFromDb();

        if (config.isConfigured()) {
            document.getElementById('app-view').classList.remove('hidden');
            document.getElementById('app-view').classList.add('flex');
            app.initApp();
        } else {
            onboarding.start();
        }
    },

    initApp: () => {
        app.navigate('plan');
    },

    navigate: (viewId) => {
        // Управляем активным цветом иконок в нижнем меню
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if(btn.dataset.target === viewId) {
                btn.classList.remove('text-slate-500');
                btn.classList.add('text-amber-500');
            } else {
                btn.classList.remove('text-amber-500');
                btn.classList.add('text-slate-500');
            }
        });
        
        const main = document.getElementById('main-content');
        
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
                <h2 class="text-xl font-bold text-slate-300 mb-2">Модуль в разработке</h2>
                <p class="text-sm text-center max-w-xs">Этот раздел пока недоступен.</p>
            </div>
        `;
    },

    openSettings: () => {
        const prof = config.getProfile();
        // Берем ключ напрямую из хранилища настроек
        const savedKey = config.get('api_key') || prof.apiKey || ''; 
        
        document.getElementById('settings-api-key').value = savedKey;
        document.getElementById('settings-lang').value = prof.uiLang || 'ru';
        document.getElementById('settings-level').value = prof.level || 'A1';
        document.getElementById('settings-goal').value = prof.dailyGoal || '5';

        const modal = document.getElementById('settings-modal');
        const content = document.getElementById('settings-modal-content');
        
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }, 10);
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

        const previousGoal = config.getProfile().dailyGoal;

        if (key) config.set('api_key', key);
        config.set('ui_lang', lang);
        config.set('level', level);
        config.set('daily_goal', goal);

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
        location.reload();
    },

    /**
     * Полный сброс приложения.
     * Раньше чистился только localStorage, а словарь оставался в IndexedDB:
     * пользователь заново проходил onboarding и получал старые слова.
     */
    resetAll: async () => {
        const confirmed = confirm(
            'Удалить ВСЕ данные?\n\n' +
            'Будут стёрты словарь, прогресс, XP, лига, история уроков и настройки.\n' +
            'Действие необратимо. Если нужен бэкап — сначала сделайте экспорт словаря.'
        );
        if (!confirmed) return;

        // Отложенная запись профиля не должна воссоздать базу после удаления
        config.suspendMirror();

        try {
            // 1. Пользовательские данные в IndexedDB
            await dbService.resetDatabase();
        } catch (e) {
            console.error('Не удалось удалить базу данных:', e);
            alert(
                'Не удалось удалить базу данных. ' +
                'Возможно, приложение открыто в другой вкладке — закройте её и попробуйте снова.'
            );
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
            <span class="text-sm font-medium">Доступна новая версия</span>
            <button id="sw-update-btn" class="ml-1 px-3 py-1.5 bg-amber-500 text-slate-900 text-xs font-black rounded-lg active:scale-95 transition-transform">
                ОБНОВИТЬ
            </button>
            <button id="sw-update-dismiss" class="text-slate-500 hover:text-slate-300 transition-colors" aria-label="Закрыть">
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

document.addEventListener('DOMContentLoaded', app.init);