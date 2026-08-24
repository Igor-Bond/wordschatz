import { profile } from './shared.js';
import { actions } from '../../core/actions.js';
import { masteryUtils } from '../../core/mastery.js';
import { dialog } from '../../core/dialog.js';
import { germanUtils } from '../../core/german.js';
import { t } from '../../i18n/i18n.js';
import { aiService } from '../../services/ai.js';
import { dbService } from '../../services/db.js';

/** Вкладка «Словарь»: отбор, список, редактор карточки. */

export const dictionary = {

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

    /**
     * Задержка перед перерисовкой списка.
     *
     * «Tisch» — это пять нажатий, и каждое перестраивало весь список.
     * Отбор и отрисовка ждут, пока человек допечатает; поле и крестик
     * очистки обновляются сразу, иначе ввод ощущается залипающим.
     */
    SEARCH_DELAY: 180,
    _searchTimer: null,

    onSearchInput: (value) => {
        profile.dictFilters.query = value;

        const input = document.getElementById('dict-search');
        if (input && input.value !== value) input.value = value;

        const clear = document.getElementById('dict-search-clear');
        if (clear) clear.classList.toggle('hidden', !value);

        clearTimeout(profile._searchTimer);

        // Очистка крестиком — не набор текста, ждать нечего
        if (!value) return profile.renderDictList();

        profile._searchTimer = setTimeout(profile.renderDictList, profile.SEARCH_DELAY);
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

    /**
     * Словарь рисуется частями по мере прокрутки.
     *
     * Раньше список отрисовывался целиком. На двух тысячах слов это
     * 38 000 узлов, 5,4 МБ разметки и треть секунды на перестроение —
     * а поиск перестраивал список на каждое нажатие клавиши. Первая
     * буква запроса отбирает почти весь словарь, так что дешевле от
     * этого не становилось.
     *
     * Теперь в DOM попадает столько, сколько человек долистал.
     */
    DICT_CHUNK: 50,

    _dictVisible: [],
    _dictShown: 0,
    _dictObserver: null,

    renderDictList: () => {
        const list = document.getElementById('dict-list');
        const counter = document.getElementById('dict-count');
        if (!list) return;

        // Наблюдатель прошлого списка держал бы ссылку на снятые узлы
        profile._dictObserver?.disconnect();
        profile._dictObserver = null;

        const words = profile.getFilteredWords();
        profile._dictVisible = words;
        profile._dictShown = 0;

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

        list.innerHTML = '';
        profile.appendDictChunk();
    },

    /** Следующая порция слов плюс метка «долистали до конца». */
    appendDictChunk: () => {
        const list = document.getElementById('dict-list');
        if (!list) return;

        document.getElementById('dict-sentinel')?.remove();

        const words = profile._dictVisible;
        const from = profile._dictShown;
        const to = Math.min(from + profile.DICT_CHUNK, words.length);
        if (from >= to) return;

        list.insertAdjacentHTML('beforeend', words.slice(from, to).map(profile.renderDictRow).join(''));
        profile._dictShown = to;

        if (to >= words.length) {
            profile._dictObserver?.disconnect();
            profile._dictObserver = null;
            return;
        }

        // Метка внизу: как только она показалась — дорисовываем дальше.
        // Запас в 400 px, чтобы прокрутка не упиралась в пустоту
        list.insertAdjacentHTML('beforeend',
            `<div id="dict-sentinel" class="py-4 text-center text-xs text-slate-600">
                ${t('profile.loadingMore')}
            </div>`);

        const sentinel = document.getElementById('dict-sentinel');
        if (!profile._dictObserver) {
            profile._dictObserver = new IntersectionObserver(entries => {
                if (entries.some(e => e.isIntersecting)) profile.appendDictChunk();
            }, { root: document.getElementById('main-content'), rootMargin: '400px' });
        }
        profile._dictObserver.observe(sentinel);
    },

    renderDictRow: (w) => {
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
                    <button data-action="profile.deleteWord" data-id="${w.id}" data-word="${actions.attr(w.word)}" class="w-9 h-9 bg-red-900/20 text-red-500 rounded-lg flex items-center justify-center border border-transparent hover:border-red-900 transition-colors active:scale-95">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
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

    /**
     * Поля редактора под часть речи.
     *
     * Возвращает список `[имя поля, подпись]`. Подписи берутся из общего
     * словаря `fields.*` — тех же, что в разборе расхождений с Wiktionary,
     * чтобы одно и то же поле называлось одинаково везде.
     */
    editableFields: (type) => {
        const common = [
            ['translation', t('profile.translation')],
            ['ipa', t('fields.ipa')],
            ['synonym', t('card.synonyms')],
            ['gegenteil', t('card.antonyms')],
            ['topic', t('cycle.topicLabel')]
        ];

        const byType = {
            noun: [
                ['gender', t('fields.gender')],
                ['plural', t('fields.plural')],
                ['dativ', t('fields.dativ')],
                ['akkusativ', t('fields.akkusativ')]
            ],
            verb: [
                ['preterite', t('fields.preterite')],
                ['participle_ii', t('fields.participle_ii')],
                ['auxiliary', t('fields.auxiliary')],
                ['konjunktiv2', t('fields.konjunktiv2')],
                ['imperative_singular', t('fields.imperative_singular')],
                ['imperative_plural', t('fields.imperative_plural')],
                ['rektion', 'Rektion']
            ],
            adjective: [
                ['comparative', t('fields.comparative')],
                ['superlative', t('fields.superlative')]
            ]
        };

        return [...common, ...(byType[type] || [])];
    },

    openEditModal: async (id) => {
        const word = await dbService.getWordById(id);
        if (!word) return;

        const поле = (name, label, value, extra = '') => `
            <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-1">${profile.escapeAttr(label)}</label>
                <input type="text" data-edit="${name}" value="${profile.escapeAttr(value ?? '')}" ${extra}
                    class="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm transition-colors">
            </div>`;

        const область = (name, label, value, css) => `
            <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-1">${profile.escapeAttr(label)}</label>
                <textarea data-edit="${name}" class="w-full bg-slate-900 border border-slate-600 ${css} rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm h-16 transition-colors">${profile.escapeAttr(value ?? '')}</textarea>
            </div>`;

        let html = `<input type="hidden" id="edit-id" value="${word.id}">
            <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-1">${t('profile.germanWord')}</label>
                <input type="text" data-edit="word" value="${profile.escapeAttr(word.word || '')}"
                    class="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-bold text-lg transition-colors">
            </div>`;

        for (const [name, label] of profile.editableFields(word.type)) {
            html += поле(name, label, word[name]);
        }

        // Спряжение — шесть отдельных полей: одной строкой его было
        // не отредактировать, а именно в нём модель чаще всего ошибается
        if (word.type === 'verb') {
            const conjugation = germanUtils.getConjugation(word) || {};
            html += `
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 mb-1">Präsens</label>
                    <div class="grid grid-cols-2 gap-2">
                        ${germanUtils.PERSONS.map(p => `
                            <input type="text" data-conj="${p}" value="${profile.escapeAttr(conjugation[p] || '')}"
                                placeholder="${germanUtils.PERSON_LABELS[p]}"
                                class="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-500 text-sm transition-colors">
                        `).join('')}
                    </div>
                </div>`;
        }

        html += область('example_de', t('profile.exampleDe'), word.example_de, 'text-slate-200 italic');
        html += область('example_ru', t('profile.exampleTranslation'), word.example_ru, 'text-slate-400');

        document.getElementById('edit-fields').innerHTML = html;

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

        // Поля собраны кодом, поэтому и читаются по разметке, а не по
        // выписанному вручную списку: добавить поле теперь значит добавить
        // его в editableFields, и оно само появится и сохранится
        document.querySelectorAll('#edit-fields [data-edit]').forEach(el => {
            word[el.dataset.edit] = el.value.trim();
        });

        if (word.type === 'verb') {
            const conjugation = {};
            document.querySelectorAll('#edit-fields [data-conj]').forEach(el => {
                const value = el.value.trim();
                if (value) conjugation[el.dataset.conj] = value;
            });
            word.conjugation = Object.keys(conjugation).length ? conjugation : null;
        }

        // Род правим и в самом слове: иначе карточка осталась бы
        // противоречивой — «die» в поле и «der» в подписи
        if (word.type === 'noun' && word.gender) {
            const base = germanUtils.parseNoun(word.word).base;
            if (base) word.word = `${word.gender} ${base}`;
        }

        // Формы изменились — прошлая сверка к ним больше не относится,
        // слово возвращается в очередь на проверку
        word.verified = wiktionary.STATUS.UNCHECKED;
        word.mismatches = [];

        await dbService.putWord(word);
        profile.closeEditModal();
        profile.renderDictionary(); 
    },

    deleteWord: async (el) => {
        const id = Number(el.dataset.id);
        const wordStr = el.dataset.word ?? '';

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

};
