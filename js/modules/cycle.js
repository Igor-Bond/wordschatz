import { actions } from '../core/actions.js';
import { wiktionary } from '../services/wiktionary.js';
import { frequency } from '../core/frequency.js';
import { dialog } from '../core/dialog.js';
import { config } from '../config.js';
import { t, plural } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { aiService } from '../services/ai.js';
import { scheduler } from '../core/scheduler.js';
import { dashboard } from './dashboard.js';

/**
 * Учебный цикл: выбор темы → генерация набора → предпросмотр и утверждение →
 * раскладка по дням (§2, §4, §5 ТЗ).
 *
 * Это то место, которого раньше не было: таблицы cycles и dayPlans читались,
 * но никто их не создавал.
 */
export const cycle = {

    state: {
        topic: '',
        days: 7,
        words: []
    },

    /** Темы из §4 ТЗ — как быстрые подсказки, свою тему всегда можно ввести. */
    SUGGESTED_TOPIC_KEYS: [
        'everyday', 'travel', 'food', 'work', 'health',
        'engineRepair', 'carDiagnostics', 'basketball',
        'microelectronics', 'electronics'
    ],

    /**
     * Интересы пользователя как темы для набора слов.
     *
     * Интересы спрашивают при первом запуске, а пользовались ими только
     * примеры в карточках и рассказы в чате. В выборе темы висел
     * неизменный список из десяти пунктов — «ремонт двигателя»,
     * «микроэлектроника», «баскетбол», — написанный когда-то в ТЗ и не
     * имеющий отношения к тому, что человек про себя рассказал. Он и
     * читался как набор непонятных вкладок.
     *
     * Разделитель любой разумный: запятая, точка с запятой, перевод
     * строки. Люди пишут интересы как придётся.
     */
    interestTopics: (interests) => [...new Set(
        String(interests ?? '')
            .split(/[,;\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 1 && s.length <= 40)
            .map(s => s[0].toUpperCase() + s.slice(1))
    )].slice(0, 8),

    DURATIONS: [5, 7, 10, 14],

    /** Экранирование: слова приходят от ИИ и из фото, в разметку их нельзя вставлять сырыми. */
    esc: (str) => String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'),

    // ======================================================
    //  Шаг 1. Выбор темы
    // ======================================================

    renderTopicPicker: () => {
        document.body.classList.remove('lesson-mode');
        const main = document.getElementById('main-content');
        const profile = config.getProfile();
        const wordsCount = cycle.state.days * profile.dailyGoal;
        const свои = cycle.interestTopics(profile.interests);

        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-10">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-500/30">
                        <i class="fa-solid fa-compass-drafting"></i>
                    </div>
                    <h2 class="text-2xl font-bold text-slate-100 mb-2">${t('cycle.newTopic')}</h2>
                    <p class="text-slate-400 text-sm">${t('cycle.intro', { level: profile.level })}</p>
                </div>

                <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg mb-4">
                    <label for="cycle-topic-input" class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">${t('cycle.topicLabel')}</label>
                    <input type="text" id="cycle-topic-input"
                        class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 transition-colors"
                        placeholder="${cycle.esc(t('cycle.topicPlaceholder'))}" value="${cycle.esc(cycle.state.topic)}">

                    <!--
                        Сначала интересы человека, потом общий список.
                        Порядок не косметический: своё узнаётся мгновенно,
                        а чужое приходится читать.
                    -->
                    ${свои.length ? `
                        <p class="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider mt-4 mb-2">${t('cycle.fromInterests')}</p>
                        <div class="flex flex-wrap gap-2">
                            ${свои.map(label => `
                                <button data-action="cycle.pickTopic" data-topic="${actions.attr(label)}"
                                    class="px-3 py-1.5 bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-bold rounded-lg hover:bg-amber-500/20 active:scale-95 transition-all">
                                    ${cycle.esc(label)}
                                </button>`).join('')}
                        </div>
                        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4 mb-2">${t('cycle.orAnother')}</p>
                    ` : ''}

                    <div class="flex flex-wrap gap-2 ${свои.length ? '' : 'mt-3'}">
                        ${cycle.SUGGESTED_TOPIC_KEYS.map(key => {
                            const label = t('cycle.topics.' + key);
                            return `
                            <button data-action="cycle.pickTopic" data-topic="${actions.attr(label)}"
                                class="px-3 py-1.5 bg-slate-900 border border-slate-600 text-slate-300 text-xs font-medium rounded-lg hover:border-amber-500 hover:text-amber-500 active:scale-95 transition-all">
                                ${cycle.esc(label)}
                            </button>`;
                        }).join('')}
                    </div>
                </div>

                <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg mb-6">
                    <!--
                        Не <label>, а заголовок группы: подпись стоит над
                        четырьмя кнопками, а не над полем. Экранный чтец на
                        <label> без поля спотыкается — объявляет подпись и
                        не говорит, к чему она. role="group" с
                        aria-labelledby связывает её со всеми кнопками сразу.
                    -->
                    <div id="cycle-duration-label" class="block text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">${t('cycle.durationLabel')}</div>
                    <div role="group" aria-labelledby="cycle-duration-label" class="grid grid-cols-4 gap-2">
                        ${cycle.DURATIONS.map(d => `
                            <button onclick="cycle.pickDuration(${d})"
                                class="py-3 rounded-xl border-2 font-bold transition-all active:scale-95 ${
                                    d === cycle.state.days
                                        ? 'bg-amber-500 border-amber-500 text-slate-900'
                                        : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-500'
                                }">
                                <div class="text-lg leading-none">${d}</div>
                                <div class="text-[10px] font-medium opacity-70 mt-1">${plural('common.dayShort', d)}</div>
                            </button>
                        `).join('')}
                    </div>
                    <p class="text-xs text-slate-500 mt-3">
                        ${t('cycle.durationSummary', {
                            days: plural('common.day', cycle.state.days),
                            goal: profile.dailyGoal,
                            total: wordsCount
                        })}
                    </p>
                </div>

                <button onclick="cycle.generate()"
                    class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 text-lg font-black rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-95 transition-all">
                    ${t('cycle.generate')}
                </button>

                <button onclick="dashboard.render()"
                    class="w-full mt-3 py-3 text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors">
                    ${t('common.later')}
                </button>
            </div>
        `;
    },

    pickTopic: (el) => {
        const topic = el.dataset.topic ?? '';
        cycle.state.topic = topic;
        const input = document.getElementById('cycle-topic-input');
        if (input) input.value = topic;
    },

    pickDuration: (days) => {
        const input = document.getElementById('cycle-topic-input');
        if (input) cycle.state.topic = input.value;
        cycle.state.days = days;
        cycle.renderTopicPicker();
    },

    // ======================================================
    //  Шаг 2. Генерация набора
    // ======================================================

    generate: async () => {
        const input = document.getElementById('cycle-topic-input');
        const topic = (input?.value || '').trim();

        if (!topic) {
            await dialog.alert(t('cycle.topicRequired'));
            return;
        }

        cycle.state.topic = topic;
        const profile = config.getProfile();
        const target = cycle.state.days * profile.dailyGoal;

        cycle.renderLoader(topic, 0, target);

        try {
            const words = await aiService.generateSet(topic, target, (done, total) => {
                cycle.updateLoader(done, total);
            });

            if (!words || words.length === 0) {
                throw new Error(t('cycle.emptyResult'));
            }

            // Вторая фаза: сверка с Wiktionary до того, как слова попадут
            // в план. Неверный род или форма, замеченные потом, — это дни
            // заучивания неправильного
            cycle.state.check = await cycle.verify(words);

            // Третья: раскладка по частоте. Модель выдаёт слова в
            // случайном порядке, и «стиральная машина» может оказаться
            // первой, а «дверь» — двадцатой. Учить надо наоборот
            await frequency.load().catch(e => console.error('[Частотность] Список не загрузился:', e));

            cycle.state.words = frequency.sort(words).map(w => ({ ...w, selected: true }));
            cycle.renderPreview();
        } catch (error) {
            cycle.renderError(error.message);
        }
    },

    /**
     * Сверка сгенерированного набора со словарной статьёй.
     * Возвращает сводку для показа в предпросмотре.
     */
    verify: async (words) => {
        cycle.updateLoader(0, words.length, t('cycle.verifying'));

        const result = await wiktionary.enrich(words, (done, total) => {
            cycle.updateLoader(done, total, t('cycle.verifying'));
        });

        console.log(`[Тема] Сверка: исправлено ${result.fixed}, дополнено ${result.filled}, не проверено ${result.unchecked}`);
        return result;
    },

    /**
     * Итог сверки в предпросмотре.
     *
     * Исправления делаются молча, но пользователь должен знать, что модель
     * ошибалась и насколько часто: это единственный способ понять, стоит ли
     * доверять карточкам, которые сверить не удалось.
     */
    renderCheckSummary: () => {
        const summary = wiktionary.summary(cycle.state.check);
        if (!summary) return '';

        return `
            <div class="mb-4 px-3 py-2 rounded-xl border text-xs flex items-start gap-2 ${
                summary.alarming ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-green-500/10 border-green-500/30 text-green-300'
            }">
                <i class="fa-solid ${summary.alarming ? 'fa-triangle-exclamation' : 'fa-circle-check'} mt-0.5 shrink-0"></i>
                <span>${summary.text}</span>
            </div>
        `;
    },

    renderLoader: (topic, done, total) => {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center fade-in max-w-sm mx-auto">
                <div class="animate-spin rounded-full h-14 w-14 border-t-4 border-amber-500 mb-6"></div>
                <h3 class="text-xl font-bold text-slate-100 mb-2" id="cycle-progress-title">${t('cycle.loadingTitle')}</h3>
                <p class="text-slate-400 text-sm mb-6">${t('cycle.loadingTopic', { topic: cycle.esc(topic) })}</p>

                <div class="w-full bg-slate-800 rounded-full h-2 border border-slate-700 overflow-hidden">
                    <div id="cycle-progress-bar" class="bg-amber-500 h-2 rounded-full transition-all duration-500" style="width: 0%"></div>
                </div>
                <p id="cycle-progress-text" class="text-xs text-slate-500 mt-3">${t('cycle.loadingProgress', { done, total })}</p>
                <p class="text-[11px] text-slate-600 mt-6 max-w-xs">${t('cycle.loadingHint')}</p>
            </div>
        `;
    },

    /**
     * @param {string} label подпись фазы; без неё показывается сбор слов
     */
    updateLoader: (done, total, label = null) => {
        const bar = document.getElementById('cycle-progress-bar');
        const text = document.getElementById('cycle-progress-text');
        const title = document.getElementById('cycle-progress-title');

        if (bar) bar.style.width = `${Math.round((done / Math.max(total, 1)) * 100)}%`;
        if (text) text.innerText = t('cycle.loadingProgress', { done, total });
        if (title && label) title.innerText = label;
    },

    renderError: (message) => {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center fade-in max-w-sm mx-auto">
                <div class="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-3xl mb-6 border border-red-500/30">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3 class="text-xl font-bold text-slate-100 mb-2">${t('common.error')}</h3>
                <p class="text-slate-400 text-sm mb-8">${cycle.esc(message)}</p>
                <button onclick="cycle.renderTopicPicker()" class="w-full py-4 bg-amber-500 text-slate-900 font-black rounded-xl active:scale-95 transition-transform">
                    ${t('common.tryAgain')}
                </button>
            </div>
        `;
    },

    // ======================================================
    //  Шаг 3. Предпросмотр и утверждение (§5 ТЗ)
    // ======================================================

    /**
     * Метка частотности у слова в предпросмотре.
     *
     * Ядро и частое подписываем, редкое отмечаем приглушённо, а очень
     * редкое — красным: именно его человек чаще всего и снимет. Молчать
     * о редкости нельзя: набор придумывает модель, и «стиральная машина»
     * рядом с «дверью» выглядит так же уверенно.
     */
    FREQUENCY_BADGE: {
        core: 'text-green-400 bg-green-400/10 border-green-400/20',
        common: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
        rare: 'text-amber-500/80 bg-amber-500/5 border-amber-500/20',
        unknown: 'text-red-400/80 bg-red-400/5 border-red-400/20'
    },

    renderFrequencyBadge: (word) => {
        if (!frequency.ready) return '';

        const полоса = frequency.band(word);
        const место = frequency.rank(word);

        return `<span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${cycle.FREQUENCY_BADGE[полоса]}"
                      title="${место ? t('frequency.rank', { rank: место }) : t('frequency.notInList')}">
                    ${t('frequency.' + полоса)}
                </span>`;
    },

    /**
     * Сводка по частотности над списком.
     *
     * Главное число здесь — сколько слов набора действительно
     * встретятся. Оно решает, брать тему целиком или проредить.
     */
    renderFrequencySummary: () => {
        if (!frequency.ready) return '';

        const с = frequency.summarise(cycle.state.words);
        const доля = Math.round(с.полезных / с.всего * 100);

        return `
            <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 mb-4">
                <p class="text-xs text-slate-300">
                    ${t('frequency.summary', { useful: с.полезных, total: с.всего, percent: доля })}
                </p>
                <p class="text-[10px] text-slate-500 mt-1">
                    ${t('frequency.breakdown', { core: с.core, common: с.common, rare: с.rare + с.unknown })}
                </p>
                ${с.rare + с.unknown > 0 ? `
                    <button onclick="cycle.dropRare()"
                        class="w-full mt-2 py-2 bg-slate-900 border border-slate-600 text-slate-300 text-[11px] font-bold rounded-lg hover:border-amber-500 hover:text-amber-500 active:scale-95 transition-all">
                        ${t('frequency.dropRare', { count: с.rare + с.unknown })}
                    </button>` : ''}
            </div>`;
    },

    /** Снять галочки со всего, что редко встречается. */
    dropRare: () => {
        for (const w of cycle.state.words) {
            if (['rare', 'unknown'].includes(frequency.band(w.word))) w.selected = false;
        }
        cycle.renderPreview();
    },

    renderPreview: () => {
        const main = document.getElementById('main-content');
        const profile = config.getProfile();
        const selected = cycle.state.words.filter(w => w.selected).length;
        const days = Math.ceil(selected / profile.dailyGoal);

        // Сняли галочки — набор стал короче задуманного, и тема пройдёт
        // не за то число дней, которое выбрали. Предлагаем добрать.
        const target = cycle.state.days * profile.dailyGoal;
        const missing = Math.max(0, target - selected);

        const badgeColors = {
            noun: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
            verb: 'text-green-400 bg-green-400/10 border-green-400/20',
            adjective: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
            phrase: 'text-amber-400 bg-amber-400/10 border-amber-400/20'
        };

        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-32">
                <div class="mb-4">
                    <h2 class="text-2xl font-bold text-slate-100">${t('cycle.previewTitle', { topic: cycle.esc(cycle.state.topic) })}</h2>
                    <p class="text-slate-400 text-sm mt-1">${t('cycle.previewHint')}</p>
                </div>

                ${cycle.renderCheckSummary()}

                ${cycle.renderFrequencySummary()}

                <div class="flex gap-2 mb-4">
                    <button onclick="cycle.selectAll(true)" class="flex-1 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold rounded-lg hover:border-amber-500 active:scale-95 transition-all">${t('common.selectAll')}</button>
                    <button onclick="cycle.selectAll(false)" class="flex-1 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold rounded-lg hover:border-amber-500 active:scale-95 transition-all">${t('common.deselectAll')}</button>
                </div>

                <div class="space-y-2">
                    ${cycle.state.words.map((w, i) => {
                        const type = badgeColors[w.type] ? w.type : 'phrase';
                        return `
                        <div onclick="cycle.toggleWord(${i})"
                            class="bg-slate-800 p-3 rounded-xl border-2 flex items-center gap-3 cursor-pointer transition-all active:scale-[0.99] ${
                                w.selected ? 'border-amber-500/60' : 'border-slate-700 opacity-50'
                            }">
                            <div class="w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                w.selected ? 'bg-amber-500 border-amber-500 text-slate-900' : 'border-slate-600 text-transparent'
                            }">
                                <i class="fa-solid fa-check text-xs"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-bold text-slate-100 break-words">${cycle.esc(w.word)}</span>
                                    <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${badgeColors[type]}">${t('wordTypes.' + type)}</span>
                                    ${cycle.renderFrequencyBadge(w.word)}
                                </div>
                                <div class="text-sm text-amber-500/90 break-words">${cycle.esc(w.translation)}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <div class="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-700 p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
                <div class="max-w-lg mx-auto">
                    <div class="flex justify-between items-center mb-3 text-sm">
                        <span class="text-slate-400">${t('cycle.selectedCount', { selected, total: cycle.state.words.length })}</span>
                        <span class="text-slate-400"><b id="cycle-days-count" class="text-amber-500">${plural('common.day', days)}</b> ${t('cycle.daysOfStudy')}</span>
                    </div>

                    ${missing > 0 ? `
                        <button onclick="cycle.topUp()" id="cycle-topup-btn"
                            class="w-full mb-2 py-2.5 bg-slate-800 border border-amber-500/40 text-amber-500 text-xs font-bold rounded-xl hover:bg-slate-700 active:scale-95 transition-all">
                            ${t('cycle.topUp', { count: missing })}
                        </button>
                    ` : ''}
                    <div class="flex gap-2">
                        <button onclick="cycle.renderTopicPicker()" class="px-4 py-3.5 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl active:scale-95 transition-all">
                            <i class="fa-solid fa-arrow-left"></i>
                        </button>
                        <button onclick="cycle.approve()" class="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl shadow-lg active:scale-95 transition-all">
                            ${t('cycle.approve')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    toggleWord: (index) => {
        const word = cycle.state.words[index];
        if (!word) return;
        word.selected = !word.selected;
        cycle.renderPreview();
    },

    selectAll: (value) => {
        cycle.state.words.forEach(w => { w.selected = value; });
        cycle.renderPreview();
    },

    /**
     * Догенерировать недостающие слова.
     *
     * Кнопкой, а не автоматически: генерация тратит квоту, и делать это
     * без спроса неправильно. Исключаем и словарь, и всё уже показанное —
     * снятые галочкой слова тоже, иначе они пришли бы обратно.
     */
    topUp: async () => {
        const profile = config.getProfile();
        const target = cycle.state.days * profile.dailyGoal;
        const selected = cycle.state.words.filter(w => w.selected).length;
        const missing = target - selected;

        if (missing <= 0) return;

        const shown = cycle.state.words.map(w => w.word);
        cycle.renderLoader(cycle.state.topic, selected, target);

        try {
            const extra = await aiService.generateSet(
                cycle.state.topic,
                missing,
                (done) => cycle.updateLoader(selected + done, target),
                shown
            );

            if (!extra.length) throw new Error(t('cycle.topUpEmpty'));

            // Добранные слова идут в тот же план, значит и сверяются так же
            cycle.state.check = await cycle.verify(extra);

            cycle.state.words = [...cycle.state.words, ...extra.map(w => ({ ...w, selected: true }))];
            cycle.renderPreview();
        } catch (error) {
            // Уже собранное не теряем: показываем предпросмотр и сообщаем
            cycle.renderPreview();
            await dialog.alert(error.message);
        }
    },

    // ======================================================
    //  Шаг 4. Создание цикла и раскладка по дням
    // ======================================================

    approve: async () => {
        const profile = config.getProfile();
        const selected = cycle.state.words.filter(w => w.selected);

        if (selected.length === 0) {
            await dialog.alert(t('cycle.nothingSelected'));
            return;
        }
        if (selected.length < profile.dailyGoal) {
            const ok = await dialog.confirm(
                t('cycle.belowGoal', { count: selected.length, goal: profile.dailyGoal }),
                { title: t('cycle.newTopic'), okLabel: t('cycle.approve') }
            );
            if (!ok) return;
        }

        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500"></div></div>`;

        try {
            // Завершаем предыдущую активную тему, если она осталась
            const previous = await dbService.getActiveCycle();
            if (previous) await dbService.updateCycle(previous.id, { status: 'archived' });

            const cycleId = await dbService.createCycle({
                title: cycle.state.topic,
                status: 'active',
                level: profile.level,
                dailyGoal: profile.dailyGoal,
                plannedDays: cycle.state.days,
                totalWords: selected.length
            });

            // Слова темы ждут своего дня: status = pending
            const { ids } = await dbService.saveMultipleWords(
                selected.map(({ selected: _drop, ...w }) => w),
                { cycleId: cycleId, status: 'pending', topic: cycle.state.topic }
            );

            if (ids.length === 0) {
                throw new Error(t('cycle.allWordsKnown'));
            }

            await scheduler.buildDayPlans(cycleId, ids, profile.dailyGoal);

            cycle.state.words = [];
            dashboard.render();
        } catch (error) {
            console.error('Не удалось создать тему:', error);
            cycle.renderError(error.message);
        }
    }
};
