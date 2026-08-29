/**
 * Сборка целого из перемешанных кусков.
 *
 * Один движок на два задания: предложение собирается из слов, слово —
 * из букв. Разница только в том, чем куски склеиваются обратно, и в
 * подписях; всё остальное — пересборки, штраф за них, пропуск — общее.
 *
 * Вынесено отдельно от остальных заданий по одной причине: у сборки
 * есть состояние между нажатиями (что уже выложено, сколько было
 * неудачных попыток), а у прочих заданий его нет.
 */

import { exercises } from './shared.js';
import { announce } from '../../core/announce.js';
import { quiz } from '../../core/quiz.js';
import { germanUtils } from '../../core/german.js';
import { t } from '../../i18n/i18n.js';

export const builder = {
    /**
     * Общий сборщик: выложить целое из перемешанных кусков.
     *
     * Один движок на два задания. Предложение собирается из слов,
     * слово — из букв; разница только в том, чем куски склеиваются
     * обратно, и в подписях. Заводить для букв отдельную копию с теми
     * же пересборками, штрафами и пропуском было бы вернейшим способом
     * получить два расходящихся задания.
     */
    _renderBuilder: ({ pieces, separator, title, prompt, hint, tile }) => {
        exercises.builderState.correct = [...pieces];
        exercises.builderState.words = quiz.shuffle(pieces);
        exercises.builderState.separator = separator;
        exercises.builderState.selected = [];
        exercises.builderState.answered = false;
        exercises.builderState.attempts = 0;
        exercises.builderState.firstWrong = null;

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6">
                <h3 class="text-sm font-bold text-slate-400 mb-6 text-center">${title}</h3>
                <p class="text-slate-400 text-sm mb-4 text-center border-b border-slate-700 pb-4">${prompt}</p>

                <div id="sb-target" class="min-h-[60px] bg-slate-900/50 rounded-xl border border-slate-600 p-3 mb-2 flex flex-wrap gap-2 content-start"></div>
                <p class="text-[11px] text-slate-500 text-center mb-5">${hint}</p>

                <div id="sb-source" class="flex flex-wrap gap-2 justify-center mb-6">
                    ${exercises.builderState.words.map((w, i) => `
                        <button id="sb-word-${i}" onclick="exercises.builderAdd(${i})" class="${tile} bg-slate-800 border border-slate-600 text-slate-200 rounded-lg shadow active:scale-95 transition-transform hover:bg-slate-700">${exercises.escAttr(w)}</button>
                    `).join('')}
                </div>

                <button onclick="exercises.skipBuilder()" class="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 font-bold rounded-xl active:scale-95 transition-all text-sm mb-2" id="sb-skip-btn">
                    ${t('exercises.tooHardSkip')}
                </button>

                <div id="ex-feedback" class="mt-2 hidden font-bold text-lg p-3 rounded-xl text-center transition-all"></div>
            </div>
        `;
    },

    renderSentenceBuilder: (word) => exercises._renderBuilder({
        pieces: word.example_de.replace(/[.,!?]/g, '').split(' ').filter(w => w.length > 0),
        separator: ' ',
        title: t('exercises.buildSentence'),
        prompt: word.example_ru || word.translation,
        hint: t('exercises.builderHint'),
        tile: 'px-4 py-2 font-medium'
    }),

    /**
     * Собрать слово из букв.
     *
     * Заведено потому, что новому слову без рода и примера доступны
     * ровно три задания, и два из них — выбор перевода в обе стороны —
     * для глаза одно и то же. Человек видел «пары и выбор из четырёх» и
     * решил, что заданий в приложении два.
     *
     * Этому от карточки не нужно ничего, кроме самого слова, поэтому оно
     * есть всегда. И оно про то, чего остальные задания на этом этапе не
     * касаются вовсе, — про написание: где удвоенная согласная, где
     * умляут, где ß.
     *
     * Артикль в набор букв не попадает: складывать «d-i-e» бессмысленно,
     * на артикль есть своё задание.
     */
    renderWordBuilder: (word) => exercises._renderBuilder({
        pieces: germanUtils.stripArticle(word).split(''),
        separator: '',
        title: t('exercises.buildWord'),
        prompt: word.translation,
        hint: t('exercises.wordBuilderHint'),
        tile: 'w-11 h-11 flex items-center justify-center text-lg font-bold'
    }),

    /**
     * В selected хранятся индексы слов из набора, а не сами слова.
     * Так можно вернуть в набор именно ту кнопку, которую убрали, и
     * корректно обрабатывать предложения с повторяющимися словами
     * («der Mann und der Hund»).
     */
    builderAdd: (index) => {
        if (exercises.builderState.selected.includes(index)) return;

        exercises.builderState.selected.push(index);
        document.getElementById(`sb-word-${index}`)?.classList.add('hidden');
        exercises.updateBuilderUI();
    },

    /**
     * Убирает слово с любой позиции, а не только последнее.
     * Раньше клик по области собранного предложения удалял только
     * последнее слово, и ошибка в середине означала пересбор всей фразы.
     */
    builderRemoveAt: (position) => {
        const [index] = exercises.builderState.selected.splice(position, 1);
        if (index === undefined) return;

        document.getElementById(`sb-word-${index}`)?.classList.remove('hidden');

        // Ответ изменился — прежний отклик «Falsch» больше не актуален
        const feedback = document.getElementById('ex-feedback');
        if (feedback) feedback.classList.add('hidden');

        exercises.updateBuilderUI();
    },

    /** Собранное из кусков — слова через пробел, буквы без него. */
    builderSentence: () => exercises.builderState.selected
        .map(i => exercises.builderState.words[i])
        .join(exercises.builderState.separator ?? ' '),

    /** Правильный ответ, склеенный тем же способом. */
    builderAnswer: () => exercises.builderState.correct
        .join(exercises.builderState.separator ?? ' '),


    updateBuilderUI: () => {
        const target = document.getElementById('sb-target');

        // Каждый кусок — отдельная кнопка: нажатие возвращает его в набор.
        // Экранирование обязательно: примеры приходят от ИИ, а буквы —
        // из самого слова, и «<» в любом из них порвал бы разметку
        target.innerHTML = exercises.builderState.selected.map((index, position) => `
            <button onclick="exercises.builderRemoveAt(${position})"
                class="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded shadow font-bold active:scale-95 transition-transform">
                ${exercises.escAttr(exercises.builderState.words[index])}
            </button>
        `).join('');

        if (exercises.builderState.selected.length === exercises.builderState.correct.length) {
            exercises.checkBuilder();
        }
    },

    /**
     * Проверка собранного предложения.
     *
     * Здесь, в отличие от остальных девяти заданий, ошибка не заканчивает
     * задание. И это не поблажка: в сборке предложения ошибиться можно
     * порядком одного слова, а увидеть верный порядок и тут же собрать
     * его самому — это и есть то, чему задание учит. Прежний вариант
     * показывал правильный ответ и уходил дальше, то есть отвечал за
     * человека.
     *
     * Поэтому пересобирать можно сколько угодно, а дальше задание уходит
     * только при верной сборке или по кнопке «Сложно, пропустить».
     *
     * Начисление устроено так, чтобы перебором ничего не выигрывалось:
     *
     *   опыт     — за верную сборку в любом случае, но убывающий: 4 за
     *              первую попытку, 2 за вторую, дальше 1;
     *   история  — верным ответом считается только сборка с первого
     *              раза. Иначе освоенность росла бы от перебора: слов в
     *              предложении немного, и порядок рано или поздно
     *              угадывается без всякого знания;
     *   пропуск  — как неверный ответ в любом другом задании, 1 очко.
     *              Отдельного штрафа нет: он бы толкал перебирать вместо
     *              того, чтобы честно признать, что не знаешь.
     */
    checkBuilder: () => {
        // Замок — только на завершённое задание. Пересборки его не
        // завершают, поэтому и не блокируются
        if (exercises.builderState.answered) return;

        const feedback = document.getElementById('ex-feedback');
        const isCorrect = exercises.builderSentence() === exercises.builderAnswer();

        if (!isCorrect) return exercises._builderRetry(feedback);

        exercises.builderState.answered = true;

        const skipBtn = document.getElementById('sb-skip-btn');
        if (skipBtn) skipBtn.disabled = true;
        document.querySelectorAll('#sb-source button, #sb-target button').forEach(b => b.disabled = true);

        const попыток = exercises.builderState.attempts;

        // Собрал не с первого раза — в историю слова это идёт неверным
        // ответом, но объявляется и выглядит верным: человек ведь собрал
        exercises.awardXP(попыток === 0, {
            xp: exercises.builderXP(попыток),
            announceCorrect: true
        });

        // Первую неудачную сборку кладём в разбор ошибок: она показывает,
        // где именно человек путается в порядке слов
        if (попыток > 0 && exercises.builderState.firstWrong) {
            exercises._logMistake('sentence_builder', exercises.builderState.firstWrong);
        }

        feedback.classList.remove('hidden');
        feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-green-600 border border-green-400 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]";
        feedback.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Richtig!`
            + (попыток > 0
                ? `<span class="block text-white/70 text-xs font-normal mt-1.5">${t('exercises.builderFromTry', { n: попыток + 1, xp: exercises.builderXP(попыток) })}</span>`
                : '');

        setTimeout(exercises.next, exercises.BUILDER_NEXT_DELAY);
    },

    /**
     * Неверная сборка: считаем попытку и отдаём предложение обратно.
     *
     * Ничего не блокируем и ничего не начисляем — задание продолжается.
     * Верный порядок не показываем: подсказать его сейчас значит лишить
     * пересборку смысла, а для тех, кому правда не даётся, есть кнопка
     * «Сложно, пропустить».
     */
    _builderRetry: (feedback) => {
        exercises.builderState.attempts += 1;

        if (!exercises.builderState.firstWrong) {
            exercises.builderState.firstWrong = exercises.builderSentence();
        }

        if (!feedback) return;

        feedback.classList.remove('hidden');
        feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-red-600 border border-red-400 text-white";
        feedback.innerHTML = `
            <span class="block"><i class="fa-solid fa-xmark mr-2"></i> Falsch!</span>
            <span class="block text-white/80 text-xs font-normal mt-1.5">${t('exercises.builderRetry')}</span>
        `;

        announce.say(t('exercises.builderRetry'));
    },

    skipBuilder: () => {
        if (exercises.builderState.answered) return;
        exercises.builderState.answered = true;

        const feedback = document.getElementById('ex-feedback');
        const skipBtn = document.getElementById('sb-skip-btn');
        if (skipBtn) skipBtn.disabled = true;

        document.querySelectorAll('#sb-source button, #sb-target button').forEach(b => b.disabled = true);

        const correctSentence = exercises.builderAnswer();

        // Пропуск — это неответ, и в истории слова он стоит наравне с
        // неверным ответом: слово вернётся раньше. Раньше пропуск не
        // записывался вовсе, и пропустить было выгоднее, чем ошибиться
        exercises.awardXP(false);

        exercises._logMistake('sentence_builder', exercises.builderState.firstWrong || 'SKIPPED');

        feedback.classList.remove('hidden');
        feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-slate-900/80 border border-slate-600/50 text-slate-300";
        feedback.innerHTML = `
            <span class="text-slate-400 text-xs font-normal block mb-1 uppercase tracking-widest">${t('exercises.correctAnswer')}</span>
            <b class="text-amber-500 text-base leading-snug block">${exercises.escAttr(correctSentence)}</b>
        `;

        setTimeout(exercises.next, exercises.BUILDER_NEXT_DELAY);
    },
};
