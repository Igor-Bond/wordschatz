import { profile } from './shared.js';
import { masteryUtils } from '../../core/mastery.js';
import { dialog } from '../../core/dialog.js';
import { config } from '../../config.js';
import { i18n, t, plural } from '../../i18n/i18n.js';
import { dbService } from '../../services/db.js';
import { dateUtils } from '../../core/dates.js';

/** Вкладка «Статистика»: лиги, XP, активность, слабые места. */

export const stats = {

    renderStats: async () => {
        const container = document.getElementById('prof-mode-stats');
        
        try {
            // Безопасное получение данных
            const user = await dbService.getUser();
            const totalXP = user.totalXP || 0;
            const currentStreak = user.currentStreak || 0;
            
            let userProfile = { name: t('profile.defaultName') };
            if (typeof config !== 'undefined' && config.getProfile) {
                userProfile = config.getProfile() || userProfile;
            }

            const activity = await dbService.getActivity(30);

            // Статистика словаря
            const allWords = await dbService.getAllWords();
            const totalWords = allWords.length;
            const masteredCount = allWords.filter(masteryUtils.isLearned).length;
            const difficultCount = allWords.filter(masteryUtils.isWeak).length;

            // Сбор ошибок из Журнала
            let mistakes = [];
            mistakes = await dbService.getMistakes();
            
            const mistakeCounts = {};
            mistakes.forEach(m => {
                if (m && m.wordId) {
                    mistakeCounts[m.wordId] = (mistakeCounts[m.wordId] || 0) + 1;
                }
            });
            
            const topMistakeIds = Object.keys(mistakeCounts)
                .sort((a, b) => mistakeCounts[b] - mistakeCounts[a])
                .slice(0, 5)
                .map(Number);
            
            const topMistakeWords = await Promise.all(topMistakeIds.map(id => dbService.getWordById(id)));

            // Лиги и пороги берём из dbService — здесь только оформление,
            // раньше весь список дублировался с расхождением в порогах
            const LEAGUE_STYLES = {
                wooden:  { color: 'text-amber-700',  bg: 'bg-amber-900/30' },
                stone:   { color: 'text-slate-400',  bg: 'bg-slate-500/30' },
                bronze:  { color: 'text-orange-500', bg: 'bg-orange-500/30' },
                silver:  { color: 'text-gray-300',   bg: 'bg-gray-400/30' },
                gold:    { color: 'text-yellow-400', bg: 'bg-yellow-500/30' },
                diamond: { color: 'text-cyan-400',   bg: 'bg-cyan-500/30' }
            };

            const leagues = dbService.LEAGUES.map(l => ({
                key: l.key,
                name: t('leagues.' + l.key),
                min: l.minXP,
                ...LEAGUE_STYLES[l.key]
            }));

            let currentLeague = leagues[0];
            let nextLeague = leagues[1];

            for (let i = 0; i < leagues.length; i++) {
                if (totalXP >= leagues[i].min) {
                    currentLeague = leagues[i];
                    nextLeague = leagues[i + 1] || leagues[i];
                }
            }

            const isMaxLeague = currentLeague.key === leagues[leagues.length - 1].key;
            let progressPct = 100;
            let xpText = t('profile.xpMax', { xp: totalXP });

            if (!isMaxLeague) {
                const range = nextLeague.min - currentLeague.min;
                const earnedInLeague = totalXP - currentLeague.min;
                progressPct = Math.round((earnedInLeague / range) * 100);
                xpText = `${totalXP} / ${nextLeague.min} XP`;
            }

            // Генерация списка ошибок
            let mistakesHtml = '';
            const validMistakeWords = topMistakeWords.filter(w => w !== undefined);
            
            if (validMistakeWords.length > 0) {
                mistakesHtml = validMistakeWords.map(w => {
                    const count = mistakeCounts[w.id];
                    return `
                        <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 mb-2">
                            <div>
                                <div class="font-bold text-slate-200">${w.word}</div>
                                <div class="text-xs text-slate-400">${w.translation}</div>
                            </div>
                            <div class="text-red-400 text-xs bg-red-400/10 px-2 py-1 rounded font-bold border border-red-500/20">
                                ${plural('profile.mistakes', count)}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                mistakesHtml = `
                    <div class="text-center py-6 text-slate-500 flex flex-col items-center">
                        <i class="fa-solid fa-check-circle text-3xl mb-2 opacity-50"></i>
                        <p class="text-sm">${t('profile.noMistakes')}</p>
                    </div>`;
            }

            container.innerHTML = `
                <!-- Блок Лиги и XP -->
                <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold text-slate-100">${t('profile.currentLeague')}</h3>
                        <span class="text-xs font-bold px-2.5 py-1 rounded-md ${currentLeague.bg} ${currentLeague.color} border border-current">
                            <i class="fa-solid fa-trophy mr-1"></i> ${currentLeague.name}
                        </span>
                    </div>
                    
                    <div class="w-full bg-slate-900 rounded-full h-3 mb-2 border border-slate-700 overflow-hidden">
                        <div class="bg-amber-500 h-full rounded-full transition-all duration-1000 relative" style="width: ${progressPct}%">
                            <div class="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                    <div class="flex justify-between text-xs font-bold text-slate-500">
                        <span>${currentLeague.name}</span>
                        <span class="text-amber-500 tracking-wide">${xpText}</span>
                        <span>${nextLeague.name !== currentLeague.name ? nextLeague.name : t('profile.maxLeague')}</span>
                    </div>

                    <!--
                        Полоса показывает только соседнюю лигу. Сколько всего
                        ступеней и что дальше — было не узнать, а это первое,
                        что спрашивают про такую шкалу
                    -->
                    <button onclick="profile.showLeagues()"
                        class="w-full mt-4 py-2 text-[11px] font-bold text-slate-400 hover:text-amber-500 border-t border-slate-700 flex items-center justify-center gap-2 transition-colors">
                        ${t('profile.allLeagues')}
                        <i class="fa-solid fa-list-ol"></i>
                    </button>
                </div>

                <!-- Аналитика словаря -->
                ${profile.renderAccountCard()}

                ${profile.renderInstallCard()}

                ${profile.renderActivityChart(activity)}

                <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">${t('profile.dictStats')}</h3>
                <div class="grid grid-cols-3 gap-3">
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center flex flex-col justify-center shadow-md">
                        <div class="text-2xl font-black text-slate-100">${totalWords}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-1 font-bold">${t('profile.totalWords')}</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center flex flex-col justify-center shadow-md border-b-2 border-b-green-500/50"
                         title="${profile.escapeAttr(t('profile.masteredHint'))}">
                        <div class="text-2xl font-black text-green-400">${masteredCount}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-1 font-bold">${t('profile.mastered')}</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center flex flex-col justify-center relative overflow-hidden shadow-md border-b-2 border-b-red-500/50">
                        <div class="text-2xl font-black text-red-400">${difficultCount}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-1 font-bold">${t('profile.difficult')}</div>
                    </div>
                </div>

                ${profile.renderCompleteness(allWords)}

                ${profile.renderVerification(allWords)}

                <!-- Топ слабых мест -->
                <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider px-1 mt-2">${t('profile.weakSpots')}</h3>
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
                    ${mistakesHtml}
                </div>
            `;
        } catch (error) {
            console.error("Ошибка при рендере статистики профиля:", error);
            container.innerHTML = `
                <div class="p-6 text-center text-red-400 bg-slate-800 rounded-xl border border-red-900/50">
                    <i class="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
                    <h3 class="font-bold mb-2 text-lg">${t('profile.statsError')}</h3>
                    <p class="text-sm text-slate-500">${error.message}</p>
                </div>
            `;
        }
    },

    /**
     * График активности за 30 дней (§30 ТЗ) плюс недельный и месячный срез.
     *
     * Столбцы рисуются обычными div-ами: подключать библиотеку графиков
     * ради тридцати прямоугольников незачем, а офлайн она стоила бы
     * лишних сотен килобайт в прекэше.
     */
    renderActivityChart: (activity) => {
        const maxXP = Math.max(...activity.map(d => d.xp), 1);
        const today = dateUtils.today();

        const week = activity.slice(-7);
        const xpWeek = week.reduce((s, d) => s + d.xp, 0);
        const activeDays = activity.filter(d => d.xp > 0).length;

        const bars = activity.map(day => {
            const height = day.xp > 0 ? Math.max(6, Math.round((day.xp / maxXP) * 100)) : 2;
            const isToday = day.date === today;

            const color = day.xp === 0
                ? 'bg-slate-700'
                : (isToday ? 'bg-amber-400' : 'bg-amber-500/70');

            const tip = day.xp > 0
                ? `${dateUtils.format(day.date)}: ${day.xp} XP, ${t('dashboard.newWords')} ${day.newWords}, ${t('dashboard.review')} ${day.reviews}`
                : `${dateUtils.format(day.date)}: ${t('profile.noActivity')}`;

            return `<div class="flex-1 flex items-end h-full" title="${profile.escapeAttr(tip)}">
                        <div class="w-full rounded-sm ${color} transition-all" style="height: ${height}%"></div>
                    </div>`;
        }).join('');

        return `
            <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">${t('profile.activity')}</h3>
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md">
                <div class="flex items-end gap-[2px] h-24 mb-2">${bars}</div>

                <div class="flex justify-between text-[10px] text-slate-500 mb-4">
                    <span>${dateUtils.format(activity[0].date)}</span>
                    <span>${t('profile.today')}</span>
                </div>

                <!--
                    XP за месяц убран: он повторял то, что уже нарисовано
                    столбиками прямо над ним, и на телефоне лишняя цифра
                    отъедала строку у полезного
                -->
                <div class="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700">
                    <div class="text-center">
                        <div class="text-lg font-black text-amber-500">${xpWeek}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-0.5">${t('profile.xpWeek')}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-black text-slate-100">${activeDays}<span class="text-slate-500 text-sm">/30</span></div>
                        <div class="text-[10px] text-slate-500 uppercase mt-0.5">${t('profile.activeDays')}</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Все лиги и пороги (§23 ТЗ).
     *
     * Пороги живут в dbService и здесь только показываются: список,
     * продублированный в разметке, уже однажды разошёлся с настоящим.
     */
    LEAGUE_ICONS: {
        wooden: { icon: 'fa-tree', color: 'text-amber-700' },
        stone: { icon: 'fa-mountain', color: 'text-slate-400' },
        bronze: { icon: 'fa-medal', color: 'text-orange-500' },
        silver: { icon: 'fa-award', color: 'text-gray-300' },
        gold: { icon: 'fa-trophy', color: 'text-yellow-400' },
        diamond: { icon: 'fa-gem', color: 'text-cyan-400' }
    },

    showLeagues: async () => {
        const user = await dbService.getUser();
        const xp = user?.totalXP || 0;
        const current = dbService.getLeagueForXP(xp);

        const rows = dbService.LEAGUES.map(league => {
            const style = profile.LEAGUE_ICONS[league.key] || { icon: 'fa-trophy', color: 'text-slate-400' };
            const достигнута = xp >= league.minXP;
            const сейчас = league.key === current;

            const метка = сейчас
                ? `<span class="text-amber-500">${t('profile.leagueNow')}</span>`
                : достигнута
                    ? `<span class="text-green-500">${t('profile.leagueReached')}</span>`
                    : `<span class="text-slate-500">${t('profile.leagueNeed', { xp: league.minXP - xp })}</span>`;

            return `
                <div class="flex items-center gap-3 py-2.5 ${сейчас ? 'bg-amber-500/10 -mx-2 px-2 rounded-lg' : ''} ${достигнута ? '' : 'opacity-60'}">
                    <i class="fa-solid ${style.icon} ${достигнута ? style.color : 'text-slate-600'} w-5 text-center"></i>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold ${достигнута ? 'text-slate-100' : 'text-slate-400'}">${t('leagues.' + league.key)}</p>
                        <p class="text-[10px] text-slate-500">${league.minXP} XP</p>
                    </div>
                    <span class="text-[10px] font-bold shrink-0">${метка}</span>
                </div>`;
        }).join('');

        await dialog.custom(
            `<div class="divide-y divide-slate-700/60">${rows}</div>
             <p class="text-[10px] text-slate-500 mt-3 pt-3 border-t border-slate-700">${xp} XP</p>`,
            { title: t('profile.leagueLadder') }
        );
    },

};
