import { auth } from '../services/auth.js';
import { sync } from '../services/sync.js';
import { dialog } from '../core/dialog.js';
import { config } from '../config.js';
import { i18n, t, plural, LANGUAGES } from '../i18n/i18n.js';
import { app } from '../app.js';

/**
 * Первый запуск (§33 ТЗ).
 *
 * Шаг выбора языка стоит вторым, сразу после имени: дальше интерфейс
 * перерисовывается уже на выбранном языке, поэтому уровень, темп и инструкцию
 * по API-ключу пользователь читает на своём.
 */
export const onboarding = {
    step: 1,
    data: { name: '', uiLang: 'ru', level: 'B1', dailyGoal: 10, interests: '', apiKey: '' },

    LEVELS: ['A1', 'A2', 'B1', 'B2'],
    GOALS: [5, 10, 15, 20],

    start: () => {
        const view = document.getElementById('onboarding-view');
        view.classList.remove('hidden');
        view.classList.add('flex', 'flex-col');

        onboarding.data.uiLang = i18n.language;
        onboarding.renderStep();
    },

    renderStep: () => {
        const view = document.getElementById('onboarding-view');
        const steps = {
            1: onboarding.renderName,
            2: onboarding.renderLanguage,
            3: onboarding.renderLevel,
            4: onboarding.renderPace,
            5: onboarding.renderApiKey,
            6: onboarding.renderSignIn
        };

        view.innerHTML = (steps[onboarding.step] || onboarding.renderName)();

        if (onboarding.step === 4) onboarding.bindGoalHighlight();
    },

    /**
     * Шаг 6. Вход в аккаунт (§37).
     *
     * Стоит последним и его можно пропустить: приложение полностью работает
     * локально, а вход нужен только для синхронизации между устройствами.
     * Заставлять входить ради первого урока незачем.
     */
    renderSignIn: () => `
        <div class="fade-in flex flex-col justify-center h-full p-6 max-w-sm mx-auto w-full">
            <div class="text-center mb-8">
                <i class="fa-solid fa-cloud-arrow-up text-5xl text-amber-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-slate-100">${t('auth.title')}</h2>
                <p class="text-sm text-slate-400 mt-3 leading-relaxed">${t('auth.hint')}</p>
            </div>

            <button onclick="onboarding.signIn()" id="ob-signin-btn"
                class="w-full py-4 bg-white hover:bg-slate-100 text-slate-800 text-base font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-3">
                <svg viewBox="0 0 48 48" class="w-5 h-5" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.7 6.9l7.3 5.7c4.3-3.9 6.8-9.7 6.8-17.1z"/>
                    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.2z"/>
                    <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.3-5.7c-2 1.4-4.7 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/>
                </svg>
                ${t('auth.signIn')}
            </button>

            <p id="ob-signin-error" class="hidden text-xs text-red-400 text-center mt-3"></p>

            <button onclick="onboarding.finish()"
                class="w-full mt-4 py-3 text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors">
                ${t('auth.skip')}
            </button>
        </div>`,

    signIn: async () => {
        const btn = document.getElementById('ob-signin-btn');
        const error = document.getElementById('ob-signin-error');

        btn.disabled = true;
        btn.classList.add('opacity-60');
        error.classList.add('hidden');

        try {
            const user = await auth.signIn();
            // При входе переходом по адресу страница перезагрузится сама
            if (user) await onboarding.finish();
        } catch (e) {
            error.textContent = e.message;
            error.classList.remove('hidden');
            btn.disabled = false;
            btn.classList.remove('opacity-60');
        }
    },

    // --- Шаг 1. Имя ---
    renderName: () => `
        <div class="fade-in flex flex-col justify-center items-center h-full p-6 text-center">
            <div class="w-24 h-24 bg-amber-500 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(245,158,11,0.3)] rotate-3">
                <i class="fa-solid fa-graduation-cap text-5xl text-slate-900 -rotate-3"></i>
            </div>
            <h2 class="text-3xl font-bold text-slate-100 mb-2">${t('onboarding.appName')}</h2>
            <p class="text-slate-400 mb-8">${t('onboarding.intro')}</p>

            <div class="w-full max-w-sm text-left">
                <label class="block text-sm font-bold text-slate-400 mb-2">${t('onboarding.nameLabel')}</label>
                <input type="text" id="ob-name" value="${onboarding.data.name}"
                    class="w-full bg-slate-800 border-2 border-slate-700 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-lg transition-colors"
                    placeholder="${t('onboarding.namePlaceholder')}">
            </div>

            <button onclick="onboarding.nextStep()" class="mt-8 w-full max-w-sm py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">
                ${t('onboarding.start')}
            </button>
        </div>`,

    // --- Шаг 2. Язык интерфейса (§33.2) ---
    renderLanguage: () => `
        <div class="fade-in flex flex-col justify-center h-full p-6 max-w-sm mx-auto w-full">
            <div class="text-center mb-6">
                <i class="fa-solid fa-language text-5xl text-amber-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-slate-100">${t('onboarding.languageTitle')}</h2>
                <p class="text-sm text-slate-400 mt-2">${t('onboarding.languageHint')}</p>
            </div>

            <div class="space-y-3 mb-8">
                ${LANGUAGES.map(lang => `
                    <button onclick="onboarding.pickLanguage('${lang.code}')"
                        class="w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all active:scale-[0.99] ${
                            lang.code === onboarding.data.uiLang
                                ? 'bg-slate-800 border-amber-500 text-slate-100'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                        }">
                        <span class="font-bold text-lg">${lang.label}</span>
                        ${lang.code === onboarding.data.uiLang ? '<i class="fa-solid fa-check text-amber-500"></i>' : ''}
                    </button>
                `).join('')}
            </div>

            <button onclick="onboarding.nextStep()" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">
                ${t('common.next')}
            </button>
        </div>`,

    // --- Шаг 3. Уровень и интересы ---
    renderLevel: () => `
        <div class="fade-in flex flex-col justify-center h-full p-6 max-w-sm mx-auto w-full">
            <h2 class="text-2xl font-bold text-slate-100 mb-6">${t('onboarding.levelTitle')}</h2>

            <label class="block text-sm font-bold text-slate-400 mb-2">${t('onboarding.levelLabel')}</label>
            <select id="ob-level" class="w-full bg-slate-800 border-2 border-slate-700 text-slate-100 rounded-xl px-4 py-3 mb-6 outline-none focus:border-amber-500">
                ${onboarding.LEVELS.map(code => `
                    <option value="${code}" ${code === onboarding.data.level ? 'selected' : ''}>${t('levels.' + code)}</option>
                `).join('')}
            </select>

            <label class="block text-sm font-bold text-slate-400 mb-2">${t('onboarding.interestsLabel')}</label>
            <p class="text-xs text-slate-500 mb-2">${t('onboarding.interestsHint')}</p>
            <textarea id="ob-interests" class="w-full bg-slate-800 border-2 border-slate-700 text-slate-100 rounded-xl px-4 py-3 mb-6 outline-none focus:border-amber-500 h-24"
                placeholder="${t('onboarding.interestsPlaceholder')}">${onboarding.data.interests}</textarea>

            <button onclick="onboarding.nextStep()" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">
                ${t('common.next')}
            </button>
        </div>`,

    // --- Шаг 4. Дневная норма ---
    renderPace: () => `
        <div class="fade-in flex flex-col justify-center h-full p-6 max-w-sm mx-auto w-full">
            <h2 class="text-2xl font-bold text-slate-100 mb-2">${t('onboarding.paceTitle')}</h2>
            <p class="text-sm text-slate-400 mb-6">${t('onboarding.paceHint')}</p>

            <div class="space-y-3 mb-8">
                ${onboarding.GOALS.map(goal => {
                    const isActive = goal === Number(onboarding.data.dailyGoal);
                    return `
                    <label class="flex items-center p-4 bg-slate-800 border-2 rounded-xl cursor-pointer transition-colors ${
                        isActive ? 'border-amber-500' : 'border-slate-700 hover:border-amber-500'
                    }">
                        <input type="radio" name="ob-goal" value="${goal}" ${isActive ? 'checked' : ''} class="w-5 h-5 accent-amber-500">
                        <div class="ml-3">
                            <div class="font-bold text-slate-200 text-lg">${plural('common.word', goal)}</div>
                            <div class="text-xs text-slate-500">${t('goals.' + goal)}</div>
                        </div>
                    </label>`;
                }).join('')}
            </div>

            <button onclick="onboarding.nextStep()" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">
                ${t('onboarding.apiTitle')}
            </button>
        </div>`,

    // --- Шаг 5. API-ключ (§34) ---
    renderApiKey: () => `
        <div class="fade-in flex flex-col justify-center h-full p-6 max-w-sm mx-auto w-full">
            <div class="text-center mb-6">
                <i class="fa-solid fa-key text-5xl text-amber-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-slate-100">${t('onboarding.apiSubtitle')}</h2>
            </div>

            <ol class="text-sm text-slate-400 list-decimal pl-5 space-y-2 mb-6">
                <li>${t('onboarding.apiStep1')} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" class="text-blue-400 font-bold underline">Google AI Studio</a></li>
                <li>${t('onboarding.apiStep2')}</li>
                <li>${t('onboarding.apiStep3')} <b>"Create API Key"</b> ${t('onboarding.apiStep4')}</li>
            </ol>

            <input type="text" id="ob-apikey" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 mb-6 outline-none focus:border-amber-500"
                placeholder="${t('onboarding.apiPlaceholder')}">

            <button onclick="onboarding.nextStep()" class="w-full py-4 bg-green-500 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">
                ${t('onboarding.finish')}
            </button>
        </div>`,

    /** Выбор языка перерисовывает шаг сразу на новом языке. */
    pickLanguage: (code) => {
        onboarding.data.uiLang = code;
        i18n.setLanguage(code);
        config.set('ui_lang', code);
        i18n.applyToDom();          // навигация и настройки в index.html
        onboarding.renderStep();
    },

    bindGoalHighlight: () => {
        document.querySelectorAll('input[name="ob-goal"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.querySelectorAll('input[name="ob-goal"]').forEach(inp => {
                    inp.parentElement.classList.remove('border-amber-500');
                    inp.parentElement.classList.add('border-slate-700');
                });
                e.target.parentElement.classList.remove('border-slate-700');
                e.target.parentElement.classList.add('border-amber-500');
            });
        });
    },

    nextStep: async () => {
        if (onboarding.step === 1) {
            const name = document.getElementById('ob-name').value.trim();
            if (!name) return await dialog.alert(t('onboarding.nameRequired'));
            onboarding.data.name = name;
        } else if (onboarding.step === 3) {
            onboarding.data.level = document.getElementById('ob-level').value;
            onboarding.data.interests = document.getElementById('ob-interests').value.trim();
        } else if (onboarding.step === 4) {
            const goal = document.querySelector('input[name="ob-goal"]:checked');
            if (goal) onboarding.data.dailyGoal = goal.value;
        } else if (onboarding.step === 5) {
            const key = document.getElementById('ob-apikey').value.trim();
            if (!key) return await dialog.alert(t('onboarding.apiRequired'));
            onboarding.data.apiKey = key;

            // Шаг входа показываем, только если Firebase настроен
            if (!auth.isConfigured()) return await onboarding.finish();
        }

        onboarding.step++;
        onboarding.renderStep();
    },

    finish: async () => {
        // Ключ вводится на шаге 5, но finish можно вызвать и оттуда, и с шага
        // входа. Если поле ещё на экране — читаем прямо из него, иначе берём
        // сохранённое. Без этой подстраховки ключ уходил в настройки пустым.
        const field = document.getElementById('ob-apikey');
        if (field) onboarding.data.apiKey = field.value.trim();

        if (!onboarding.data.apiKey) {
            onboarding.step = 5;
            onboarding.renderStep();
            return await dialog.alert(t('onboarding.apiRequired'));
        }

        config.set('name', onboarding.data.name);
        config.set('ui_lang', onboarding.data.uiLang);
        config.set('level', onboarding.data.level);
        config.set('daily_goal', onboarding.data.dailyGoal);
        config.set('interests', onboarding.data.interests);
        config.set('api_key', onboarding.data.apiKey);
        config.set('model', 'gemini-flash-latest');

        document.getElementById('onboarding-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        document.getElementById('app-view').classList.add('flex');

        app.initApp();

        // Первая выгрузка в облако, если вход выполнен
        if (auth.isSignedIn) sync.run({ silent: true }).catch(() => {});
    }
};
