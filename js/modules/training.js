import { t, plural } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { srs } from '../core/srs.js';
import { lessonStateManager } from '../core/lessonState.js';
import { scheduler } from '../core/scheduler.js';
import { exercises } from './exercises.js';

export const training = {
    state: null,
    queue: [],
    currentIndex: 0,
    currentWord: null,

    render: async () => {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500"></div></div>`;

        training.state = await lessonStateManager.getCurrentState();
        const plan = await scheduler.getDailyPlan();

        // Если урок числится завершенным, но в плане появились слова (добавили новые) - сбрасываем статус
        if (training.state.status === 'completed' && (plan.review.length > 0 || plan.newWords.length > 0)) {
            training.state.status = 'not_started';
            training.state.currentStep = 0;
            training.state.data = { xpEarned: 0, newWords: 0, reviewed: 0 };
            await lessonStateManager.updateState('not_started', 0, training.state.data);
        }

        if (training.state.status === 'completed') {
            training.showCompletedScreen();
            return;
        }

        if (training.state.status === 'not_started') {
            // ФИКС: Замораживаем очереди слов на весь урок и сохраняем их в Lesson State
            training.state.data.reviewQueue = plan.review;
            training.state.data.newWordsQueue = plan.newWords;
            training.state.data.practiceQueue = [...plan.review, ...plan.newWords];
            // Запоминаем день учебного цикла, чтобы отметить его выполненным в конце
            training.state.data.dayPlanId = plan.dayPlan ? plan.dayPlan.id : null;

            if (plan.review.length > 0) {
                await training.startStep('review', training.state.data.reviewQueue, 0);
            } else if (plan.newWords.length > 0) {
                await training.startStep('new_words', training.state.data.newWordsQueue, 0);
            } else if (training.state.data.practiceQueue.length > 0) {
                await training.startStep('practice', training.state.data.practiceQueue, 0);
            } else {
                training.showCompletedScreen();
            }
        } else if (training.state.status === 'review') {
            await training.startStep('review', training.state.data.reviewQueue, training.state.currentStep);
        } else if (training.state.status === 'new_words') {
            await training.startStep('new_words', training.state.data.newWordsQueue, training.state.currentStep);
        } else if (training.state.status === 'practice') {
            await training.startStep('practice', training.state.data.practiceQueue, training.state.currentStep);
        }
    },

    startStep: async (stepName, wordsList, startIndex = 0) => {
        await lessonStateManager.updateState(stepName, startIndex, training.state.data);
        training.state.status = stepName;
        training.state.currentStep = startIndex;
        
        training.queue = wordsList || [];
        training.currentIndex = startIndex;
        
        if (training.queue.length === 0 || training.currentIndex >= training.queue.length) {
            training.nextStep();
            return;
        }

        training.showCard();
    },

    /**
     * Завершение урока: закрываем состояние урока и отмечаем день учебного
     * цикла выполненным. Без второго шага цикл никогда бы не дошёл до контроля.
     */
    finishLesson: async () => {
        await lessonStateManager.completeLesson();

        const dayPlanId = training.state?.data?.dayPlanId;
        if (dayPlanId) await scheduler.completeDayPlan(dayPlanId);

        // Серия дней растёт по факту пройденного урока, а не от захода в приложение
        await scheduler.registerLessonCompleted();
    },

    nextStep: async () => {
        // ФИКС: Берем замороженные очереди из состояния, а не запрашиваем БД
        const data = training.state.data;
        const practiceWords = data.practiceQueue || [];
        
        if (training.state.status === 'review') {
            if (data.newWordsQueue && data.newWordsQueue.length > 0) {
                await training.startStep('new_words', data.newWordsQueue, 0);
            } else if (practiceWords.length > 0) {
                await training.startStep('practice', practiceWords, 0);
            } else {
                await training.finishLesson();
                training.showCompletedScreen();
            }
        } else if (training.state.status === 'new_words') {
            if (practiceWords.length > 0) {
                await training.startStep('practice', practiceWords, 0);
            } else {
                await training.finishLesson();
                training.showCompletedScreen();
            }
        } else if (training.state.status === 'practice') {
            // Когда практика пройдена - завершаем урок
            await training.finishLesson();
            training.showCompletedScreen();
        }
    },

    showCard: () => {
        const main = document.getElementById('main-content');
        
        // --- ИНТЕГРАЦИЯ УПРАЖНЕНИЙ (ЭТАП 2.2) ---
        if (training.state.status === 'practice') {
            exercises.start(training.queue, training.currentIndex, async () => {
                await training.finishLesson();
                training.state.status = 'completed';
                training.showCompletedScreen();
            });
            return;
        }

        training.currentWord = training.queue[training.currentIndex];
        const progress = ((training.currentIndex) / training.queue.length) * 100;
        const word = training.currentWord;

        let stepTitle = training.state.status === 'review' ? t('training.review') : t('training.newWords');
        let stepColor = training.state.status === 'review' ? 'blue-400' : 'green-400';

        let tableRows = '';
        if (word.type === 'noun') {
            if (word.plural) tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">Plural</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${word.plural}</span></div>`;
            if (word.dativ) tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">Dativ</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${word.dativ}</span></div>`;
        } else if (word.type === 'verb') {
            if (word.present) tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">Präsens</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${word.present}</span></div>`;
            if (word.preterite) tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">Präteritum</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${word.preterite}</span></div>`;
            if (word.participle_ii) {
                const aux = word.auxiliary === 'sein' ? 'sein' : 'haben';
                tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">Perfekt</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${aux} ${word.participle_ii}</span></div>`;
            }
            if (word.rektion) tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">Rektion</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${word.rektion}</span></div>`;
        } else if (word.type === 'adjective') {
            if (word.comparative) tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">Komparativ</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${word.comparative}</span></div>`;
            if (word.superlative) tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">Superlativ</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${word.superlative}</span></div>`;
        }

        if (word.synonym) tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">${t('card.synonyms')}</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${word.synonym}</span></div>`;
        if (word.gegenteil) tableRows += `<div class="flex justify-between items-center py-2.5 border-b border-slate-700/50"><span class="text-slate-400 text-sm">${t('card.antonyms')}</span><span class="font-bold text-slate-100 text-sm text-right pl-4">${word.gegenteil}</span></div>`;

        let grammarBlock = tableRows ? `<div class="bg-[#1b2234] rounded-xl px-4 py-1 mb-5 border border-slate-700/70 shadow-inner">${tableRows}</div>` : '';

        main.innerHTML = `
            <div class="max-w-lg mx-auto min-h-full flex flex-col pt-2 pb-6 fade-in">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-bold text-${stepColor} uppercase tracking-wider bg-${stepColor}/10 px-2 py-1 rounded border border-${stepColor}/20 shadow-sm">${stepTitle}</span>
                    <span class="text-xs font-bold text-slate-500">${t('training.wordOf', { current: training.currentIndex + 1, total: training.queue.length })}</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-2 mb-6 border border-slate-700 overflow-hidden shrink-0 mt-1">
                    <div class="bg-amber-500 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                </div>

                <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl overflow-hidden relative mb-6">
                    <div class="p-8 flex flex-col items-center justify-center text-center relative z-10 min-h-[200px]">
                        <span class="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">${word.type}</span>
                        <div class="flex items-center justify-center gap-4 mb-2 w-full">
                            <h2 class="text-3xl font-black text-slate-100 break-words">${word.word}</h2>
                            <button onclick="training.playAudio('${word.word.replace(/'/g, "\'")}')" class="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-amber-500 transition-colors shrink-0 shadow-lg" id="training-audio-btn">
                                <i class="fa-solid fa-volume-high text-lg"></i>
                            </button>
                        </div>
                    </div>

                    <div id="card-back" class="hidden flex-col p-5 bg-[#171d2b] border-t border-slate-700/50">
                        <h3 class="text-3xl font-bold text-amber-500 text-center mb-6 drop-shadow-md">${word.translation}</h3>
                        ${grammarBlock}
                        <div class="bg-[#1b2234] p-4 rounded-xl border border-slate-700/70 shadow-inner">
                            <p class="text-slate-200 font-bold italic mb-2">"${word.example_de || ''}"</p>
                            <p class="text-slate-400 text-sm">${word.example_ru || ''}</p>
                        </div>
                    </div>
                </div>

                <div id="controls-front" class="mt-auto">
                    <button onclick="training.flipCard()" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xl font-black rounded-xl shadow-lg active:scale-95 transition-all">
                        ${t('training.showAnswer')}
                    </button>
                </div>

                <div id="controls-back" class="mt-auto hidden grid-cols-4 gap-2">
                    <button onclick="training.rate(1)" class="flex flex-col items-center justify-center py-3.5 bg-[#3a2024] border border-[#522a2f] text-[#ff7171] rounded-xl active:scale-95 transition-transform hover:bg-[#47272c]">
                        <span class="text-[10px] opacity-70 mb-0.5">${srs.describeNext(1, word)}</span>
                        <span class="font-bold">${t('training.again')}</span>
                    </button>
                    <button onclick="training.rate(2)" class="flex flex-col items-center justify-center py-3.5 bg-[#3b271d] border border-[#553625] text-[#ff9e5e] rounded-xl active:scale-95 transition-transform hover:bg-[#4d3326]">
                        <span class="text-[10px] opacity-70 mb-0.5">${srs.describeNext(2, word)}</span>
                        <span class="font-bold">${t('training.hard')}</span>
                    </button>
                    <button onclick="training.rate(3)" class="flex flex-col items-center justify-center py-3.5 bg-[#1d3528] border border-[#264b38] text-[#5cd589] rounded-xl active:scale-95 transition-transform hover:bg-[#254433]">
                        <span class="text-[10px] opacity-70 mb-0.5">${srs.describeNext(3, word)}</span>
                        <span class="font-bold">${t('training.good')}</span>
                    </button>
                    <button onclick="training.rate(4)" class="flex flex-col items-center justify-center py-3.5 bg-[#1e2a45] border border-[#293d68] text-[#719fff] rounded-xl active:scale-95 transition-transform hover:bg-[#263556]">
                        <span class="text-[10px] opacity-70 mb-0.5">${srs.describeNext(4, word)}</span>
                        <span class="font-bold">${t('training.easy')}</span>
                    </button>
                </div>
            </div>
        `;
    },

    playAudio: (text) => {
        window.speechSynthesis.cancel();
        const btn = document.getElementById('training-audio-btn');
        if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-lg"></i>`;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE';
        window.currentSpeechUtterance = utterance;

        utterance.onend = () => { if (btn) btn.innerHTML = `<i class="fa-solid fa-volume-high text-lg"></i>`; };
        utterance.onerror = () => { if (btn) btn.innerHTML = `<i class="fa-solid fa-volume-high text-lg"></i>`; };
        window.speechSynthesis.speak(utterance);
    },

    flipCard: () => {
        document.getElementById('card-back').classList.remove('hidden');
        document.getElementById('card-back').classList.add('flex');
        document.getElementById('controls-front').classList.add('hidden');
        document.getElementById('controls-back').classList.remove('hidden');
        document.getElementById('controls-back').classList.add('grid');
    },

    rate: async (quality) => {
        let word = training.currentWord;
        
        const srsData = srs.calculate(quality, word);
        word.interval = srsData.interval;
        word.ease = srsData.ease;
        word.phase = srsData.phase;
        word.stepIndex = srsData.stepIndex;
        word.nextReview = srsData.nextReview;
        word.repetitions += 1;

        if (word.mastery !== undefined && word.mastery < 100) {
            word.mastery = Math.min(100, word.mastery + (quality * 5));
        }

        // Слово тронули — оно больше не «ждёт своего дня»
        if (word.status === 'pending' || word.status === 'new') word.status = 'learning';

        await dbService.putWord(word);

        const xpMap = { 1: 1, 2: 3, 3: 5, 4: 8 };
        const gainedXP = xpMap[quality];
        
        training.state.data.xpEarned = (training.state.data.xpEarned || 0) + gainedXP;
        
        if (training.state.status === 'new_words') {
            training.state.data.newWords = (training.state.data.newWords || 0) + 1;
        } else {
            training.state.data.reviewed = (training.state.data.reviewed || 0) + 1;
        }
        
        await dbService.addXP(gainedXP);

        training.currentIndex++;
        await lessonStateManager.updateState(training.state.status, training.currentIndex, training.state.data);

        if (training.currentIndex < training.queue.length) {
            training.showCard();
        } else {
            training.nextStep();
        }
    },

    showCompletedScreen: async () => {
        const user = await dbService.getUser();
        const main = document.getElementById('main-content');
        const stateData = training.state?.data || { newWords: 0, reviewed: 0, xpEarned: 0 };
        
        main.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center fade-in max-w-sm mx-auto">
                <div class="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(245,158,11,0.4)] border-4 border-slate-900">
                    <i class="fa-solid fa-trophy text-5xl text-slate-900"></i>
                </div>
                
                <h2 class="text-3xl font-black text-slate-100 mb-2">${t('training.doneTitle')}</h2>
                <p class="text-slate-400 mb-8">${t('training.doneText')}</p>
                
                <div class="w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg mb-8 space-y-4">
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 font-bold">${t('training.learnedNew')}</span>
                        <span class="text-green-400 font-black text-xl">+${stateData.newWords || 0}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 font-bold">${t('training.reviewed')}</span>
                        <span class="text-blue-400 font-black text-xl">${stateData.reviewed || 0}</span>
                    </div>
                    <div class="h-px w-full bg-slate-700 my-2"></div>
                    <div class="flex justify-between items-center">
                        <span class="text-amber-500 font-bold">${t('training.xpEarned')}</span>
                        <span class="text-amber-500 font-black text-2xl">+${stateData.xpEarned || 0}</span>
                    </div>
                    <div class="flex justify-between items-center pt-2">
                        <span class="text-slate-400 font-bold">${t('training.currentLeague')}</span>
                        <span class="text-white font-bold px-3 py-1 bg-slate-700 rounded-lg">${t('leagues.' + dbService.normalizeLeague(user.league))}</span>
                    </div>
                </div>
                
                <button onclick="app.navigate('plan')" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg active:scale-95 transition-transform">
                    ${t('training.backToBase')}
                </button>
            </div>
        `;
    }
};
