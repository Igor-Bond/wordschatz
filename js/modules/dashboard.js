import { config } from '../config.js';
import { t, plural } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { dateUtils } from '../core/dates.js';
import { scheduler } from '../core/scheduler.js';
import { cycle } from './cycle.js';
import { control } from './control.js';
import { app } from '../app.js';

export const dashboard = {
    render: async () => {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div></div>`;

        // Счётчик в шапке обновляет refreshStreak: он же гасит прерванную серию
        await scheduler.refreshStreak();

        const user = await dbService.getUser();
        const profile = config.getProfile();
        const plan = await scheduler.getDailyPlan();

        const cycleProgress = plan.cycle ? await scheduler.getCycleProgress(plan.cycle.id) : null;
        const isReadyForExam = !!(cycleProgress && cycleProgress.isFinished);

        main.innerHTML = `
            <div class="fade-in space-y-6 max-w-lg mx-auto mt-2 pb-10">
                ${dashboard.renderProfileCard(profile, user)}
                ${isReadyForExam ? dashboard.renderExamCard(plan.cycle) : ''}
                ${plan.cycle ? dashboard.renderCycleCard(plan.cycle, cycleProgress) : ''}
                ${dashboard.renderPlanCard(plan, profile, isReadyForExam)}
            </div>
        `;

        const examBtn = document.getElementById('start-exam-btn');
        if (examBtn) examBtn.addEventListener('click', () => control.start(plan.cycle.id));

        const startBtn = document.getElementById('start-daily-btn');
        if (startBtn) startBtn.addEventListener('click', () => app.navigate('training'));

        const topicBtn = document.getElementById('choose-topic-btn');
        if (topicBtn) topicBtn.addEventListener('click', () => cycle.renderTopicPicker());
    },

    // --- Профиль, лига и XP ---
    renderProfileCard: (profile, user) => {
        const xp = user.totalXP || 0;
        const next = dbService.getNextLeague(xp);
        const leagueKey = user.league || dbService.getLeagueForXP(xp);

        let progressHtml = '';
        if (next) {
            const currentMin = dbService.LEAGUES.filter(l => xp >= l.minXP).pop().minXP;
            const span = next.minXP - currentMin;
            const percent = span > 0 ? Math.round(((xp - currentMin) / span) * 100) : 0;
            progressHtml = `
                <div class="mt-3">
                    <div class="w-full bg-slate-900 rounded-full h-1.5 border border-slate-700 overflow-hidden">
                        <div class="bg-amber-500 h-1.5 rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                    </div>
                    <p class="text-[10px] text-slate-500 mt-1.5">
                        ${t('dashboard.toNextLeague', { league: t('leagues.' + next.key), xp: next.minXP - xp })}
                    </p>
                </div>
            `;
        } else {
            progressHtml = `<p class="text-[10px] text-slate-500 mt-3">${t('dashboard.maxLeague')}</p>`;
        }

        return `
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg">
                <div class="flex items-center justify-between">
                    <div class="min-w-0">
                        <h2 class="text-xl font-bold text-slate-100 truncate">${t('dashboard.hello', { name: profile.name })}</h2>
                        <div class="flex gap-4 mt-2">
                            <p class="text-sm text-slate-400">${t('dashboard.league')}: <span class="font-bold text-amber-500">${t('leagues.' + leagueKey)}</span></p>
                            <p class="text-sm text-slate-400">${t('dashboard.xp')}: <span class="font-bold text-blue-400">${xp}</span></p>
                        </div>
                    </div>
                    <div class="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center border-2 border-amber-500/50 shadow-inner shrink-0">
                        <i class="fa-solid fa-trophy text-2xl text-amber-500"></i>
                    </div>
                </div>
                ${progressHtml}
            </div>
        `;
    },

    // --- Текущая тема и день цикла ---
    renderCycleCard: (activeCycle, progress) => {
        return `
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg">
                <div class="flex justify-between items-start mb-3">
                    <div class="min-w-0">
                        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">${t('dashboard.topic')}</p>
                        <h3 class="text-lg font-bold text-slate-100 truncate">${cycle.esc(activeCycle.title)}</h3>
                    </div>
                    <span class="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg shrink-0">
                        ${t('dashboard.dayOf', { current: progress.currentDay, total: progress.totalDays })}
                    </span>
                </div>

                <div class="w-full bg-slate-900 rounded-full h-2 border border-slate-700 overflow-hidden">
                    <div class="bg-amber-500 h-2 rounded-full transition-all duration-500" style="width: ${progress.percent}%"></div>
                </div>

                <div class="flex justify-between text-[11px] text-slate-500 mt-2">
                    <span>${t('dashboard.daysDone', { count: progress.completedDays })}</span>
                    <span>${t('dashboard.wordsInTopic', { count: progress.totalWords })}</span>
                </div>
            </div>
        `;
    },

    // --- Контроль темы ---
    renderExamCard: (activeCycle) => `
        <div class="bg-slate-800 p-6 rounded-2xl border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)] text-center fade-in">
            <div class="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                <i class="fa-solid fa-graduation-cap"></i>
            </div>
            <h3 class="text-xl font-black text-slate-100 mb-2">${t('dashboard.examTitle')}</h3>
            <p class="text-slate-400 text-sm mb-6">${t('dashboard.examText', { topic: cycle.esc(activeCycle.title) })}</p>
            <button id="start-exam-btn" class="w-full py-4 bg-red-600 hover:bg-red-500 text-white text-lg font-black rounded-xl shadow-lg active:scale-95 transition-all">
                ${t('dashboard.examButton')}
            </button>
        </div>
    `,

    // --- План на сегодня ---
    renderPlanCard: (plan, profile, isReadyForExam) => {
        // Ни темы, ни слов — предлагаем выбрать тему
        if (!plan.cycle && plan.total === 0) {
            return `
                <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg text-center">
                    <div class="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                        <i class="fa-solid fa-compass-drafting"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-100 mb-2">${t('dashboard.emptyTitle')}</h3>
                    <p class="text-slate-400 text-sm mb-6">${t('dashboard.emptyText')}</p>
                    <button id="choose-topic-btn" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 text-lg font-black rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-95 transition-all">
                        ${t('dashboard.chooseTopic')}
                    </button>
                </div>
            `;
        }

        // Тема пройдена и на сегодня ничего нет — экзамен показан выше
        if (isReadyForExam && plan.total === 0) return '';

        const done = plan.total === 0;
        const btnText = done ? t('dashboard.planDone') : t('dashboard.startLesson', { count: plan.total });
        const btnClass = done
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-95';

        // Когда тема кончилась, а слов вне темы нет — зовём выбрать следующую
        const nextTopicHtml = (done && !plan.cycle) ? `
            <button id="choose-topic-btn" class="w-full mt-3 py-3 bg-slate-900 border border-slate-600 text-slate-300 text-sm font-bold rounded-xl hover:border-amber-500 hover:text-amber-500 active:scale-95 transition-all">
                ${t('dashboard.chooseNextTopic')}
            </button>
        ` : '';

        return `
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden">
                <div class="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>

                <div class="flex justify-between items-end mb-4">
                    <h3 class="text-lg font-bold text-slate-100">${t('dashboard.planTitle')}</h3>
                    <span class="text-[10px] font-bold text-slate-500 uppercase bg-slate-900 px-2 py-1 rounded border border-slate-700">
                        ${plan.dayPlan ? dateUtils.format(plan.dayPlan.date) : t('dashboard.freeWords')}
                    </span>
                </div>

                <div class="space-y-4 mb-6">
                    <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-rotate-right text-blue-400 text-lg"></i>
                            <span class="text-slate-300 font-medium">${t('dashboard.review')}</span>
                        </div>
                        <span class="text-xl font-bold text-blue-400">${plan.review.length}</span>
                    </div>
                    ${plan.postponedReviews > 0 ? `
                        <p class="text-[11px] text-slate-500 -mt-2 pl-1">
                            ${t('dashboard.postponed', { count: plan.postponedReviews })}
                        </p>
                    ` : ''}

                    <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-seedling text-green-400 text-lg"></i>
                            <span class="text-slate-300 font-medium">${t('dashboard.newWords')}</span>
                        </div>
                        <span class="text-xl font-bold text-green-400">${plan.newWords.length} / ${profile.dailyGoal}</span>
                    </div>
                </div>

                <button id="start-daily-btn" class="w-full py-4 text-lg font-black rounded-xl transition-all ${btnClass}" ${done ? 'disabled' : ''}>
                    ${btnText}
                </button>
                ${nextTopicHtml}
            </div>
        `;
    }
};
