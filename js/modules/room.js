import { dialog } from '../core/dialog.js';
import { masteryUtils } from '../core/mastery.js';
import { quiz } from '../core/quiz.js';
import { dbService } from '../services/db.js';
import { i18n, t } from '../i18n/i18n.js';
import { aiService } from '../services/ai.js';
import { exercises } from './exercises.js';

export const room = {
    render: () => {
        const main = document.getElementById('main-content');
        
        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-10">
                <h2 class="text-2xl font-bold text-slate-100 mb-6 text-center">${t('room.title')}</h2>
                
                <h3 class="text-sm font-bold text-amber-500 mb-4 px-1 uppercase tracking-wider flex justify-between items-center">
                    ${t('room.microTrainers')}
                    <label class="flex items-center gap-2 cursor-pointer">
                        <span class="text-xs text-slate-400">${t('room.onlyHard')}</span>
                        <input type="checkbox" id="room-hard-mode" class="accent-amber-500 w-4 h-4">
                    </label>
                </h3>
                
                <div class="grid grid-cols-2 gap-3 mb-8">
                    <button onclick="room.startExerciseMode(['translation_de_ru'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-language text-blue-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeDeRu')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['translation_ru_de'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-language text-blue-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeRuDe')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['translation_ru_de_input'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-pen-to-square text-blue-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeProduction')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['match_pairs'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-purple-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-layer-group text-purple-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeMatch')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['article'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-pink-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-font text-pink-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeArticles')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['verb_form'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-pink-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-spell-check text-pink-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeVerbForms')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['fill_blanks'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-amber-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-keyboard text-amber-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeContext')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['sentence_builder'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-green-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-puzzle-piece text-green-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeBuilder')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['rektion'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-green-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-link text-green-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeRektion')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['listening'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-teal-500 transition-colors flex flex-col items-center gap-2 col-span-2 active:scale-95">
                        <i class="fa-solid fa-headphones text-teal-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeListening')}</span>
                    </button>
                </div>

                <h3 class="text-sm font-bold text-slate-500 mb-4 px-1 uppercase tracking-wider">${t('room.immersive')}</h3>
                
                <div class="grid grid-cols-1 gap-3">
                    <div onclick="room.startStory()" class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg hover:border-green-500 cursor-pointer transition-all flex items-center gap-4 group">
                        <div class="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center text-lg group-hover:scale-110 transition-transform"><i class="fa-solid fa-book-open-reader"></i></div>
                        <div>
                            <h3 class="font-bold text-slate-100 text-sm group-hover:text-green-400 transition-colors">${t('room.storyTitle')}</h3>
                            <p class="text-xs text-slate-400 mt-0.5">${t('room.storyHint')}</p>
                        </div>
                    </div>
                </div>

                <div id="room-game-container" class="mt-6"></div>
            </div>
        `;
    },

    startExerciseMode: async (allowedModes) => {
        // Комната — это закрепление, а не первое знакомство. Слова, которые
        // ещё ни разу не показали карточкой, спрашивать нельзя: раньше сюда
        // попадал весь словарь, включая заготовленные на будущие дни слова.
        let allWords = await dbService.getStudiedWords();

        if (allWords.length === 0) {
            await dialog.alert(t('room.nothingStudied'));
            return;
        }

        const studiedCount = allWords.length;

        const hardModeToggle = document.getElementById('room-hard-mode');
        const isHardMode = hardModeToggle && hardModeToggle.checked;

        if (isHardMode) {
            allWords = allWords.filter(masteryUtils.isWeak);
        }

        // Интеллектуальный фильтр слов под выбранный режим.
        let compatibleWords = allWords.filter(w => {
            let isValid = false;
            if (allowedModes.includes('translation_de_ru') || allowedModes.includes('translation_ru_de') || allowedModes.includes('translation_ru_de_input') || allowedModes.includes('match_pairs')) isValid = true;
            if (allowedModes.includes('listening') && w.word) isValid = true;
            if (allowedModes.includes('article') && w.type === 'noun') isValid = true;
            if (allowedModes.includes('verb_form') && w.type === 'verb' && (w.preterite || w.participle_ii)) isValid = true;
            if (allowedModes.includes('fill_blanks') && w.example_de && w.example_de.length > 2) isValid = true;
            if (allowedModes.includes('sentence_builder') && w.example_de && w.example_de.length > 2) isValid = true;
            if (allowedModes.includes('rektion') && w.type === 'verb' && w.rektion) isValid = true;
            
            return isValid;
        });

        if (compatibleWords.length < 4) {
            let errorMsg = t('room.notEnough') + '\n\n';
            if (studiedCount < 4) errorMsg += t('room.notEnoughStudied');
            else if (isHardMode) errorMsg += t('room.notEnoughHard');
            else if (allowedModes.includes('article')) errorMsg += t('room.notEnoughNouns');
            else if (allowedModes.includes('verb_form')) errorMsg += t('room.notEnoughVerbs');
            else if (allowedModes.includes('rektion')) errorMsg += t('room.notEnoughRektion');
            else if (allowedModes.includes('fill_blanks') || allowedModes.includes('sentence_builder')) errorMsg += t('room.notEnoughExamples');
            
            await dialog.alert(errorMsg);
            return;
        }
        
        const sessionWords = quiz.shuffle(compatibleWords).slice(0, 10);
        
        exercises.isRoomMode = true;
        exercises.allowedModes = allowedModes;
        
        exercises.start(sessionWords, 0, () => {
            exercises.isRoomMode = false;
            exercises.allowedModes = null;
            
            const main = document.getElementById('main-content');
            main.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center fade-in max-w-sm mx-auto">
                    <div class="w-24 h-24 bg-purple-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(168,85,247,0.4)] border-4 border-slate-900">
                        <i class="fa-solid fa-dumbbell text-5xl text-slate-900"></i>
                    </div>
                    <h2 class="text-3xl font-black text-slate-100 mb-2">${t('room.doneTitle')}</h2>
                    <p class="text-slate-400 mb-8">${t('room.doneText')}</p>
                    <button onclick="room.render()" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg active:scale-95 transition-transform">
                        ${t('room.backToRoom')}
                    </button>
                </div>
            `;
        });
    },

    startStory: async () => {
        const container = document.getElementById('room-game-container');
        // История тоже про закрепление: берём пройденное, а весь словарь —
        // только пока проходить нечего
        const studied = await dbService.getStudiedWords();
        const allWords = studied.length > 0 ? studied : await dbService.getAllWords();

        if (allWords.length === 0) {
            container.innerHTML = `
                <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center fade-in">
                    <p class="text-slate-400 mb-4">${t('room.emptyDict')}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 fade-in">
                <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500 border-opacity-50 mb-4"></div>
                <p class="text-slate-400 font-medium animate-pulse">${t('room.storyLoading')}</p>
            </div>
        `;

        try {
            const sampleWords = quiz.shuffle(allWords).slice(0, 7);
            const storyData = await aiService.generateStory(sampleWords);

            room.currentFullTranslation = storyData.story_ru;

            const wordsHtml = storyData.story_de.split(' ').map(token => {
                const cleanWord = token.replace(/[^a-zA-ZäöüßÄÖÜ]/g, '').toLowerCase();
                return `<span onclick="room.translateWord(event, '${cleanWord}')" class="cursor-pointer hover:bg-amber-500/20 hover:text-amber-400 rounded px-1 transition-colors">${token}</span>`;
            }).join(' ');

            container.innerHTML = `
                <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl fade-in space-y-6">
                    <div class="flex justify-between items-center border-b border-slate-700 pb-3">
                        <h3 class="font-bold text-amber-500 text-lg"><i class="fa-solid fa-hand-pointer mr-2"></i> ${t('room.storyHeader')}</h3>
                        <button onclick="room.startStory()" class="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-slate-300 transition-colors">${t('room.newStory')}</button>
                    </div>

                    <div id="tap-translation-box" class="hidden bg-amber-500/10 border border-amber-500/50 p-3 rounded-xl text-amber-300 text-sm flex justify-between items-center gap-2">
                        <span id="tap-translation-text"></span>
                        <div class="flex items-center gap-2 shrink-0">
                            <button id="tap-add-btn" class="hidden text-xs bg-amber-500 text-slate-900 font-bold px-2.5 py-1 rounded-lg hover:bg-amber-400 transition-colors"> + ${t('room.addWord')} </button>
                            <button onclick="document.getElementById('tap-translation-box').classList.add('hidden')" class="text-xs opacity-70 hover:opacity-100 p-1"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div class="bg-slate-900/80 p-5 rounded-xl border border-slate-700">
                            <p class="text-slate-100 text-lg leading-relaxed">${wordsHtml}</p>
                        </div>
                        
                        <div>
                            <button id="toggle-trans-btn" onclick="room.toggleFullTranslation()" class="w-full py-3 bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl hover:border-amber-500 transition-all">
                                ${t('room.showTranslation')}
                            </button>
                            <div id="full-translation-container" class="hidden mt-3 bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 fade-in">
                                <p class="text-slate-400 text-sm leading-relaxed">${storyData.story_ru}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<p class="text-red-400 text-center bg-red-900/20 p-4 rounded-xl border border-red-900/50">${error.message}</p>`;
        }
    },

    translateWord: async (event, cleanWord) => {
        if (!cleanWord || cleanWord.length < 2) return;
        
        const box = document.getElementById('tap-translation-box');
        const textSpan = document.getElementById('tap-translation-text');
        const addBtn = document.getElementById('tap-add-btn');
        
        box.classList.remove('hidden');
        addBtn.classList.add('hidden');
        textSpan.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> ${t('room.searching', { word: cleanWord })}`;

        const allWords = await dbService.getAllWords();
        const found = allWords.find(w => w.word.toLowerCase().includes(cleanWord));

        if (found) {
            textSpan.innerHTML = `<b>${found.word}</b> — <span class="text-white">${found.translation}</span> <span class="text-xs opacity-75 ml-2">${t('room.alreadyInDict')}</span>`;
        } else {
            try {
                const prompt = `Переведи немецкое слово "${cleanWord}" на язык ${i18n.aiLanguage().name} кратко. Верни JSON в формате: {"word": "${cleanWord}", "translation": "перевод", "type": "noun/verb/adjective/phrase"}`;
                const raw = await aiService.callGemini(prompt, true);
                const wordData = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());

                textSpan.innerHTML = `<b>${wordData.word}</b> — <span class="text-white font-bold">${wordData.translation}</span>`;
                
                addBtn.classList.remove('hidden');
                addBtn.onclick = async () => {
                    addBtn.disabled = true;
                    addBtn.innerText = t('room.added');
                    
                    await dbService.addWord({
                        word: wordData.word,
                        translation: wordData.translation,
                        type: wordData.type || 'phrase',
                        topic: t('room.storyHeader'),
                        example_de: `Er hat ${wordData.word} verwendet.`,
                        example_ru: t('room.usedExample', { word: wordData.translation })
                    });
                };
            } catch (e) {
                textSpan.innerText = t('room.translateFailed', { word: cleanWord });
            }
        }
    },

    toggleFullTranslation: () => {
        const cont = document.getElementById('full-translation-container');
        const btn = document.getElementById('toggle-trans-btn');
        
        if (cont.classList.contains('hidden')) {
            cont.classList.remove('hidden');
            btn.innerText = t('room.hideTranslation');
            btn.className = "w-full py-3 bg-slate-800 border border-slate-600 text-amber-500 text-xs font-bold rounded-xl transition-all";
        } else {
            cont.classList.add('hidden');
            btn.innerText = t('room.showTranslation');
            btn.className = "w-full py-3 bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl hover:border-amber-500 transition-all";
        }
    }
};