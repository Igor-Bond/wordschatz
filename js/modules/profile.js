import { auth } from '../services/auth.js';
import { sync } from '../services/sync.js';
import { install } from '../core/install.js';
import { masteryUtils } from '../core/mastery.js';
import { dialog } from '../core/dialog.js';
import { germanUtils } from '../core/german.js';
import { config } from '../config.js';
import { wiktionary } from '../services/wiktionary.js';
import { i18n, t, plural } from '../i18n/i18n.js';
import { aiService } from '../services/ai.js';
import { dbService } from '../services/db.js';
import { dateUtils } from '../core/dates.js';

export const profile = {
    render: async () => {
        document.body.classList.remove('lesson-mode');
        const main = document.getElementById('main-content');
        
        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-10">
                <div class="flex justify-between items-center mb-6 px-1">
                    <h2 class="text-2xl font-bold text-slate-100">${t('profile.title')}</h2>
                    <!--
                        Именно app.openSettings(), а не показ окна руками:
                        раньше кнопка просто снимала «hidden», поля оставались
                        со значениями по умолчанию из разметки, и сохранение
                        затирало выбранные при первом запуске уровень и норму.
                    -->
                    <button onclick="app.openSettings()" class="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                </div>
                
                <div class="flex bg-slate-800 rounded-xl p-1 mb-6 border border-slate-700">
                    <button onclick="profile.switchTab('stats')" id="tab-prof-stats" class="flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all">${t('profile.tabStats')}</button>
                    <button onclick="profile.switchTab('dict')" id="tab-prof-dict" class="flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all">${t('profile.tabDict')}</button>
                </div>

                <div id="prof-mode-stats" class="space-y-4 fade-in">
                    <div class="flex justify-center items-center py-10"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div></div>
                </div>
                <div id="prof-mode-dict" class="space-y-4 hidden fade-in"></div>
            </div>

            <!-- Модальное окно редактирования слова -->
            <div id="edit-word-modal" class="hidden fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 transition-opacity duration-200">
                <div class="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] scale-95 transition-transform duration-200" id="edit-modal-content">
                    <div class="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                        <h3 class="text-lg font-bold text-slate-100">${t('profile.wordCard')}</h3>
                        <button onclick="profile.closeEditModal()" class="text-slate-400 hover:text-white transition-colors"><i class="fa-solid fa-xmark text-xl"></i></button>
                    </div>
                    
                    <div class="p-4 overflow-y-auto space-y-4 flex-1 hide-scrollbar">
                        <input type="hidden" id="edit-id">
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-1">${t('profile.germanWord')}</label>
                            <input type="text" id="edit-word" class="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-bold text-lg transition-colors">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-1">${t('profile.translation')}</label>
                            <input type="text" id="edit-translation" class="w-full bg-slate-900 border border-slate-600 text-amber-500 font-bold rounded-lg px-3 py-2 outline-none focus:border-amber-500 transition-colors">
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 mb-1">Dativ / Rektion / Komp.</label>
                                <input type="text" id="edit-grammar1" class="w-full bg-slate-900 border border-slate-600 text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm transition-colors">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 mb-1">Plural / Präteritum</label>
                                <input type="text" id="edit-grammar2" class="w-full bg-slate-900 border border-slate-600 text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm transition-colors">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-1">${t('profile.exampleDe')}</label>
                            <textarea id="edit-example-de" class="w-full bg-slate-900 border border-slate-600 text-slate-200 italic rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm h-20 transition-colors"></textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-1">${t('profile.exampleTranslation')}</label>
                            <textarea id="edit-example-ru" class="w-full bg-slate-900 border border-slate-600 text-slate-400 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm h-20 transition-colors"></textarea>
                        </div>
                    </div>
                    
                    <div class="p-4 border-t border-slate-700 bg-slate-900/50">
                        <button onclick="profile.saveWordEdit()" class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl shadow transition-transform active:scale-95">${t('common.save')}</button>
                    </div>
                </div>
            </div>
        `;

        await profile.renderStats();
        await profile.renderDictionary();
    },

    switchTab: (tab) => {
        const tStats = document.getElementById('tab-prof-stats');
        const tDict = document.getElementById('tab-prof-dict');
        const mStats = document.getElementById('prof-mode-stats');
        const mDict = document.getElementById('prof-mode-dict');

        if (tab === 'stats') {
            tStats.className = "flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all";
            tDict.className = "flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all border border-transparent";
            mStats.classList.remove('hidden');
            mDict.classList.add('hidden');
        } else {
            tDict.className = "flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all";
            tStats.className = "flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all border border-transparent";
            mDict.classList.remove('hidden');
            mStats.classList.add('hidden');
        }
    },

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
     * Состояние поиска и фильтров словаря (§28 ТЗ).
     * Держим в модуле, чтобы переключение вкладок не сбрасывало запрос.
     */
    dictFilters: { query: '', type: 'all', status: 'all', sort: 'recent' },

    /** Все слова держим в памяти: фильтрация по сотням записей мгновенна. */
    _dictCache: [],

    WORD_TYPES: ['noun', 'verb', 'adjective', 'phrase'],

    STATUSES: ['all', 'difficult', 'learning', 'mastered', 'incomplete', 'mismatch'],

    SORTS: ['recent', 'alphabet', 'mastery'],

    /**
     * @param {boolean} reload перечитывать ли словарь из базы.
     *   При переключении фильтров данные те же — читать заново незачем.
     */
    renderDictionary: async (reload = true) => {
        const container = document.getElementById('prof-mode-dict');
        if (reload || !profile._dictCache.length) {
            profile._dictCache = await dbService.getAllWords();
        }

        const f = profile.dictFilters;
        const chip = (active) => active
            ? 'bg-amber-500 text-slate-900 border-amber-500'
            : 'bg-slate-900 text-slate-400 border-slate-600 hover:border-slate-500';

        container.innerHTML = `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg mb-4 space-y-3">
                <div class="relative">
                    <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                    <input type="text" id="dict-search" value="${profile.escapeAttr(f.query)}"
                        class="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded-xl pl-10 pr-10 py-2.5 outline-none focus:border-amber-500 text-sm transition-colors"
                        placeholder="${profile.escapeAttr(t('profile.searchPlaceholder'))}"
                        oninput="profile.onSearchInput(this.value)">
                    <button id="dict-search-clear" onclick="profile.onSearchInput('')"
                        class="${f.query ? '' : 'hidden'} absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="flex flex-wrap gap-1.5">
                    <button onclick="profile.setDictFilter('type','all')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${chip(f.type === 'all')}">${t('profile.filterAll')}</button>
                    ${profile.WORD_TYPES.map(type => `
                        <button onclick="profile.setDictFilter('type','${type}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${chip(f.type === type)}">${t('wordTypes.' + type)}</button>
                    `).join('')}
                </div>

                <div class="flex flex-wrap gap-1.5">
                    ${profile.STATUSES.map(status => `
                        <button onclick="profile.setDictFilter('status','${status}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${chip(f.status === status)}">${t('profile.status.' + status)}</button>
                    `).join('')}
                </div>

                <div class="flex items-center justify-between pt-1">
                    <span id="dict-count" class="text-[11px] text-slate-500"></span>
                    <select onchange="profile.setDictFilter('sort', this.value)"
                        class="bg-slate-900 border border-slate-600 text-slate-300 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-amber-500">
                        ${profile.SORTS.map(s => `<option value="${s}" ${f.sort === s ? 'selected' : ''}>${t('profile.sort.' + s)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg mb-4 flex justify-between gap-2">
                <button onclick="profile.exportData()" class="flex-1 py-3 bg-slate-900 border border-slate-600 text-slate-300 text-sm font-bold rounded-xl hover:text-amber-500 hover:border-amber-500 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <i class="fa-solid fa-download"></i> ${t('profile.export')}
                </button>

                <input type="file" id="import-file" accept=".json" class="hidden" onchange="profile.importData(event)">
                <button onclick="document.getElementById('import-file').click()" class="flex-1 py-3 bg-slate-900 border border-slate-600 text-slate-300 text-sm font-bold rounded-xl hover:text-green-500 hover:border-green-500 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <i class="fa-solid fa-upload"></i> ${t('profile.import')}
                </button>
            </div>

            <div id="dict-list" class="space-y-3"></div>
        `;

        profile.renderDictList();
    },

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

    /**
     * Полнота карточек.
     *
     * Модель иногда возвращает слово без грамматики, и заметить это можно
     * было только пролистав словарь. Здесь это одно число, по которому видно,
     * ухудшилась выдача или показалось.
     */
    renderCompleteness: (allWords) => {
        if (allWords.length === 0) return '';

        const incomplete = allWords.filter(w => germanUtils.missingFields(w).length > 0);
        const percent = Math.round(
            allWords.reduce((sum, w) => sum + germanUtils.completeness(w), 0) / allWords.length
        );

        const color = percent >= 90 ? 'text-green-400' : (percent >= 70 ? 'text-amber-500' : 'text-red-400');
        const bar = percent >= 90 ? 'bg-green-500' : (percent >= 70 ? 'bg-amber-500' : 'bg-red-500');

        // Одна строка вместо отдельной карточки: на телефоне экран статистики
        // и без того длинный, а тут достаточно числа и способа посмотреть, где
        // именно дыры
        return `
            <div class="bg-slate-800 px-4 py-3 rounded-2xl border border-slate-700 shadow-md flex items-center gap-3">
                <div class="min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-2">
                        <span class="text-xs font-bold text-slate-300">${t('profile.completeness')}</span>
                        <span class="text-sm font-black ${color}">${percent}%</span>
                    </div>
                    <div class="w-full bg-slate-900 rounded-full h-1.5 border border-slate-700 overflow-hidden mt-1.5">
                        <div class="h-full rounded-full ${bar}" style="width: ${percent}%"></div>
                    </div>
                </div>
                ${incomplete.length ? `
                    <button onclick="profile.showIncomplete()" title="${profile.escapeAttr(t('profile.completenessGaps', { words: plural('common.word', incomplete.length) }))}"
                        class="shrink-0 px-3 py-2 bg-slate-900 border border-slate-600 text-slate-300 text-xs font-bold rounded-xl hover:border-amber-500 hover:text-amber-500 active:scale-95 transition-all">
                        ${incomplete.length} <i class="fa-solid fa-arrow-right ml-1 text-[10px]"></i>
                    </button>
                    <button onclick="profile.completeAll()" id="prof-complete-all" title="${profile.escapeAttr(t('profile.completeAllHint'))}"
                        class="shrink-0 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-xl active:scale-95 transition-all">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>` : ''}
            </div>
        `;
    },

    /**
     * Сверка с Wiktionary.
     *
     * Карточки пишет языковая модель, и ошибку в роде или в Perfekt заметить
     * некому. Здесь видно, сколько слов сверено и где нашлись расхождения.
     */
    renderVerification: (allWords) => {
        const checkable = allWords.filter(w => ['noun', 'verb', 'adjective'].includes(w.type));
        if (checkable.length === 0) return '';

        const S = wiktionary.STATUS;
        const счёт = (status) => checkable.filter(w => (w.verified || 0) === status).length;

        const ok = счёт(S.OK);
        const mismatched = счёт(S.MISMATCH);
        const notFound = счёт(S.NOT_FOUND);
        const pending = checkable.length - ok - mismatched - notFound;

        return `
            <div class="bg-slate-800 px-4 py-3 rounded-2xl border border-slate-700 shadow-md">
                <div class="flex items-center gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="text-xs font-bold text-slate-300">${t('profile.verification')}</div>
                        <div class="text-[10px] text-slate-500 mt-0.5">
                            ${pending
                                ? t('profile.verifyPending', { count: pending })
                                : t('profile.verifyAllDone')}
                            ${mismatched ? ` · <span class="text-red-400 font-bold">${t('profile.verifyMismatched', { count: mismatched })}</span>` : ''}
                            ${notFound ? ` · ${t('profile.verifyNotFound', { count: notFound })}` : ''}
                        </div>
                    </div>
                    ${mismatched ? `
                        <button onclick="profile.showMismatched()"
                            class="shrink-0 px-3 py-2 bg-slate-900 border border-red-500/40 text-red-400 text-xs font-bold rounded-xl hover:border-red-500 active:scale-95 transition-all">
                            ${mismatched} <i class="fa-solid fa-arrow-right ml-1 text-[10px]"></i>
                        </button>` : ''}
                    ${pending ? `
                        <button onclick="profile.verifyAll()" id="prof-verify-btn" title="${profile.escapeAttr(t('profile.verifyHint'))}"
                            class="shrink-0 px-3 py-2 bg-slate-900 border border-slate-600 text-slate-300 text-xs font-bold rounded-xl hover:border-amber-500 hover:text-amber-500 active:scale-95 transition-all">
                            <i class="fa-solid fa-book-open-reader"></i>
                        </button>` : ''}
                </div>
            </div>
        `;
    },

    /** Сверить все ещё не сверенные слова. */
    verifyAll: async () => {
        const btn = document.getElementById('prof-verify-btn');
        const all = await dbService.getAllWords();
        const pending = all.filter(w =>
            ['noun', 'verb', 'adjective'].includes(w.type) && !(w.verified > 0)
        );

        if (!pending.length) return;

        const ok = await dialog.confirm(
            t('profile.verifyConfirm', { words: plural('common.word', pending.length) })
        );
        if (!ok) return;

        if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; }

        const results = await wiktionary.checkAll(pending, (done, total) => {
            if (btn) btn.innerHTML = `<span class="text-[10px]">${done}/${total}</span>`;
        });

        let mismatched = 0;
        let filled = 0;
        let failed = 0;

        for (const result of results) {
            // Слово, до которого не достучались, остаётся в очереди
            if (result.status === wiktionary.STATUS.UNCHECKED) { failed++; continue; }

            const changes = {
                verified: result.status,
                verifiedAt: Date.now(),
                mismatches: result.diffs
            };

            // Пустые поля Wiktionary закрывает бесплатно — грех не взять
            if (Object.keys(result.fill).length) {
                Object.assign(changes, result.fill);
                filled++;
            }

            await dbService.updateWord(result.word.id, changes);
            if (result.status === wiktionary.STATUS.MISMATCH) mismatched++;
        }

        profile._dictCache = [];
        await profile.renderStats();
        await profile.renderDictionary();

        await dialog.alert(
            t('profile.verifyDone', { checked: results.length - failed, mismatched, filled })
            + (failed ? `\n\n${t('profile.verifyFailed', { count: failed })}` : '')
        );
    },

    /** Разбор расхождений по одному слову. */
    showMismatches: async (id) => {
        const word = (await dbService.getAllWords()).find(w => w.id === id);
        if (!word?.mismatches?.length) return;

        const lines = word.mismatches
            .map(d => `${t('fields.' + d.field)}\n     ${t('profile.diffOurs')}: ${d.ours}\n     ${t('profile.diffTheirs')}: ${d.theirs}`)
            .join('\n\n');

        const choice = await dialog.choose(
            `${word.word}\n\n${lines}`,
            [
                { value: 'fix', label: t('profile.diffApply'), hint: t('profile.diffApplyHint'), primary: true },
                { value: 'keep', label: t('profile.diffKeep'), hint: t('profile.diffKeepHint') }
            ],
            { title: t('profile.diffTitle') }
        );

        if (choice === null) return;

        const changes = { verified: wiktionary.STATUS.OK, mismatches: [], verifiedAt: Date.now() };
        if (choice === 'fix') {
            for (const diff of word.mismatches) Object.assign(changes, diff.fix || {});
        }

        await dbService.updateWord(id, changes);
        profile._dictCache = [];
        await profile.renderDictionary();
        await profile.renderStats();
    },

    /** Словарь, отфильтрованный по расхождениям. */
    showMismatched: () => {
        profile.switchTab('dict');
        profile.dictFilters.status = 'mismatch';
        profile.renderDictionary();
    },

    /**
     * Дозаполнение карточек через ИИ.
     *
     * Просим только недостающие поля и записываем только их: ручные правки
     * и уже заполненное не трогаем. Порциями по восемь — в один ответ
     * больше не влезает, а обрыв JSON стоит целой порции.
     *
     * @param {Array} words слова из базы
     * @param {Function} onProgress (обработано, всего)
     * @returns {Promise<number>} сколько карточек изменилось
     */
    completeCards: async (words, onProgress = null) => {
        const BATCH = 8;
        const touched = new Set();

        // Сначала Wiktionary: он точнее модели и не тратит квоту ключа.
        // Модель добьёт то, чего в словарной статье нет, — примеры и синонимы
        const остаток = [];
        for (const word of words) {
            let changes = {};
            try {
                const entry = await wiktionary.lookup(word);
                if (entry) changes = wiktionary.fillFrom(word, entry);
            } catch (e) {
                console.error('[Словарь] Wiktionary недоступен:', e);
            }

            if (Object.keys(changes).length) {
                await dbService.updateWord(word.id, changes);
                touched.add(word.id);
                Object.assign(word, changes);      // чтобы модель не просили о том же
            }

            if (germanUtils.missingFields(word).length) остаток.push(word);
        }

        words = остаток;
        if (!words.length) return touched.size;

        for (let i = 0; i < words.length; i += BATCH) {
            const batch = words.slice(i, i + BATCH);

            const request = batch.map(w => ({
                word: w.word,
                type: w.type,
                missing: germanUtils.missingFields(w)
            }));

            let filled = [];
            try {
                filled = await aiService.completeCards(request);
            } catch (e) {
                console.error('[Словарь] Порция не дозаполнилась:', e);
                if (onProgress) onProgress(Math.min(i + BATCH, words.length), words.length);
                continue;
            }

            for (const local of batch) {
                const key = String(local.word).toLowerCase().trim();
                const remote = filled.find(f => String(f.word).toLowerCase().trim() === key);
                if (!remote) continue;

                // Пишем только то, чего не было: ответ модели не должен
                // затирать ни правки пользователя, ни удачные прошлые поля
                const changes = {};
                for (const field of germanUtils.missingFields(local)) {
                    const value = remote[field];
                    if (value === undefined || value === null) continue;
                    if (typeof value === 'string' && !value.trim()) continue;
                    changes[field] = value;
                }

                if (Object.keys(changes).length) {
                    await dbService.updateWord(local.id, changes);
                    touched.add(local.id);
                }
            }

            if (onProgress) onProgress(Math.min(i + BATCH, words.length), words.length);
        }

        return touched.size;
    },

    /** Дозаполнить все неполные карточки словаря. */
    completeAll: async () => {
        const btn = document.getElementById('prof-complete-all');
        const all = await dbService.getAllWords();
        const incomplete = all.filter(w => germanUtils.missingFields(w).length > 0);

        if (!incomplete.length) return;

        const ok = await dialog.confirm(
            t('profile.completeAllConfirm', { words: plural('common.word', incomplete.length) })
        );
        if (!ok) return;

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
        }

        try {
            const updated = await profile.completeCards(incomplete, (done, total) => {
                if (btn) btn.innerHTML = `<span class="text-[10px]">${done}/${total}</span>`;
            });

            profile._dictCache = [];
            await profile.renderStats();
            await profile.renderDictionary();
            await dialog.alert(t('profile.completeDone', { words: plural('common.word', updated) }));
        } catch (e) {
            console.error('[Словарь] Дозаполнение не удалось:', e);
            await dialog.alert(e?.message || t('common.error'));
            await profile.renderStats();
        }
    },

    /** Дозаполнить одну карточку. */
    completeOne: async (id) => {
        const btn = document.getElementById(`complete-${id}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
        }

        const word = (await dbService.getAllWords()).find(w => w.id === id);
        if (!word) return;

        try {
            const updated = await profile.completeCards([word]);
            profile._dictCache = [];
            await profile.renderDictionary();
            await profile.renderStats();

            if (!updated) await dialog.alert(t('profile.completeNothing'));
        } catch (e) {
            console.error('[Словарь] Дозаполнение не удалось:', e);
            await dialog.alert(e?.message || t('common.error'));
            await profile.renderDictionary();
        }
    },

    /** Переход в словарь с фильтром по неполным карточкам. */
    showIncomplete: () => {
        profile.switchTab('dict');
        profile.dictFilters.status = 'incomplete';
        profile.renderDictionary();
    },

    renderAccountCard: () => {
        if (!auth.isConfigured()) return '';

        const user = auth.user;
        const last = Number(config.get(sync.LAST_SYNC_KEY) || 0);
        const when = last
            ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(last))
            : t('sync.never');

        if (!user) {
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
     * Слово с подсветкой рода: der синий, die красный, das зелёный.
     * Общепринятая мнемоника — цвет запоминается вместе со словом.
     */
    renderWordWithGender: (word) => {
        const gender = germanUtils.getGender(word);
        if (!gender) return word.word;

        const color = germanUtils.GENDER_COLORS[gender] || 'text-slate-400';
        return `<span class="${color}">${gender}</span> ${germanUtils.stripArticle(word)}`;
    },

    /** Экранирование для подстановки в атрибут. */
    escapeAttr: (str) => String(str ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;'),

    onSearchInput: (value) => {
        profile.dictFilters.query = value;

        const input = document.getElementById('dict-search');
        if (input && input.value !== value) input.value = value;

        const clear = document.getElementById('dict-search-clear');
        if (clear) clear.classList.toggle('hidden', !value);

        profile.renderDictList();
    },

    setDictFilter: (key, value) => {
        profile.dictFilters[key] = value;
        // Перерисовываем и панель (подсветка активной кнопки), и список,
        // но без повторного чтения базы
        return profile.renderDictionary(false);
    },

    /** Отбор и сортировка по текущим фильтрам. */
    getFilteredWords: () => {
        const { query, type, status, sort } = profile.dictFilters;
        const needle = query.trim().toLowerCase();

        let words = profile._dictCache.filter(w => {
            if (type !== 'all' && w.type !== type) return false;

            if (status === 'difficult' && !masteryUtils.isWeak(w)) return false;
            if (status === 'mastered' && !masteryUtils.isLearned(w)) return false;
            if (status === 'learning' && (!(w.repetitions > 0) || masteryUtils.isLearned(w))) return false;
            if (status === 'incomplete' && germanUtils.missingFields(w).length === 0) return false;
            if (status === 'mismatch' && !(w.mismatches && w.mismatches.length)) return false;

            if (!needle) return true;

            // Ищем и по немецкому, и по переводу, и по теме
            return [w.word, w.translation, w.topic, w.synonym, w.gegenteil]
                .some(field => String(field ?? '').toLowerCase().includes(needle));
        });

        if (sort === 'alphabet') {
            words = words.sort((a, b) => String(a.word).localeCompare(String(b.word), 'de'));
        } else if (sort === 'mastery') {
            words = words.sort((a, b) => (a.mastery || 0) - (b.mastery || 0));
        }
        // 'recent' — порядок уже такой, getAllWords отдаёт свежие первыми

        return words;
    },

    renderDictList: () => {
        const list = document.getElementById('dict-list');
        const counter = document.getElementById('dict-count');
        if (!list) return;

        const words = profile.getFilteredWords();

        if (counter) {
            counter.innerText = t('profile.shownCount', { shown: words.length, total: profile._dictCache.length });
        }

        if (profile._dictCache.length === 0) {
            list.innerHTML = `<p class="text-center text-slate-500 py-6">${t('profile.emptyDict')}</p>`;
            return;
        }

        if (words.length === 0) {
            list.innerHTML = `
                <div class="text-center text-slate-500 py-10">
                    <i class="fa-solid fa-magnifying-glass text-3xl mb-3 opacity-40"></i>
                    <p class="text-sm">${t('profile.nothingFound')}</p>
                </div>`;
            return;
        }

        list.innerHTML = words.map(w => {
            const safeWordStr = (w.word || '').replace(/'/g, "\\'");
            const gaps = germanUtils.missingFields(w);
            const accent = masteryUtils.isLearned(w) ? 'bg-green-500' : (masteryUtils.isWeak(w) ? 'bg-red-500' : 'bg-slate-600');

            return `
                <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center group relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 w-1 ${accent}"></div>

                    <div class="pl-2 flex-1 mr-3 cursor-pointer min-w-0" onclick="profile.openEditModal(${w.id})">
                        <h4 class="text-lg font-bold text-slate-100 break-words">${profile.renderWordWithGender(w)}</h4>
                        <p class="text-sm text-amber-500 break-words">${w.translation}</p>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="text-[10px] text-slate-500 uppercase">${t('wordTypes.' + (profile.WORD_TYPES.includes(w.type) ? w.type : 'phrase'))}</span>
                            <span class="text-[10px] text-slate-500 uppercase">${t('profile.mastery', { percent: w.mastery || 0 })}</span>
                            ${w.isDifficult ? `<span class="text-[10px] bg-red-900/30 text-red-500 px-1.5 rounded uppercase font-bold border border-red-500/20">${t('profile.hardBadge')}</span>` : ''}
                            ${gaps.length ? `<span class="text-[10px] bg-amber-900/30 text-amber-500 px-1.5 rounded uppercase font-bold border border-amber-500/20" title="${profile.escapeAttr(gaps.join(', '))}">${t('profile.incompleteBadge', { count: gaps.length })}</span>` : ''}
                            ${w.mismatches?.length ? `<span onclick="event.stopPropagation(); profile.showMismatches(${w.id})" class="text-[10px] bg-red-900/40 text-red-400 px-1.5 rounded uppercase font-bold border border-red-500/30 cursor-pointer">${t('profile.mismatchBadge', { count: w.mismatches.length })}</span>` : ''}
                            ${w.verified === 1 ? `<span class="text-[10px] text-green-500/80" title="${profile.escapeAttr(t('profile.verifiedBadge'))}"><i class="fa-solid fa-circle-check"></i></span>` : ''}
                        </div>
                    </div>

                    <div class="flex gap-1.5 shrink-0">
                        ${gaps.length ? `
                            <button onclick="profile.completeOne(${w.id})" id="complete-${w.id}" title="${profile.escapeAttr(t('profile.completeOne'))}"
                                class="w-9 h-9 bg-amber-500/15 text-amber-500 rounded-lg flex items-center justify-center border border-amber-500/30 hover:bg-amber-500/25 transition-colors active:scale-95">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </button>` : ''}
                        <button onclick="profile.toggleDifficult(${w.id})" title="${profile.escapeAttr(t('profile.toggleHard'))}"
                            class="w-9 h-9 rounded-lg flex items-center justify-center border border-transparent transition-colors active:scale-95 ${
                                w.isDifficult ? 'bg-red-900/30 text-red-500 hover:border-red-900' : 'bg-slate-700 text-slate-400 hover:text-red-400'
                            }">
                            <i class="fa-solid fa-fire"></i>
                        </button>
                        <button onclick="profile.openEditModal(${w.id})" class="w-9 h-9 bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center border border-transparent hover:border-slate-500 transition-colors active:scale-95">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="profile.deleteWord(${w.id}, '${safeWordStr}')" class="w-9 h-9 bg-red-900/20 text-red-500 rounded-lg flex items-center justify-center border border-transparent hover:border-red-900 transition-colors active:scale-95">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Пометка слова сложным вручную (§16 ТЗ).
     * Раньше признак ставился только автоматически по итогам контроля,
     * а «Только сложные» в Комнате опиралось именно на него.
     */
    toggleDifficult: async (id) => {
        const word = profile._dictCache.find(w => w.id === id);
        if (!word) return;

        const next = word.isDifficult ? 0 : 1;
        await dbService.updateWord(id, { isDifficult: next });
        word.isDifficult = next;

        profile.renderDictList();
    },

    openEditModal: async (id) => {
        const word = await dbService.getWordById(id);
        if (!word) return;

        document.getElementById('edit-id').value = word.id;
        document.getElementById('edit-word').value = word.word || '';
        document.getElementById('edit-translation').value = word.translation || '';
        document.getElementById('edit-example-de').value = word.example_de || '';
        document.getElementById('edit-example-ru').value = word.example_ru || '';

        document.getElementById('edit-grammar1').value = word.dativ || word.rektion || word.comparative || '';
        document.getElementById('edit-grammar2').value = word.plural || word.preterite || word.superlative || '';

        const modal = document.getElementById('edit-word-modal');
        const content = document.getElementById('edit-modal-content');
        
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }, 10);
    },

    closeEditModal: () => {
        const modal = document.getElementById('edit-word-modal');
        const content = document.getElementById('edit-modal-content');
        
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); }, 200);
    },

    saveWordEdit: async () => {
        const id = parseInt(document.getElementById('edit-id').value);
        if (!id) return;

        const word = await dbService.getWordById(id);
        if (!word) return;

        word.word = document.getElementById('edit-word').value.trim();
        word.translation = document.getElementById('edit-translation').value.trim();
        word.example_de = document.getElementById('edit-example-de').value.trim();
        word.example_ru = document.getElementById('edit-example-ru').value.trim();
        
        const grammar1 = document.getElementById('edit-grammar1').value.trim();
        const grammar2 = document.getElementById('edit-grammar2').value.trim();
        
        if (word.type === 'noun') {
            word.dativ = grammar1;
            word.plural = grammar2;
        } else if (word.type === 'verb') {
            word.rektion = grammar1;
            word.preterite = grammar2;
        } else if (word.type === 'adjective') {
            word.comparative = grammar1;
            word.superlative = grammar2;
        }

        // Формы изменились — прошлая сверка к ним больше не относится,
        // слово возвращается в очередь на проверку
        word.verified = wiktionary.STATUS.UNCHECKED;
        word.mismatches = [];

        await dbService.putWord(word);
        profile.closeEditModal();
        profile.renderDictionary(); 
    },

    deleteWord: async (id, wordStr) => {
        const ok = await dialog.confirm(t('profile.deleteConfirm', { word: wordStr }), {
            danger: true,
            okLabel: t('common.delete')
        });
        if (ok) {
            await dbService.deleteWord(id);
            profile.renderDictionary();
            profile.renderStats();
        }
    },

    /**
     * Полная резервная копия: словарь вместе с прогрессом SRS, темами,
     * планами, XP, лигой и стриком. API-ключ в копию не входит.
     */
    exportData: async () => {
        const backup = await dbService.exportAll();

        if (backup.words.length === 0) return await dialog.alert(t('profile.exportEmpty'));

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `wortschatz_backup_${dateUtils.today()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importData: (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (dbService.isFullBackup(data)) {
                    await profile.importFullBackup(data);
                } else if (Array.isArray(data)) {
                    // Копии старого формата — просто список слов
                    await profile.importLegacyWords(data);
                } else {
                    throw new Error(t('profile.unknownFormat'));
                }

                profile.renderDictionary();
                profile.renderStats();
            } catch (err) {
                console.error('Импорт не удался:', err);
                await dialog.alert(t('profile.importFailed') + '\n\n' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    importFullBackup: async (data) => {
        const when = data.exportedAt ? data.exportedAt.slice(0, 10) : t('profile.unknownDate');
        // Раньше выбор объяснялся текстом «ОК — заменить, Отмена — добавить»:
        // системный confirm умеет только две кнопки без подписей.
        const choice = await dialog.choose(
            t('profile.importSummary', {
                date: when,
                words: data.words.length,
                cycles: data.cycles?.length || 0
            }),
            [
                { value: 'merge', label: t('profile.importMerge'), hint: t('profile.importMergeHint'), primary: true },
                { value: 'replace', label: t('profile.importReplace'), hint: t('profile.importReplaceHint'), danger: true }
            ],
            { title: t('profile.import') }
        );

        if (choice === null) return;   // отменили

        if (choice === 'replace') {
            const result = await dbService.restoreFromBackup(data);

            // Профиль из копии поднимаем в localStorage, ключ остаётся местный
            if (data.profile) {
                const map = { name: 'name', level: 'level', dailyGoal: 'daily_goal',
                              interests: 'interests', model: 'model', uiLang: 'ui_lang' };
                for (const [field, key] of Object.entries(map)) {
                    if (data.profile[field] !== undefined && data.profile[field] !== null) {
                        localStorage.setItem(`ws_${key}`, data.profile[field]);
                    }
                }
            }

            await dialog.alert(t('profile.restored', {
                words: result.words,
                cycles: result.cycles,
                dayPlans: result.dayPlans
            }));
            location.reload();
            return;
        }

        // Слияние: чужие темы и планы не переносим, слова остаются вне тем
        const words = data.words.map(({ id, cycleId, ...w }) => ({ ...w, cycleId: null }));
        const { count } = await dbService.saveMultipleWords(words);
        await dialog.alert(t('profile.mergedFromBackup', { count }));
    },

    importLegacyWords: async (words) => {
        const { count } = await dbService.saveMultipleWords(words);
        await dialog.alert(t('profile.importedLegacy', { count }));
    }
};