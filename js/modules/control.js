import { germanUtils } from '../core/german.js';
import { t, plural } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { scheduler } from '../core/scheduler.js';
import { dashboard } from './dashboard.js';

export const control = {
    acceptedAnswers: null,

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
                words = allWords.sort(() => 0.5 - Math.random()).slice(0, 20);
            }

            if (words.length < 5) {
                alert(t("control.notEnoughWords"));
                if (typeof dashboard !== 'undefined') dashboard.render();
                return;
            }

            control.state.questions = control.generateQuestions(words);
            control.state.currentIndex = 0;
            control.state.correctCount = 0;
            control.state.mistakes = [];
            control.state.startTime = Date.now();

            control.renderCurrent();
        } catch (e) {
            console.error("Ошибка запуска контроля:", e);
            alert(t("control.startFailed"));
        }
    },

    generateQuestions: (words) => {
        let questions = [];
        const shuffledWords = [...words].sort(() => 0.5 - Math.random());
        
        shuffledWords.forEach(word => {
            questions.push({ word: word, type: 'translation_de_ru' });
            
            if (Math.random() > 0.5) {
                questions.push({ word: word, type: 'translation_ru_de' });
            }

            if (germanUtils.hasKnownArticle(word) && Math.random() > 0.4) {
                questions.push({ word: word, type: 'article' });
            }

            if (word.type === 'verb' && (word.preterite || word.participle_ii) && Math.random() > 0.3) {
                questions.push({ word: word, type: 'verb_form' });
            }
        });

        return questions.sort(() => 0.5 - Math.random()).slice(0, 25);
    },

    renderCurrent: async () => {
        const main = document.getElementById('main-content');
        
        if (control.state.currentIndex >= control.state.questions.length) {
            control.finishTest();
            return;
        }

        const q = control.state.questions[control.state.currentIndex];
        const progress = (control.state.currentIndex / control.state.questions.length) * 100;

        let html = `
            <div class="max-w-lg mx-auto min-h-full flex flex-col pt-2 pb-6 fade-in">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded border border-red-500/20 shadow-sm animate-pulse">${t('control.exam')}</span>
                    <span class="text-xs font-bold text-slate-500">${t('control.questionOf', { current: control.state.currentIndex + 1, total: control.state.questions.length })}</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-2 mb-6 border border-slate-700 overflow-hidden mt-1">
                    <div class="bg-red-500 h-full rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                </div>
        `;

        let block = null;
        if (q.type === 'translation_de_ru' || q.type === 'translation_ru_de') {
            block = await control.renderTranslation(q.word, q.type);
        } else if (q.type === 'article') {
            block = control.renderArticle(q.word);
        } else if (q.type === 'verb_form') {
            block = control.renderVerbForm(q.word);
        }

        // Если формы для вопроса не хватило — спрашиваем перевод
        if (!block) block = await control.renderTranslation(q.word, 'translation_de_ru');

        html += block;
        html += `</div>`;
        main.innerHTML = html;

        setTimeout(() => {
            const input = document.getElementById('ctrl-input');
            if (input) input.focus();
        }, 100);
    },

    renderTranslation: async (word, type) => {
        const allWords = await dbService.getAllWords();
        const distractors = allWords.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [...distractors, word].sort(() => 0.5 - Math.random());
        
        const questionText = type === 'translation_ru_de' ? word.translation : word.word;
        const btnClass = type === 'translation_ru_de' ? 'text-xl' : 'text-base';
        
        let btns = options.map(opt => {
            const answerText = type === 'translation_ru_de' ? opt.word : opt.translation;
            return `<button onclick="control.checkChoice(this, '${opt.id}', '${word.id}', '${answerText.replace(/'/g, "\\'")}')" class="w-full py-4 bg-slate-900 border-2 border-slate-700 text-slate-300 font-bold rounded-xl text-left px-5 hover:border-amber-500 active:scale-95 transition-all ${btnClass}">${answerText}</button>`;
        }).join('');

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6">
                <h3 class="text-sm font-bold text-slate-400 mb-6 text-center">${t('control.translateWord')}</h3>
                <h2 class="text-3xl font-black text-slate-100 mb-8 text-center">${questionText}</h2>
                <div class="space-y-3" id="ctrl-buttons">${btns}</div>
            </div>
        `;
    },

    renderArticle: (word) => {
        // Тот же разбор, что и в упражнениях: без артикля в слове
        // подставлялся «der», и экзамен требовал неверный род
        const { article, base: pureWord } = germanUtils.parseNoun(word.word);
        if (!article) return null;

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">${t('control.whichArticle')}</h3>
                <h2 class="text-4xl font-black text-slate-100 mb-8 break-words">${pureWord}</h2>
                <div class="grid grid-cols-3 gap-3" id="ctrl-buttons">
                    <button onclick="control.checkChoice(this, 'der', '${article}', 'der')" class="py-4 bg-slate-900 border-2 border-slate-700 text-blue-400 font-bold rounded-xl text-xl hover:border-blue-500 active:scale-95 transition-all">DER</button>
                    <button onclick="control.checkChoice(this, 'die', '${article}', 'die')" class="py-4 bg-slate-900 border-2 border-slate-700 text-red-400 font-bold rounded-xl text-xl hover:border-red-500 active:scale-95 transition-all">DIE</button>
                    <button onclick="control.checkChoice(this, 'das', '${article}', 'das')" class="py-4 bg-slate-900 border-2 border-slate-700 text-green-400 font-bold rounded-xl text-xl hover:border-green-500 active:scale-95 transition-all">DAS</button>
                </div>
            </div>
        `;
    },

    renderVerbForm: (word) => {
        // Perfekt как в словаре: «hat gemacht», а не «haben gemacht»
        const perfekt = germanUtils.perfektForm(word);
        const preteritum = germanUtils.preteritumForm(word);

        const askPerfekt = perfekt && (!preteritum || Math.random() > 0.5);
        const form = askPerfekt ? perfekt : preteritum;
        if (!form) return null;

        const targetForm = form.primary;
        control.acceptedAnswers = form.accepted;

        const label = askPerfekt ? t('exercises.perfektLabel') : 'Präteritum (ich/er/sie/es)';
        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">${t('exercises.writeVerbForm')}</h3>
                <h2 class="text-3xl font-black text-slate-100 mb-2">${word.word}</h2>
                <p class="text-slate-500 mb-8 font-bold">${word.translation}</p>
                <div class="mb-6 text-left">
                    <label class="block text-xs font-bold text-amber-500 mb-2">${label}</label>
                    <input type="text" id="ctrl-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold" autocomplete="off">
                </div>
                <button onclick="control.checkInput('${targetForm.replace(/'/g, "\\'")}')" class="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl active:scale-95 transition-all" id="ctrl-submit">${t('control.answer')}</button>
            </div>
        `;
    },

    checkChoice: (btn, selected, correct, selectedText) => {
        const btns = document.getElementById('ctrl-buttons').children;
        for (let b of btns) b.disabled = true;

        const q = control.state.questions[control.state.currentIndex];
        
        if (selected === correct) {
            control.state.correctCount++;
            btn.classList.add('bg-green-600', 'border-green-400', 'text-white');
        } else {
            control.state.mistakes.push({ word: q.word, expected: correct, actual: selectedText, type: q.type });
            btn.classList.add('bg-red-600', 'border-red-400', 'text-white');
        }

        setTimeout(control.next, 600);
    },

    checkInput: (correct) => {
        const input = document.getElementById('ctrl-input');
        const btn = document.getElementById('ctrl-submit');
        
        const selected = input.value.trim();

        const accepted = control.acceptedAnswers?.length ? control.acceptedAnswers : [correct];
        const isCorrect = germanUtils.matchesAnswer(selected, accepted);
        control.acceptedAnswers = null;

        input.disabled = true;
        btn.disabled = true;

        const q = control.state.questions[control.state.currentIndex];

        if (isCorrect) {
            control.state.correctCount++;
            input.classList.add('bg-green-900/50', 'border-green-500', 'text-green-400');
        } else {
            control.state.mistakes.push({ word: q.word, expected: correct, actual: selected, type: q.type });
            input.classList.add('bg-red-900/50', 'border-red-500', 'text-red-400', 'line-through');
        }

        setTimeout(control.next, 800);
    },

    next: () => {
        control.state.currentIndex++;
        control.renderCurrent();
    },

    finishTest: async () => {
        const main = document.getElementById('main-content');
        const total = control.state.questions.length;
        const correct = control.state.correctCount;
        const percentage = Math.round((correct / total) * 100);
        
        // 1. ПЕРЕСЧЕТ МАСТЕРСТВА (MASTERY)
        await control.updateMastery();

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
    },

    updateMastery: async () => {
        const wordResults = {};
        
        control.state.questions.forEach(q => {
            const wId = q.word.id;
            if (!wordResults[wId]) {
                wordResults[wId] = { word: q.word, totalQuestions: 0, mistakes: 0 };
            }
            wordResults[wId].totalQuestions++;
        });

        control.state.mistakes.forEach(m => {
            if (wordResults[m.word.id]) {
                wordResults[m.word.id].mistakes++;
            }
        });

        for (const [id, data] of Object.entries(wordResults)) {
            let currentMastery = data.word.mastery || 0;
            const successRate = (data.totalQuestions - data.mistakes) / data.totalQuestions;

            if (successRate === 1) {
                currentMastery = Math.min(100, currentMastery + 25);
            } else if (successRate === 0) {
                currentMastery = Math.max(0, currentMastery - 20);
            } else {
                currentMastery = Math.min(100, currentMastery + 5);
            }

            const isDifficult = (currentMastery < 40 && data.mistakes > 0) ? 1 : 0;

            await dbService.updateWord(id, {
                mastery: currentMastery,
                isDifficult: isDifficult
            });
        }
    }
};