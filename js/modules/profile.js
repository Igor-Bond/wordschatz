import { germanUtils } from '../core/german.js';
import { config } from '../config.js';
import { t, plural } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { dateUtils } from '../core/dates.js';

export const profile = {
    render: async () => {
        const main = document.getElementById('main-content');
        
        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-10">
                <div class="flex justify-between items-center mb-6 px-1">
                    <h2 class="text-2xl font-bold text-slate-100">${t('profile.title')}</h2>
                    <button onclick="document.getElementById('settings-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('settings-modal').classList.remove('opacity-0'), 10);" class="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow">
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
            const masteredCount = allWords.filter(w => w.mastery === 100).length;
            const difficultCount = allWords.filter(w => w.isDifficult === 1).length;

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
                ${profile.renderActivityChart(activity)}

                <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">${t('profile.dictStats')}</h3>
                <div class="grid grid-cols-3 gap-3">
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center flex flex-col justify-center shadow-md">
                        <div class="text-2xl font-black text-slate-100">${totalWords}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-1 font-bold">${t('profile.totalWords')}</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center flex flex-col justify-center shadow-md border-b-2 border-b-green-500/50">
                        <div class="text-2xl font-black text-green-400">${masteredCount}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-1 font-bold">${t('profile.mastered')}</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center flex flex-col justify-center relative overflow-hidden shadow-md border-b-2 border-b-red-500/50">
                        <div class="text-2xl font-black text-red-400">${difficultCount}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-1 font-bold">${t('profile.difficult')}</div>
                    </div>
                </div>

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

    STATUSES: ['all', 'difficult', 'learning', 'mastered'],

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
        const xpMonth = activity.reduce((s, d) => s + d.xp, 0);
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

                <div class="grid grid-cols-3 gap-2 pt-3 border-t border-slate-700">
                    <div class="text-center">
                        <div class="text-lg font-black text-amber-500">${xpWeek}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-0.5">${t('profile.xpWeek')}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-black text-amber-500">${xpMonth}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-0.5">${t('profile.xpMonth')}</div>
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

            if (status === 'difficult' && !w.isDifficult) return false;
            if (status === 'mastered' && (w.mastery || 0) < 100) return false;
            if (status === 'learning' && (!(w.repetitions > 0) || (w.mastery || 0) >= 100)) return false;

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
            const accent = w.mastery === 100 ? 'bg-green-500' : (w.isDifficult ? 'bg-red-500' : 'bg-slate-600');

            return `
                <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center group relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 w-1 ${accent}"></div>

                    <div class="pl-2 flex-1 mr-3 cursor-pointer min-w-0" onclick="profile.openEditModal(${w.id})">
                        <h4 class="text-lg font-bold text-slate-100 truncate">${profile.renderWordWithGender(w)}</h4>
                        <p class="text-sm text-amber-500 truncate">${w.translation}</p>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="text-[10px] text-slate-500 uppercase">${t('wordTypes.' + (profile.WORD_TYPES.includes(w.type) ? w.type : 'phrase'))}</span>
                            <span class="text-[10px] text-slate-500 uppercase">${t('profile.mastery', { percent: w.mastery || 0 })}</span>
                            ${w.isDifficult ? `<span class="text-[10px] bg-red-900/30 text-red-500 px-1.5 rounded uppercase font-bold border border-red-500/20">${t('profile.hardBadge')}</span>` : ''}
                        </div>
                    </div>

                    <div class="flex gap-1.5 shrink-0">
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

        await dbService.putWord(word);
        profile.closeEditModal();
        profile.renderDictionary(); 
    },

    deleteWord: async (id, wordStr) => {
        if (confirm(t('profile.deleteConfirm', { word: wordStr }))) {
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

        if (backup.words.length === 0) return alert(t('profile.exportEmpty'));

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
                alert(t('profile.importFailed') + '\n\n' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    importFullBackup: async (data) => {
        const when = data.exportedAt ? data.exportedAt.slice(0, 10) : t('profile.unknownDate');
        const replace = confirm(t('profile.importChoice', {
            date: when,
            words: data.words.length,
            cycles: data.cycles?.length || 0
        }));

        if (replace) {
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

            alert(t('profile.restored', {
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
        alert(t('profile.mergedFromBackup', { count }));
    },

    importLegacyWords: async (words) => {
        const { count } = await dbService.saveMultipleWords(words);
        alert(t('profile.importedLegacy', { count }));
    }
};