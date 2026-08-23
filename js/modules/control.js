import { dialog } from '../core/dialog.js';
import { exercises } from './exercises.js';
import { declension } from '../core/declension.js';
import { speech } from '../core/speech.js';
import { quiz } from '../core/quiz.js';
import { germanUtils } from '../core/german.js';
import { t, plural } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { scheduler } from '../core/scheduler.js';
import { dashboard } from './dashboard.js';

export const control = {

    state: {
        cycleId: null, // Добавлено для закрытия темы
        questions: [],
        currentIndex: 0,
        correctCount: 0,
        mistakes: [],
        startTime: null
    },

    start: async (cycleId = null) => {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="flex justify-center items-center h-full pb-20">
                <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500 border-opacity-50"></div>
            </div>
        `;

        try {
            control.state.cycleId = cycleId; // Запоминаем текущую тему
            let words = [];
            
            if (cycleId) {
                words = await dbService.getWordsByCycle(cycleId);
            } else {
                const allWords = await dbService.getStudiedWords();
                words = quiz.shuffle(allWords).slice(0, 20);
            }

            if (words.length < 5) {
                await dialog.alert(t("control.notEnoughWords"));
                if (typeof dashboard !== 'undefined') dashboard.render();
                return;
            }

            control.state.questions = await control.generateQuestions(words);
            control.state.currentIndex = 0;
            control.state.correctCount = 0;
            control.state.mistakes = [];
            control.state.startTime = Date.now();

            // Экзамен идёт на том же движке, что и урок: у него все девять
            // типов заданий, проверка ответов и журнал ошибок. Своя реализация
            // здесь умела три типа и в журнал не писала вовсе
            exercises.exam = {
                title: t('control.exam'),
                accent: 'red-500',
                onAnswer: (word, isCorrect, mode) => {
                    if (isCorrect) control.state.correctCount++;
                    else control.state.mistakes.push({ word, type: mode });
                }
            };

            exercises.start(control.state.questions, 0, control.finishTest);
        } catch (e) {
            console.error("Ошибка запуска контроля:", e);
            await dialog.alert(t("control.startFailed"));
        }
    },

    /** Сколько вопросов задаём за экзамен. */
    MAX_QUESTIONS: 25,

    /**
     * Раскладка вопросов по типам заданий (§31 ТЗ).
     *
     * Раньше экзамен спрашивал только перевод, артикль и форму глагола —
     * три типа из девяти. Слово, выученное на карточках, но не собираемое
     * в предложение, считалось сданным.
     *
     * Каждому слову назначается свой набор посильных типов: спрашивать
     * артикль у глагола или Rektion там, где её нет, бессмысленно.
     */
    generateQuestions: async (words) => {
        const listening = await speech.isAvailable();

        const applicable = (word) => {
            const modes = ['translation_de_ru', 'translation_ru_de', 'match_pairs'];

            if (germanUtils.hasKnownArticle(word)) modes.push('article');
            if (word.type === 'verb' && (word.preterite || word.participle_ii)) modes.push('verb_form');
            if (germanUtils.hasRektion(word)) modes.push('rektion');
            if (word.type === 'adjective' && !declension.isIndeclinable(word.word)) modes.push('adjective_ending');
            if (word.example_de) modes.push('fill_blanks', 'sentence_builder');
            if (word.word) modes.push('translation_ru_de_input');
            if (listening && word.word) modes.push('listening');

            return modes;
        };

        const questions = [];
        for (const word of quiz.shuffle(words)) {
            const modes = quiz.shuffle(applicable(word));

            // Два разных задания на слово: одно на узнавание, одно потруднее.
            // Так двадцать пять вопросов покрывают около тринадцати слов
            // с разных сторон, а не двадцать пять раз одно и то же
            for (const mode of modes.slice(0, 2)) {
                questions.push({ ...word, __mode: mode });
            }
        }

        return quiz.shuffle(questions).slice(0, control.MAX_QUESTIONS);
    },

    finishTest: async () => {
        document.body.classList.remove('lesson-mode');
        const main = document.getElementById('main-content');
        const total = control.state.questions.length;
        const correct = control.state.correctCount;
        const percentage = Math.round((correct / total) * 100);
        
        // Освоенность обновилась по каждому ответу в самих упражнениях,
        // пересчитывать её здесь второй раз не нужно
        exercises.exam = null;

        // 2. ЗАКРЫВАЕМ ЦИКЛ (ТЕМУ)
        if (control.state.cycleId) {
            await dbService.updateCycle(control.state.cycleId, { status: "completed", completedAt: Date.now() });
        }

        // 3. НАЧИСЛЕНИЕ ОПЫТА (За тест даем много XP)
        const xpEarned = correct * 5 + (percentage === 100 ? 50 : 0);
        if (typeof dbService !== 'undefined' && dbService.addXP) {
            await dbService.addXP(xpEarned);
        }

        // Сданный контроль — тоже день занятий
        await scheduler.registerLessonCompleted();

        // 4. РЕНДЕР РЕЗУЛЬТАТОВ
        let gradeColor = 'text-green-500';
        let gradeText = t('control.gradeGreat');
        let icon = 'fa-trophy';
        
        if (percentage < 60) {
            gradeColor = 'text-red-500';
            gradeText = t('control.gradePoor');
            icon = 'fa-triangle-exclamation';
        } else if (percentage < 85) {
            gradeColor = 'text-amber-500';
            gradeText = t('control.gradeOk');
            icon = 'fa-star-half-stroke';
        }

        let mistakesHtml = '';
        if (control.state.mistakes.length > 0) {
            const uniqueMistakes = [...new Map(control.state.mistakes.map(item => [item.word.id, item])).values()];
            mistakesHtml = `
                <div class="mt-6 w-full text-left">
                    <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">${t('control.wordsToReview')}</h3>
                    <div class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                        ${uniqueMistakes.map(m => `
                            <div class="bg-slate-800 p-3 rounded-xl border border-red-900/30 flex justify-between items-center">
                                <div>
                                    <div class="font-bold text-slate-200">${m.word.word}</div>
                                    <div class="text-xs text-slate-400">${m.word.translation}</div>
                                </div>
                                <div class="text-red-400 text-xs bg-red-400/10 px-2 py-1 rounded">${t('control.mistake')}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        main.innerHTML = `
            <div class="max-w-md mx-auto flex flex-col items-center pt-8 pb-10 fade-in text-center">
                <div class="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6 shadow-xl bg-slate-800 border-4 border-slate-700 ${gradeColor}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                
                <h2 class="text-4xl font-black text-slate-100 mb-2">${percentage}%</h2>
                <p class="${gradeColor} font-bold mb-6">${gradeText}</p>
                
                <div class="grid grid-cols-2 gap-4 w-full mb-2">
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div class="text-2xl font-black text-slate-100">${correct}/${total}</div>
                        <div class="text-xs text-slate-500 uppercase tracking-wider mt-1">${t('control.correctAnswers')}</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div class="text-2xl font-black text-amber-500">+${xpEarned}</div>
                        <div class="text-xs text-slate-500 uppercase tracking-wider mt-1">${t('control.xpGained')}</div>
                    </div>
                </div>

                ${mistakesHtml}

                <div class="w-full mt-8">
                    <button onclick="if(typeof dashboard !== 'undefined') dashboard.render();" class="w-full py-4 bg-slate-100 text-slate-900 font-black text-lg rounded-xl shadow-lg active:scale-95 transition-transform hover:bg-white">
                        ${t('control.finishExam')}
                    </button>
                </div>
            </div>
        `;
    }
};