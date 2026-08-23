const app = {
    init: () => {
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

    saveSettings: () => {
        const key = document.getElementById('settings-api-key').value.trim();
        const lang = document.getElementById('settings-lang').value;
        const level = document.getElementById('settings-level').value;
        const goal = document.getElementById('settings-goal').value;
        
        if(key) config.set('api_key', key);
        config.set('ui_lang', lang);
        config.set('level', level);
        config.set('daily_goal', goal);
        
        app.closeSettings();
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', app.init);