const dashboard = {
    render: async () => {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div></div>`;

        await scheduler.updateStreak();
        const user = await db.user.get(1) || { league: 'Деревянная', totalXP: 0, currentStreak: 0 };
        
        const headerStreak = document.getElementById('header-streak');
        if (headerStreak) headerStreak.innerText = user.currentStreak || 0;

        const plan = await scheduler.getDailyPlan();
        const profile = config.getProfile();

        // --- ЛОГИКА ВЫЗОВА ЭКЗАМЕНА ---
        const allCycles = await db.cycles.toArray();
        const activeCycle = allCycles.find(c => c.status === 'active');
        let isReadyForExam = false;
        
        if (activeCycle) {
            // Ищем все дневные планы для текущей темы
            const plans = await db.dayPlans.filter(p => p.cycleId === activeCycle.id).toArray();
            
            // Если планы созданы и абсолютно все пройдены — пора сдавать контроль
            if (plans.length > 0 && plans.every(p => p.status === 'completed')) {
                isReadyForExam = true;
            }
        }

        const btnText = plan.total > 0 ? `НАЧАТЬ УРОК (${plan.total})` : `ПЛАН ВЫПОЛНЕН 🎉`;
        const btnClass = plan.total > 0 
            ? `bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-95` 
            : `bg-slate-700 text-slate-400 cursor-not-allowed`;

        let examHtml = '';
        if (isReadyForExam) {
            examHtml = `
                <div class="bg-slate-800 p-6 rounded-2xl border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)] relative overflow-hidden text-center mb-6 fade-in">
                    <div class="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                        <i class="fa-solid fa-graduation-cap"></i>
                    </div>
                    <h3 class="text-xl font-black text-slate-100 mb-2">Тема завершена!</h3>
                    <p class="text-slate-400 text-sm mb-6">Вы выполнили все дни темы «${activeCycle.title}». Пройдите итоговый контроль знаний.</p>
                    <button id="start-exam-btn" class="w-full py-4 bg-red-600 hover:bg-red-500 text-white text-lg font-black rounded-xl shadow-lg active:scale-95 transition-all">
                        ПРОЙТИ КОНТРОЛЬ ТЕМЫ
                    </button>
                </div>
            `;
        }

        let planHtml = '';
        // Показываем обычный план, только если экзамен еще не готов ИЛИ если есть слова для повторения на сегодня
        if (!isReadyForExam || plan.total > 0) {
            planHtml = `
                <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden fade-in">
                    <div class="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    
                    <div class="flex justify-between items-end mb-4">
                        <h3 class="text-lg font-bold text-slate-100">План на сегодня</h3>
                        <span class="text-[10px] font-bold text-slate-500 uppercase bg-slate-900 px-2 py-1 rounded border border-slate-700">Твоя подборка</span>
                    </div>
                    
                    <div class="space-y-4 mb-6">
                        <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                            <div class="flex items-center gap-3">
                                <i class="fa-solid fa-rotate-right text-blue-400 text-lg"></i>
                                <span class="text-slate-300 font-medium">Повторение</span>
                            </div>
                            <span class="text-xl font-bold text-blue-400">${plan.review.length}</span>
                        </div>
                        
                        <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                            <div class="flex items-center gap-3">
                                <i class="fa-solid fa-seedling text-green-400 text-lg"></i>
                                <span class="text-slate-300 font-medium">Новые слова</span>
                            </div>
                            <span class="text-xl font-bold text-green-400">${plan.newWords.length} / ${profile.dailyGoal}</span>
                        </div>
                    </div>

                    <button id="start-daily-btn" class="w-full py-4 text-lg font-black rounded-xl transition-all ${btnClass}" ${plan.total === 0 ? 'disabled' : ''}>
                        ${btnText}
                    </button>
                </div>
            `;
        }

        main.innerHTML = `
            <div class="fade-in space-y-6 max-w-lg mx-auto mt-2 pb-10">
                <!-- Карточка профиля, лиги и XP -->
                <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-bold text-slate-100">Hallo, ${profile.name}! 👋</h2>
                        <div class="flex gap-4 mt-2">
                            <p class="text-sm text-slate-400">Лига: <span class="font-bold text-amber-500">${user.league || 'Каменная'}</span></p>
                            <p class="text-sm text-slate-400">XP: <span class="font-bold text-blue-400">${user.totalXP || 0}</span></p>
                        </div>
                    </div>
                    <div class="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center border-2 border-amber-500/50 shadow-inner shrink-0">
                        <i class="fa-solid fa-trophy text-2xl text-amber-500"></i>
                    </div>
                </div>

                ${examHtml}
                ${planHtml}
            </div>
        `;

        // Привязываем клик на кнопку экзамена
        if (isReadyForExam) {
            document.getElementById('start-exam-btn').addEventListener('click', () => {
                control.start(activeCycle.id);
            });
        }

        // Привязываем клик на кнопку обычного урока
        const startBtn = document.getElementById('start-daily-btn');
        if (startBtn && plan.total > 0) {
            startBtn.addEventListener('click', () => {
                app.navigate('training');
            });
        }
    }
};