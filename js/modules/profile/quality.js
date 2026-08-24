import { profile } from './shared.js';
import { dialog } from '../../core/dialog.js';
import { germanUtils } from '../../core/german.js';
import { wiktionary } from '../../services/wiktionary.js';
import { t, plural } from '../../i18n/i18n.js';
import { aiService } from '../../services/ai.js';
import { dbService } from '../../services/db.js';

/**
 * Качество карточек: полнота полей и сверка с Wiktionary.
 *
 * Карточки пишет языковая модель, и проверить её было некому. Здесь
 * видно, сколько слов неполные и где формы разошлись со словарём.
 */

export const quality = {

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
            .map(d => `${t('fields.' + d.field)}${d.suspicion ? ' — ' + t('profile.diffSuspicion') : ''}`
                + `\n     ${t('profile.diffOurs')}: ${d.ours}`
                + `\n     ${t('profile.diffTheirs')}: ${d.theirs}`)
            .join('\n\n');

        /*
         * Расхождение в форме исправляется одной кнопкой: «hat genommen»
         * либо верно, либо нет. Подозрение в переводе так закрыть нельзя —
         * словарь перечисляет значения всех смыслов вперемешку, и
         * подставить первое попавшееся значило бы менять смысл карточки
         * наугад. Поэтому там, где спорен только перевод, предлагается
         * открыть редактор, а не «применить».
         */
        const исправимые = word.mismatches.filter(d => d.fix);

        const выбор = исправимые.length
            ? [
                { value: 'fix', label: t('profile.diffApply'), hint: t('profile.diffApplyHint'), primary: true },
                { value: 'keep', label: t('profile.diffKeep'), hint: t('profile.diffKeepHint') }
              ]
            : [
                { value: 'edit', label: t('profile.diffEdit'), hint: t('profile.diffEditHint'), primary: true },
                { value: 'keep', label: t('profile.diffKeep'), hint: t('profile.diffKeepHint') }
              ];

        const choice = await dialog.choose(`${word.word}\n\n${lines}`, выбор, { title: t('profile.diffTitle') });

        if (choice === null) return;

        if (choice === 'edit') {
            await profile.openEditModal(id);
            return;
        }

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

};
