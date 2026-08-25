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

    /**
     * Черновик первого запуска в localStorage.
     *
     * Нужен из-за входа переходом по адресу: страница уходит на Google и
     * возвращается заново запущенной. Без черновика пользователь, нажавший
     * «Войти» на шестом шаге, возвращался на первый — с пустым именем и без
     * ключа, а вход при этом уже состоялся. Выглядело это как «кнопка входа
     * не работает», и именно так о ней и сообщили.
     */
    DRAFT_KEY: 'ws_onboarding_draft',

    saveDraft: () => {
        try {
            localStorage.setItem(onboarding.DRAFT_KEY, JSON.stringify({
                step: onboarding.step,
                data: onboarding.data
            }));
        } catch (e) {
            console.error('[Первый запуск] Не удалось сохранить черновик:', e);
        }
    },

    loadDraft: () => {
        try {
            const raw = localStorage.getItem(onboarding.DRAFT_KEY);
            if (!raw) return false;

            const draft = JSON.parse(raw);
            if (!draft?.data) return false;

            onboarding.data = { ...onboarding.data, ...draft.data };
            onboarding.step = draft.step || 1;
            return true;
        } catch (e) {
            return false;
        }
    },

    clearDraft: () => localStorage.removeItem(onboarding.DRAFT_KEY),

    /*
     * Первый запуск больше не уходит из приложения.
     *
     * Здесь был разбор возврата с входа переходом по адресу: черновик,
     * пометка о переходе, сообщение о неудаче. Всё это существовало
     * только потому, что вход стоял шестым шагом мастера и уводил на
     * чужой домен посреди настройки. Вход переехал в профиль, уходить
     * стало некуда — и разбирать нечего.
     *
     * Черновик оставлен: он спасает введённое, если приложение закрыли
     * или обновили на середине.
     */
    start: async () => {
        const view = document.getElementById('onboarding-view');
        view.classList.remove('hidden');
        view.classList.add('flex', 'flex-col');

        const восстановлен = onboarding.loadDraft();
        if (!восстановлен) onboarding.data.uiLang = i18n.language;

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
            6: onboarding.renderCloudInfo
        };

        view.innerHTML = (steps[onboarding.step] || onboarding.renderName)();

        if (onboarding.step === 4) onboarding.bindGoalHighlight();
    },

    /**
     * Шаг 6. Рассказ про облако — без входа.
     *
     * Вход отсюда убран. На iPhone во встроенном приложении всплывающее
     * окно не открывается вовсе, остаётся переход по адресу, а он уводит
     * на домен Firebase и возвращает обратно — посреди первого запуска,
     * с недозаполненным черновиком. Работало это через раз, и первое, что
     * человек видел о приложении, была невнятная неудача.
     *
     * Синхронизация от этого никуда не делась: она в профиле, и войти
     * можно в любой момент — тогда уже на спокойную голову и в
     * приложении, которое успело показать, что оно умеет. Здесь только
     * рассказываем, что такая возможность есть и где её искать.
     */
    renderCloudInfo: () => `
        <div class="fade-in flex flex-col justify-center h-full p-6 max-w-sm mx-auto w-full">
            <div class="text-center mb-7">
                <i class="fa-solid fa-cloud-arrow-up text-5xl text-amber-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-slate-100">${t('auth.title')}</h2>
                <p class="text-sm text-slate-400 mt-3 leading-relaxed">${t('auth.hint')}</p>
            </div>

            <div class="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-3 mb-7">
                <div class="flex items-start gap-3">
                    <i class="fa-solid fa-shield-halved text-amber-500 mt-0.5 w-4 text-center"></i>
                    <p class="text-[13px] text-slate-300 leading-relaxed">${t('auth.whereToFind')}</p>
                </div>
                <div class="flex items-start gap-3">
                    <i class="fa-solid fa-hard-drive text-slate-500 mt-0.5 w-4 text-center"></i>
                    <p class="text-[13px] text-slate-400 leading-relaxed">${t('auth.worksOffline')}</p>
                </div>
            </div>

            <button onclick="onboarding.finish()"
                class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">
                ${t('onboarding.finish')}
            </button>
        </div>`,

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

        onboarding.clearDraft();

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
