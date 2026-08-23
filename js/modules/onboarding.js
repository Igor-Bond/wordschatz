const onboarding = {
    step: 1,
    data: { name: '', level: 'B1', dailyGoal: 10, interests: '', apiKey: '' },
    
    start: () => {
        const view = document.getElementById('onboarding-view');
        view.classList.remove('hidden');
        view.classList.add('flex', 'flex-col');
        onboarding.renderStep();
    },

    renderStep: () => {
        const view = document.getElementById('onboarding-view');
        let content = '';

        if (onboarding.step === 1) {
            content = `
                <div class="fade-in flex flex-col justify-center items-center h-full p-6 text-center">
                    <div class="w-24 h-24 bg-amber-500 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(245,158,11,0.3)] rotate-3">
                        <i class="fa-solid fa-graduation-cap text-5xl text-slate-900 -rotate-3"></i>
                    </div>
                    <h2 class="text-3xl font-bold text-slate-100 mb-2">WortSchatz Pro</h2>
                    <p class="text-slate-400 mb-8">Умная система изучения немецкого языка с ИИ. Давай настроим твой личный план обучения.</p>
                    
                    <div class="w-full max-w-sm text-left">
                        <label class="block text-sm font-bold text-slate-400 mb-2">Как к тебе обращаться?</label>
                        <input type="text" id="ob-name" class="w-full bg-slate-800 border-2 border-slate-700 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-lg transition-colors" placeholder="Твое имя...">
                    </div>
                    
                    <button onclick="onboarding.nextStep()" class="mt-8 w-full max-w-sm py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">НАЧАТЬ</button>
                </div>`;
        } 
        else if (onboarding.step === 2) {
            content = `
                <div class="fade-in flex flex-col justify-center h-full p-6 max-w-sm mx-auto w-full">
                    <h2 class="text-2xl font-bold text-slate-100 mb-6">Твой уровень и цели</h2>
                    
                    <label class="block text-sm font-bold text-slate-400 mb-2">Текущий уровень немецкого</label>
                    <select id="ob-level" class="w-full bg-slate-800 border-2 border-slate-700 text-slate-100 rounded-xl px-4 py-3 mb-6 outline-none focus:border-amber-500">
                        <option value="A1">A1 (Начинающий)</option>
                        <option value="A2">A2 (Базовый)</option>
                        <option value="B1" selected>B1 (Средний)</option>
                        <option value="B2">B2 (Продвинутый)</option>
                    </select>

                    <label class="block text-sm font-bold text-slate-400 mb-2">Твои интересы (через запятую)</label>
                    <p class="text-xs text-slate-500 mb-2">ИИ будет генерировать карточки и истории на эти темы.</p>
                    <textarea id="ob-interests" class="w-full bg-slate-800 border-2 border-slate-700 text-slate-100 rounded-xl px-4 py-3 mb-6 outline-none focus:border-amber-500 h-24" placeholder="Электроника, автомобили, рэп-музыка, баскетбол..."></textarea>
                    
                    <button onclick="onboarding.nextStep()" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">ДАЛЕЕ</button>
                </div>`;
        }
        else if (onboarding.step === 3) {
            content = `
                <div class="fade-in flex flex-col justify-center h-full p-6 max-w-sm mx-auto w-full">
                    <h2 class="text-2xl font-bold text-slate-100 mb-2">Темп обучения</h2>
                    <p class="text-sm text-slate-400 mb-6">Выбери, сколько новых слов ты хочешь учить каждый день. Это определит твою нагрузку.</p>
                    
                    <div class="space-y-3 mb-8">
                        <label class="flex items-center p-4 bg-slate-800 border-2 border-slate-700 rounded-xl cursor-pointer hover:border-amber-500 transition-colors">
                            <input type="radio" name="ob-goal" value="5" class="w-5 h-5 accent-amber-500">
                            <div class="ml-3"><div class="font-bold text-slate-200 text-lg">5 слов</div><div class="text-xs text-slate-500">~ 5 мин в день (Легкий старт)</div></div>
                        </label>
                        <label class="flex items-center p-4 bg-slate-800 border-2 border-amber-500 rounded-xl cursor-pointer">
                            <input type="radio" name="ob-goal" value="10" checked class="w-5 h-5 accent-amber-500">
                            <div class="ml-3"><div class="font-bold text-slate-200 text-lg">10 слов</div><div class="text-xs text-slate-500">~ 15 мин в день (Стандарт)</div></div>
                        </label>
                        <label class="flex items-center p-4 bg-slate-800 border-2 border-slate-700 rounded-xl cursor-pointer hover:border-amber-500 transition-colors">
                            <input type="radio" name="ob-goal" value="15" class="w-5 h-5 accent-amber-500">
                            <div class="ml-3"><div class="font-bold text-slate-200 text-lg">15 слов</div><div class="text-xs text-slate-500">~ 25 мин в день (Интенсив)</div></div>
                        </label>
                        <label class="flex items-center p-4 bg-slate-800 border-2 border-slate-700 rounded-xl cursor-pointer hover:border-amber-500 transition-colors">
                            <input type="radio" name="ob-goal" value="20" class="w-5 h-5 accent-amber-500">
                            <div class="ml-3"><div class="font-bold text-slate-200 text-lg">20 слов</div><div class="text-xs text-slate-500">~ 35 мин в день (Хардкор)</div></div>
                        </label>
                    </div>
                    
                    <button onclick="onboarding.nextStep()" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">ПОСЛЕДНИЙ ШАГ</button>
                </div>`;
        }
        else if (onboarding.step === 4) {
            content = `
                <div class="fade-in flex flex-col justify-center h-full p-6 max-w-sm mx-auto w-full">
                    <div class="text-center mb-6">
                        <i class="fa-solid fa-key text-5xl text-amber-500 mb-4"></i>
                        <h2 class="text-2xl font-bold text-slate-100">Мозг приложения</h2>
                    </div>
                    <p class="text-sm text-slate-300 mb-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        WortSchatz использует мощь нейросетей Google для генерации умных карточек и текстов. Тебе понадобится бесплатный API ключ.
                    </p>
                    
                    <ol class="text-sm text-slate-400 list-decimal pl-5 space-y-2 mb-6">
                        <li>Перейди на <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-blue-400 font-bold underline">Google AI Studio</a></li>
                        <li>Войди с Google-аккаунтом</li>
                        <li>Нажми синюю кнопку <b>"Create API Key"</b> и скопируй его.</li>
                    </ol>

                    <input type="text" id="ob-apikey" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 mb-6 outline-none focus:border-amber-500" placeholder="Вставь ключ (AIzaSy...)">
                    
                    <button onclick="onboarding.finish()" class="w-full py-4 bg-green-500 text-slate-900 text-lg font-black rounded-xl shadow-lg transition-transform active:scale-95">🚀 ЗАПУСТИТЬ WORTSCHATZ</button>
                </div>`;
        }

        view.innerHTML = content;
        
        // Обработчик радио-кнопок для шага 3 (подсветка активной)
        if(onboarding.step === 3) {
            document.querySelectorAll('input[name="ob-goal"]').forEach(r => {
                r.addEventListener('change', (e) => {
                    document.querySelectorAll('input[name="ob-goal"]').forEach(inp => {
                        inp.parentElement.classList.remove('border-amber-500');
                        inp.parentElement.classList.add('border-slate-700');
                    });
                    e.target.parentElement.classList.remove('border-slate-700');
                    e.target.parentElement.classList.add('border-amber-500');
                });
            });
        }
    },

    nextStep: () => {
        if (onboarding.step === 1) {
            const name = document.getElementById('ob-name').value.trim();
            if(!name) return alert('Пожалуйста, введи имя');
            onboarding.data.name = name;
        } else if (onboarding.step === 2) {
            onboarding.data.level = document.getElementById('ob-level').value;
            onboarding.data.interests = document.getElementById('ob-interests').value.trim();
        } else if (onboarding.step === 3) {
            const goal = document.querySelector('input[name="ob-goal"]:checked');
            if(goal) onboarding.data.dailyGoal = goal.value;
        }
        
        onboarding.step++;
        onboarding.renderStep();
    },

    finish: () => {
        const key = document.getElementById('ob-apikey').value.trim();
        if(!key) return alert('Ввод API ключа обязателен для работы приложения!');
        onboarding.data.apiKey = key;

        // Сохраняем в конфиг
        config.set('name', onboarding.data.name);
        config.set('level', onboarding.data.level);
        config.set('daily_goal', onboarding.data.dailyGoal);
        config.set('interests', onboarding.data.interests);
        config.set('api_key', onboarding.data.apiKey);
        config.set('model', 'gemini-flash-latest'); // Модель по умолчанию

        document.getElementById('onboarding-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        document.getElementById('app-view').classList.add('flex');
        
        app.initApp();
    }
};