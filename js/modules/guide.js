/**
 * «Как пользоваться» — разбор приложения для того, кто открыл его впервые.
 *
 * Мастер первого запуска спрашивает имя, уровень, норму и ключ — то есть
 * настраивает приложение, но ничего не говорит о том, как им пользоваться.
 * После мастера человек остаётся один на один с пятью кнопками, и связь
 * между ними ниоткуда не следует: «плюс» ведёт к словам, слова к плану,
 * план к уроку, урок к завтрашнему повторению.
 *
 * До сих пор это лечилось точечно — отдельным экраном про облако в
 * мастере, объяснением серии по нажатию на плашку. Каждая такая заплата
 * закрывала одну дыру и была признаком того, что общего места для
 * объяснений нет.
 *
 * Разделы свёрнуты, кроме первого. Развёрнутые целиком, они дают полотно
 * в несколько экранов, по которому нельзя понять, где искать нужное;
 * свёрнутые — это оглавление, а оно и есть ответ на вопрос «где что».
 *
 * Свёртывание сделано на <details>, а не на своём переключателе:
 * состояние живёт в самом элементе, а не в переменной модуля, и
 * открытый раздел переживает любую перерисовку.
 *
 * Текст лежит отдельно, в i18n/guide.js. Здесь остаётся только то, как
 * он выглядит, и живые числа: экран ничего не знает о содержании, кроме
 * видов блоков.
 */

import { guideContent } from '../i18n/guide.js';
import { config } from '../config.js';
import { dbService } from '../services/db.js';
import { auth } from '../services/auth.js';
import { masteryUtils } from '../core/mastery.js';
import { scheduler } from '../core/scheduler.js';
import { announce } from '../core/announce.js';
import { app } from '../app.js';

/** Экранирование: текст справки пишут как текст, а не как разметку. */
const esc = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Форма числа: «1 слово», «2 слова», «5 слов». */
function слов(count) {
    const формы = guideContent.words;
    const правило = new Intl.PluralRules('ru').select(count);
    return (формы[правило] ?? формы.other).replace('{count}', count);
}

export const guide = {

    /**
     * Живые числа для подстановки.
     *
     * Выдуманный пример в справке стареет молча: приложение меняется, а
     * «норма 10 слов» остаётся написанной даже у того, кто поставил 20.
     * Посчитанное число не стареет — и заодно говорит человеку не про
     * приложение вообще, а про его собственный словарь.
     *
     * Если база недоступна, числа не выдумываются: справка остаётся
     * читаемой и без них, а неверное число хуже отсутствующего.
     */
    facts: async () => {
        const профиль = config.getProfile();
        const норма = профиль.dailyGoal || 10;

        let слова = [];
        try {
            слова = await dbService.getAllWords();
        } catch {
            слова = [];
        }

        return {
            слов: слов(слова.length),
            норма: слов(норма),
            повторений: String(scheduler.getReviewLimit(норма)),
            освоено: String(слова.filter(w => masteryUtils.isLearned(w)).length),
            слабых: String(слова.filter(w => masteryUtils.isWeak(w)).length),
            ключ: (config.get('api_key') || профиль.apiKey)
                ? guideContent.facts.keySet
                : guideContent.facts.keyMissing,
            облако: auth.isSignedIn
                ? guideContent.facts.cloudOn
                : guideContent.facts.cloudOff
        };
    },

    /**
     * Строка текста в разметку: экранирование, живые числа, выделение.
     *
     * Порядок важен. Сначала экранируется всё, включая то, что пришло из
     * базы, — потом подставляются числа и раскрываются звёздочки. Так в
     * готовой разметке остаются ровно те теги, которые поставили здесь.
     *
     * Имена подстановок русские, поэтому \w не годится: в JavaScript это
     * ровно [A-Za-z0-9_], и {норма} такому шаблону не отвечает. Ошибка
     * тихая — текст просто остаётся с фигурными скобками, — и поймала её
     * не проверка на подстановки (она сама была написана через \w), а
     * проверка экранирования. Здесь \p{L} с флагом u: любая буква любого
     * алфавита.
     */
    markup: (text, facts = {}) => esc(text)
        .replace(/\{([\p{L}\p{N}_]+)\}/gu, (совпадение, ключ) =>
            Object.prototype.hasOwnProperty.call(facts, ключ) ? esc(facts[ключ]) : совпадение)
        .replace(/\*([^*]+)\*/g, '<b class="text-slate-100 font-bold">$1</b>'),

    /** Один блок содержания. Вид определяется тем, какое поле заполнено. */
    block: (item, facts) => {
        const м = (text) => guide.markup(text, facts);

        if (item.p) return `<p class="text-sm text-slate-300 leading-relaxed mb-3">${м(item.p)}</p>`;

        if (item.hint) return `<p class="text-xs text-slate-500 leading-relaxed mb-3">${м(item.hint)}</p>`;

        if (item.example) {
            return `<p class="text-sm text-amber-500/90 leading-relaxed border-l-2 border-amber-500/40 pl-3 mb-3">${м(item.example)}</p>`;
        }

        if (item.sub) {
            return `<h4 class="text-sm font-bold text-slate-200 mt-4 mb-2">${м(item.sub)}</h4>`;
        }

        if (item.steps) {
            return `
                <ol class="space-y-2 mb-3">
                    ${item.steps.map((шаг, i) => `
                        <li class="flex gap-3 text-sm text-slate-300 leading-relaxed">
                            <span class="flex-none w-5 h-5 mt-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-500 text-[10px] font-bold flex items-center justify-center">${i + 1}</span>
                            <span class="flex-1 min-w-0">${м(шаг)}</span>
                        </li>
                    `).join('')}
                </ol>
            `;
        }

        if (item.rows) {
            return `
                <div class="mb-3 divide-y divide-slate-700/60">
                    ${item.rows.map(([название, текст]) => `
                        <div class="py-2.5">
                            <div class="text-sm font-bold text-slate-200 mb-0.5 break-words">${м(название)}</div>
                            <div class="text-[13px] text-slate-400 leading-relaxed">${м(текст)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        /*
         * Кнопки, открывающие описанный экран.
         *
         * Справку читают не ради чтения: человек ищет, где что лежит.
         * Дочитать абзац, свернуть справку, вспомнить название кнопки и
         * найти её внизу — четыре действия там, где хватает одного.
         */
        if (item.go) {
            return `
                <div class="flex flex-wrap gap-2 mb-3">
                    ${item.go.map(([экран, подпись]) => `
                        <button data-action="guide.go" data-screen="${esc(экран)}"
                                class="px-3 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600 text-xs font-bold text-slate-200 hover:bg-slate-600 active:scale-95 transition">
                            ${esc(подпись)} <i class="fa-solid fa-arrow-right text-[10px] opacity-60 ml-0.5"></i>
                        </button>
                    `).join('')}
                </div>
            `;
        }

        return '';
    },

    /** Раздел-гармошка. Открыт только первый: он же ответ на «с чего начать». */
    section: (раздел, facts) => `
        <details class="guide-part bg-slate-800 border border-slate-700 rounded-xl overflow-hidden" ${раздел.open ? 'open' : ''}>
            <summary class="px-4 py-3.5 font-bold text-slate-200 cursor-pointer select-none flex items-center gap-3 hover:bg-slate-700/40 transition-colors">
                <span class="flex-1 min-w-0 text-sm break-words">${esc(раздел.name)}</span>
            </summary>
            <div class="px-4 pb-4 pt-1 border-t border-slate-700/60">
                ${раздел.blocks.map(b => guide.block(b, facts)).join('')}
            </div>
        </details>
    `,

    render: async () => {
        document.body.classList.remove('lesson-mode');
        const main = document.getElementById('main-content');

        const facts = await guide.facts();

        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-10">
                <div class="mb-5 px-1">
                    <h2 class="text-2xl font-bold text-slate-100">${esc(guideContent.title)}</h2>
                    <p class="text-sm text-slate-400 mt-1 leading-relaxed">${esc(guideContent.sub)}</p>
                </div>

                <div class="space-y-2.5">
                    ${guideContent.sections.map(s => guide.section(s, facts)).join('')}
                </div>

                <button data-action="guide.back"
                        class="w-full mt-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold text-slate-300 hover:bg-slate-700 active:scale-95 transition">
                    ${esc(guideContent.back)}
                </button>
            </div>
        `;

        announce.say(guideContent.title);
    },

    /** Открыть справку — из профиля и из последнего шага мастера. */
    open: () => app.navigate('guide'),

    /** Переход на описанный экран прямо из справки. */
    go: (el) => app.navigate(el.dataset.screen),

    back: () => app.navigate('profile')
};
