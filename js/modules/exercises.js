const exercises = {
    queue: [],
    currentIndex: 0,
    onFinish: null,
    isRoomMode: false,
    allowedModes: null,
    
    builderState: {
        words: [],
        selected: [],
        correct: []
    },
    
    matchPairsState: {
        selectedDe: null,
        selectedRu: null,
        matchedCount: 0,
        totalPairs: 4
    },

    start: async (wordsList, startIndex, onFinishCallback) => {
        exercises.queue = wordsList;
        exercises.currentIndex = startIndex;
        exercises.onFinish = onFinishCallback;

        if (exercises.queue.length === 0 || exercises.currentIndex >= exercises.queue.length) {
            exercises.onFinish();
            return;
        }
        exercises.renderCurrent();
    },

    renderCurrent: async () => {
        const main = document.getElementById('main-content');
        const word = exercises.queue[exercises.currentIndex];
        const progress = (exercises.currentIndex / exercises.queue.length) * 100;

        let title = exercises.isRoomMode ? 'СВОБОДНАЯ ТРЕНИРОВКА' : 'ПРАКТИКА (ЭТАП 2)';

        let html = `
            <div class="max-w-lg mx-auto min-h-full flex flex-col pt-2 pb-6 fade-in">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-bold text-purple-400 uppercase tracking-wider bg-purple-400/10 px-2 py-1 rounded border border-purple-400/20 shadow-sm">${title}</span>
                    <span class="text-xs font-bold text-slate-500">Задание ${exercises.currentIndex + 1} из ${exercises.queue.length}</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-2 mb-6 border border-slate-700 overflow-hidden shrink-0 mt-1">
                    <div class="bg-purple-500 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                </div>
        `;

        let validModes = [];
        const requested = exercises.allowedModes || [];
        const hasRequested = requested.length > 0;

        if (!hasRequested || requested.includes('translation_de_ru')) validModes.push('translation_de_ru');
        if (!hasRequested || requested.includes('translation_ru_de')) validModes.push('translation_ru_de');
        if (!hasRequested || requested.includes('match_pairs')) validModes.push('match_pairs');
        if ((!hasRequested || requested.includes('article')) && word.type === 'noun') validModes.push('article');
        if ((!hasRequested || requested.includes('verb_form')) && word.type === 'verb' && (word.preterite || word.participle_ii)) validModes.push('verb_form');
        if ((!hasRequested || requested.includes('rektion')) && word.type === 'verb' && word.rektion) validModes.push('rektion');
        if ((!hasRequested || requested.includes('fill_blanks')) && word.example_de) validModes.push('fill_blanks');
        if ((!hasRequested || requested.includes('sentence_builder')) && word.example_de) validModes.push('sentence_builder');
        if ((!hasRequested || requested.includes('listening')) && word.word) validModes.push('listening');

        if (validModes.length === 0) validModes.push('translation_de_ru'); 

        const exType = validModes[Math.floor(Math.random() * validModes.length)];

        if (exType === 'article') html += exercises.renderArticleQuiz(word);
        else if (exType === 'verb_form') html += exercises.renderVerbQuiz(word);
        else if (exType === 'fill_blanks') html += await exercises.renderFillBlanksQuiz(word);
        else if (exType === 'sentence_builder') html += exercises.renderSentenceBuilder(word);
        else if (exType === 'listening') html += exercises.renderListeningQuiz(word);
        else if (exType === 'rektion') html += exercises.renderRektionQuiz(word);
        else if (exType === 'match_pairs') html += await exercises.renderMatchPairsQuiz(word);
        else if (exType === 'translation_ru_de') html += await exercises.renderTranslationQuiz(word, 'ru-de');
        else html += await exercises.renderTranslationQuiz(word, 'de-ru');

        html += `</div>`;
        main.innerHTML = html;
        
        setTimeout(() => {
            const input = document.querySelector('input[type="text"]:not([disabled])');
            if (input) input.focus();
        }, 100);
    },

    // ==========================================
    // НАЙДИ ПАРУ (MATCH PAIRS)
    // ==========================================
    renderMatchPairsQuiz: async (word) => {
        const allWords = await db.words.toArray();
        const distractors = allWords.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3);
        const pairs = [...distractors, word];
        
        exercises.matchPairsState = { selectedDe: null, selectedRu: null, matchedCount: 0, totalPairs: pairs.length };
        
        let deBtns = pairs.map(p => ({ id: p.id, text: p.word, lang: 'de' })).sort(() => 0.5 - Math.random());
        let ruBtns = pairs.map(p => ({ id: p.id, text: p.translation, lang: 'ru' })).sort(() => 0.5 - Math.random());
        
        const renderBtn = (obj) => `<button id="mp-${obj.lang}-${obj.id}" onclick="exercises.clickMatchPair('${obj.lang}', ${obj.id})" class="mp-btn p-3 bg-slate-900 border-2 border-slate-700 text-slate-300 font-bold rounded-xl active:scale-95 transition-all text-sm h-16 flex items-center justify-center text-center break-words leading-tight hover:bg-slate-800">${obj.text}</button>`;

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6">
                <h3 class="text-sm font-bold text-slate-400 mb-6 text-center">Найдите пары</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-3 flex flex-col">${deBtns.map(renderBtn).join('')}</div>
                    <div class="space-y-3 flex flex-col">${ruBtns.map(renderBtn).join('')}</div>
                </div>
            </div>
        `;
    },

    clickMatchPair: (lang, id) => {
        const btn = document.getElementById(`mp-${lang}-${id}`);
        if (btn.classList.contains('matched') || btn.classList.contains('selected')) return;

        document.querySelectorAll(`.mp-btn.selected[id^="mp-${lang}-"]`).forEach(b => {
            b.classList.remove('selected', 'border-amber-500', 'text-amber-400', 'bg-amber-900/30');
            b.classList.add('border-slate-700', 'text-slate-300', 'bg-slate-900');
        });

        btn.classList.add('selected', 'border-amber-500', 'text-amber-400', 'bg-amber-900/30');
        btn.classList.remove('border-slate-700', 'text-slate-300', 'bg-slate-900');

        if (lang === 'de') exercises.matchPairsState.selectedDe = id;
        if (lang === 'ru') exercises.matchPairsState.selectedRu = id;

        const state = exercises.matchPairsState;
        if (state.selectedDe !== null && state.selectedRu !== null) {
            const deBtn = document.getElementById(`mp-de-${state.selectedDe}`);
            const ruBtn = document.getElementById(`mp-ru-${state.selectedRu}`);

            if (state.selectedDe === state.selectedRu) {
                deBtn.className = "mp-btn matched p-3 bg-green-600 border-2 border-green-400 text-white font-black rounded-xl text-sm h-16 flex items-center justify-center text-center transition-all scale-95 opacity-50";
                ruBtn.className = "mp-btn matched p-3 bg-green-600 border-2 border-green-400 text-white font-black rounded-xl text-sm h-16 flex items-center justify-center text-center transition-all scale-95 opacity-50";
                state.matchedCount++;
                state.selectedDe = null;
                state.selectedRu = null;

                if (state.matchedCount === state.totalPairs) {
                    setTimeout(exercises.next, 1000);
                }
            } else {
                // ЛОГИРОВАНИЕ ОШИБКИ
                if (typeof dbService !== 'undefined' && dbService.logMistake) {
                    dbService.logMistake(state.selectedDe, 'match_pairs', 'wrong_pair');
                }

                deBtn.classList.replace('border-amber-500', 'border-red-500');
                deBtn.classList.replace('text-amber-400', 'text-red-400');
                deBtn.classList.replace('bg-amber-900/30', 'bg-red-900/30');
                
                ruBtn.classList.replace('border-amber-500', 'border-red-500');
                ruBtn.classList.replace('text-amber-400', 'text-red-400');
                ruBtn.classList.replace('bg-amber-900/30', 'bg-red-900/30');
                
                setTimeout(() => {
                    deBtn.classList.remove('selected', 'border-red-500', 'text-red-400', 'bg-red-900/30');
                    deBtn.classList.add('border-slate-700', 'text-slate-300', 'bg-slate-900');
                    ruBtn.classList.remove('selected', 'border-red-500', 'text-red-400', 'bg-red-900/30');
                    ruBtn.classList.add('border-slate-700', 'text-slate-300', 'bg-slate-900');
                }, 800);
                
                state.selectedDe = null;
                state.selectedRu = null;
            }
        }
    },

    // ==========================================
    // ПРЯМОЙ / ОБРАТНЫЙ ПЕРЕВОД
    // ==========================================
    renderTranslationQuiz: async (word, direction = 'de-ru') => {
        const allWords = await db.words.toArray();
        const distractors = allWords.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [...distractors, word].sort(() => 0.5 - Math.random());
        
        const questionText = direction === 'ru-de' ? word.translation : word.word;
        const btnClass = direction === 'ru-de' ? 'text-xl' : 'text-base';
        const label = direction === 'ru-de' ? 'Как это будет по-немецки?' : 'Выберите верный перевод';

        let btns = options.map(opt => {
            const answerText = direction === 'ru-de' ? opt.word : opt.translation;
            return `<button onclick="exercises.checkChoice(this, '${opt.id}', '${word.id}', '${direction}')" class="w-full py-4 bg-slate-900 border-2 border-slate-700 text-slate-300 font-bold rounded-xl text-left px-5 hover:border-amber-500 active:scale-95 transition-all ${btnClass}">${answerText}</button>`;
        }).join('');

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6">
                <h3 class="text-sm font-bold text-slate-400 mb-6 text-center">${label}</h3>
                <h2 class="text-3xl font-black text-slate-100 mb-8 text-center">${questionText}</h2>
                <div class="space-y-3" id="ex-buttons">${btns}</div>
            </div>
        `;
    },

    renderArticleQuiz: (word) => {
        const parts = word.word.split(' ');
        let article = 'der';
        let pureWord = word.word;
        if (parts.length > 1 && ['der', 'die', 'das'].includes(parts[0].toLowerCase())) {
            article = parts[0].toLowerCase();
            pureWord = parts.slice(1).join(' ');
        }
        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">Выберите правильный артикль</h3>
                <h2 class="text-4xl font-black text-slate-100 mb-8 break-words">${pureWord}</h2>
                <div class="grid grid-cols-3 gap-3" id="ex-buttons">
                    <button onclick="exercises.checkChoice(this, 'der', '${article}', 'article')" class="py-4 bg-blue-900/30 border-2 border-blue-900/50 text-blue-400 font-bold rounded-xl text-xl hover:bg-blue-900/50 active:scale-95 transition-all">DER</button>
                    <button onclick="exercises.checkChoice(this, 'die', '${article}', 'article')" class="py-4 bg-red-900/30 border-2 border-red-900/50 text-red-400 font-bold rounded-xl text-xl hover:bg-red-900/50 active:scale-95 transition-all">DIE</button>
                    <button onclick="exercises.checkChoice(this, 'das', '${article}', 'article')" class="py-4 bg-green-900/30 border-2 border-green-900/50 text-green-400 font-bold rounded-xl text-xl hover:bg-green-900/50 active:scale-95 transition-all">DAS</button>
                </div>
            </div>
        `;
    },

    renderVerbQuiz: (word) => {
        const askPerfekt = !!word.participle_ii && Math.random() > 0.5;
        const targetForm = askPerfekt ? (word.auxiliary + ' ' + word.participle_ii).trim() : (word.preterite || word.participle_ii);
        const label = askPerfekt ? 'Perfekt (со вспом. глаголом)' : 'Präteritum (ich/er/sie/es)';
        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">Напишите форму глагола</h3>
                <h2 class="text-3xl font-black text-slate-100 mb-2">${word.word}</h2>
                <p class="text-slate-500 mb-8 font-bold">${word.translation}</p>
                <div class="mb-6 text-left">
                    <label class="block text-xs font-bold text-amber-500 mb-2">${label}</label>
                    <input type="text" id="ex-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold transition-colors" autocomplete="off">
                </div>
                <button onclick="exercises.checkInput('${targetForm.replace(/'/g, "\\'")}', 'verb_form')" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">ПРОВЕРИТЬ</button>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
            </div>
        `;
    },

    renderFillBlanksQuiz: async (word) => {
        const cleanWord = word.word.replace(/^(der|die|das|den|dem|des|ein|eine|sich)\s+/i, '').trim();
        const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        let masked = word.example_de;
        let targetMatch = cleanWord;
        let found = false;

        let rx = new RegExp('\\b' + escapeRegExp(cleanWord) + '\\b', 'gi');
        let matches = masked.match(rx);
        if (matches) { targetMatch = matches[0]; masked = masked.replace(rx, '_____'); found = true; }

        if (!found) {
            rx = new RegExp('\\b' + escapeRegExp(cleanWord) + '[a-zäöüß]*\\b', 'gi');
            matches = masked.match(rx);
            if (matches) { targetMatch = matches[0]; masked = masked.replace(new RegExp('\\b' + escapeRegExp(targetMatch) + '\\b', 'gi'), '_____'); found = true; }
        }

        if (!found && cleanWord.length > 3) {
            let stem = cleanWord;
            if (stem.endsWith('en')) stem = stem.slice(0, -2);
            else if (stem.endsWith('n')) stem = stem.slice(0, -1);
            
            rx = new RegExp('\\b' + escapeRegExp(stem) + '[a-zäöüß]*\\b', 'gi');
            matches = masked.match(rx);
            if (matches && matches[0].length >= stem.length) { targetMatch = matches[0]; masked = masked.replace(new RegExp('\\b' + escapeRegExp(targetMatch) + '\\b', 'gi'), '_____'); found = true; }
        }

        if (!found) {
            rx = new RegExp(escapeRegExp(cleanWord), 'gi');
            matches = masked.match(rx);
            if (matches) { targetMatch = matches[0]; masked = masked.replace(rx, '_____'); found = true; }
        }

        if (!found) masked = `_____ ${word.example_de}`;

        const allWords = await db.words.toArray();
        const distractors = allWords.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 2).map(w => w.word);
        const hints = [...distractors, targetMatch].sort(() => 0.5 - Math.random());

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">Заполните пропуск</h3>
                <p class="text-slate-400 text-xs mb-4">Перевод: ${word.example_ru || word.translation}</p>
                <h2 class="text-2xl font-black text-slate-100 mb-8 leading-relaxed">${masked}</h2>
                
                <div class="flex flex-wrap justify-center gap-2 mb-6">
                    ${hints.map(h => `<span class="bg-slate-800 text-slate-400 px-3 py-1 rounded-lg text-sm border border-slate-700 select-none">${h}</span>`).join('')}
                </div>

                <div class="mb-6">
                    <input type="text" id="ex-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold shadow-inner transition-colors" placeholder="Слово...">
                </div>
                <button onclick="exercises.checkInput('${targetMatch.replace(/'/g, "\\'")}', 'fill_blanks')" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">ПРОВЕРИТЬ</button>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
            </div>
        `;
    },

    renderRektionQuiz: (word) => {
        const prepMatch = word.rektion.match(/^([a-zäöüß]+)\s*\+/i);
        const correctPrep = prepMatch ? prepMatch[1].toLowerCase() : word.rektion;
        
        const preps = ['auf', 'an', 'für', 'über', 'um', 'mit', 'nach', 'zu', 'von', 'bei'];
        let options = preps.filter(p => p !== correctPrep).sort(() => 0.5 - Math.random()).slice(0, 3);
        options.push(correctPrep);
        options = options.sort(() => 0.5 - Math.random());

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">Какое управление (Rektion) у глагола?</h3>
                <h2 class="text-4xl font-black text-slate-100 mb-2">${word.word}</h2>
                <p class="text-slate-500 mb-8 font-bold">${word.translation}</p>
                
                <div class="grid grid-cols-2 gap-3" id="ex-buttons">
                    ${options.map(opt => `
                        <button onclick="exercises.checkChoice(this, '${opt}', '${correctPrep}', 'rektion')" class="py-4 bg-slate-900 border-2 border-slate-700 hover:border-amber-500 text-amber-500 font-bold rounded-xl text-lg uppercase tracking-wider active:scale-95 transition-all">${opt}</button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderListeningQuiz: (word) => {
        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6 text-center">
                <h3 class="text-sm font-bold text-slate-400 mb-6">Аудирование</h3>
                
                <button onclick="training.playAudio('${word.word.replace(/'/g, "\\'")}')" class="w-20 h-20 mx-auto bg-amber-500 text-slate-900 rounded-full flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(245,158,11,0.4)] mb-8 active:scale-95 transition-transform" id="training-audio-btn">
                    <i class="fa-solid fa-headphones"></i>
                </button>

                <div class="mb-6 text-left">
                    <label class="block text-xs font-bold text-amber-500 mb-2">Напишите то, что услышали</label>
                    <input type="text" id="ex-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 text-center text-xl font-bold shadow-inner transition-colors" autocomplete="off">
                </div>
                <button onclick="exercises.checkInput('${word.word.replace(/'/g, "\\'")}', 'listening')" class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl active:scale-95 transition-all" id="ex-submit">ПРОВЕРИТЬ</button>
                <div id="ex-feedback" class="mt-4 hidden font-bold text-lg p-3 rounded-xl transition-all"></div>
                
                <script>setTimeout(() => training.playAudio('${word.word.replace(/'/g, "\\'")}'), 300);</script>
            </div>
        `;
    },

    renderSentenceBuilder: (word) => {
        const cleanSentence = word.example_de.replace(/[.,!?]/g, '');
        const words = cleanSentence.split(' ').filter(w => w.length > 0);
        
        exercises.builderState.correct = [...words];
        exercises.builderState.words = [...words].sort(() => 0.5 - Math.random());
        exercises.builderState.selected = [];

        return `
            <div class="w-full flex flex-col bg-[#21293c] rounded-2xl border border-slate-700 shadow-xl relative mb-6 p-6">
                <h3 class="text-sm font-bold text-slate-400 mb-6 text-center">Соберите предложение</h3>
                <p class="text-slate-400 text-sm mb-4 text-center border-b border-slate-700 pb-4">${word.example_ru || word.translation}</p>
                
                <div id="sb-target" class="min-h-[60px] bg-slate-900/50 rounded-xl border border-slate-600 p-3 mb-6 flex flex-wrap gap-2 content-start cursor-pointer" onclick="exercises.builderRemoveLast()"></div>
                
                <div id="sb-source" class="flex flex-wrap gap-2 justify-center mb-6">
                    ${exercises.builderState.words.map((w, i) => `
                        <button id="sb-word-${i}" onclick="exercises.builderAdd(${i})" class="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-200 rounded-lg shadow font-medium active:scale-95 transition-transform hover:bg-slate-700">${w}</button>
                    `).join('')}
                </div>
                
                <button onclick="exercises.skipBuilder()" class="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 font-bold rounded-xl active:scale-95 transition-all text-sm mb-2" id="sb-skip-btn">
                    СЛОЖНО, ПРОПУСТИТЬ
                </button>
                
                <div id="ex-feedback" class="mt-2 hidden font-bold text-lg p-3 rounded-xl text-center transition-all"></div>
            </div>
        `;
    },

    builderAdd: (index) => {
        const word = exercises.builderState.words[index];
        exercises.builderState.selected.push(word);
        document.getElementById(`sb-word-${index}`).classList.add('hidden');
        exercises.updateBuilderUI();
    },

    builderRemoveLast: () => {
        if (exercises.builderState.selected.length === 0) return;
        const word = exercises.builderState.selected.pop();
        const btns = document.querySelectorAll('#sb-source button.hidden');
        for(let btn of btns) {
            if(btn.innerText === word) {
                btn.classList.remove('hidden');
                break;
            }
        }
        exercises.updateBuilderUI();
    },

    updateBuilderUI: () => {
        const target = document.getElementById('sb-target');
        target.innerHTML = exercises.builderState.selected.map(w => `<span class="px-3 py-1 bg-amber-500 text-slate-900 rounded shadow font-bold">${w}</span>`).join('');
        
        if (exercises.builderState.selected.length === exercises.builderState.correct.length) {
            exercises.checkBuilder();
        }
    },

    checkBuilder: () => {
        const feedback = document.getElementById('ex-feedback');
        const skipBtn = document.getElementById('sb-skip-btn');
        if (skipBtn) skipBtn.disabled = true;

        const isCorrect = exercises.builderState.selected.join(' ') === exercises.builderState.correct.join(' ');
        
        feedback.classList.remove('hidden');
        if (isCorrect) {
            feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-green-600 border border-green-400 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]";
            feedback.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Richtig!`;
            setTimeout(exercises.next, 1500);
        } else {
            // ЛОГИРОВАНИЕ ОШИБКИ
            const currentWord = exercises.queue[exercises.currentIndex];
            if (typeof dbService !== 'undefined' && dbService.logMistake) {
                dbService.logMistake(currentWord.id, 'sentence_builder', exercises.builderState.selected.join(' '));
            }

            feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-red-600 border border-red-400 text-white";
            feedback.innerHTML = `<i class="fa-solid fa-xmark mr-2"></i> Falsch! Нажмите на область, чтобы убрать слово.`;
            if (skipBtn) skipBtn.disabled = false; 
        }
    },

    skipBuilder: () => {
        const feedback = document.getElementById('ex-feedback');
        const skipBtn = document.getElementById('sb-skip-btn');
        if (skipBtn) skipBtn.disabled = true;
        
        const wordBtns = document.querySelectorAll('#sb-source button');
        wordBtns.forEach(b => b.disabled = true);
        
        const correctSentence = exercises.builderState.correct.join(' ');
        
        // ЛОГИРОВАНИЕ ОШИБКИ (ПРОПУСК = ОШИБКА)
        const currentWord = exercises.queue[exercises.currentIndex];
        if (typeof dbService !== 'undefined' && dbService.logMistake) {
            dbService.logMistake(currentWord.id, 'sentence_builder', 'SKIPPED');
        }

        feedback.classList.remove('hidden');
        feedback.className = "mt-2 font-bold text-lg p-3 rounded-xl text-center bg-slate-900/80 border border-slate-600/50 text-slate-300";
        feedback.innerHTML = `
            <span class="text-slate-400 text-xs font-normal block mb-1 uppercase tracking-widest">Правильный ответ:</span>
            <b class="text-amber-500 text-base leading-snug block">${correctSentence}</b>
        `;
        
        setTimeout(exercises.next, 3000);
    },

    checkChoice: (btn, selected, correct, exType = 'choice') => {
        const btns = document.getElementById('ex-buttons').children;
        for (let b of btns) {
            b.disabled = true;
            
            const onclickStr = b.getAttribute('onclick') || '';
            const match = onclickStr.match(/checkChoice\(this,\s*'([^']+)'/);
            const btnValue = match ? match[1] : null;

            const originalText = b.innerText.trim();
            b.className = b.className.replace(/(bg|border|text)-\S+/g, ' ').replace('hover:border-amber-500', '').trim();

            if (btnValue === correct) {
                b.classList.add('bg-green-600', 'border-green-400', 'text-white', 'shadow-[0_0_15px_rgba(22,163,74,0.5)]', 'scale-105', 'z-10');
                b.innerHTML = `<span class="flex items-center justify-center gap-2 w-full"><i class="fa-solid fa-check text-xl"></i> <span>${originalText}</span></span>`;
            } else if (btnValue === selected && selected !== correct) {
                // ЛОГИРОВАНИЕ ОШИБКИ
                const currentWord = exercises.queue[exercises.currentIndex];
                if (typeof dbService !== 'undefined' && dbService.logMistake) {
                    dbService.logMistake(currentWord.id, exType, selected);
                }

                b.classList.add('bg-red-600', 'border-red-400', 'text-white');
                b.innerHTML = `<span class="flex items-center justify-center gap-2 w-full"><i class="fa-solid fa-xmark text-xl"></i> <span class="line-through opacity-80">${originalText}</span></span>`;
            } else {
                b.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-500', 'opacity-40', 'scale-95');
                b.innerHTML = `<span class="flex items-center justify-center w-full">${originalText}</span>`;
            }
        }

        if (selected === correct) {
            setTimeout(exercises.next, 1200);
        } else {
            setTimeout(exercises.next, 2500);
        }
    },

    checkInput: (correct, exType = 'input') => {
        const input = document.getElementById('ex-input');
        const feedback = document.getElementById('ex-feedback');
        const btn = document.getElementById('ex-submit');
        
        const selected = input.value.trim().toLowerCase();
        const correctLower = correct.toLowerCase();

        input.disabled = true;
        btn.disabled = true;
        feedback.classList.remove('hidden');

        if (selected === correctLower) {
            input.classList.remove('bg-slate-900', 'border-slate-600');
            input.classList.add('bg-green-900/40', 'border-green-500', 'text-green-400');
            
            feedback.className = "mt-4 font-bold text-lg p-3 rounded-xl bg-green-600 border border-green-400 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]";
            feedback.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Richtig!`;
            setTimeout(exercises.next, 1500);
        } else {
            // ЛОГИРОВАНИЕ ОШИБКИ
            const currentWord = exercises.queue[exercises.currentIndex];
            if (typeof dbService !== 'undefined' && dbService.logMistake) {
                dbService.logMistake(currentWord.id, exType, selected);
            }

            input.classList.remove('bg-slate-900', 'border-slate-600');
            input.classList.add('bg-red-900/40', 'border-red-500', 'text-red-400', 'line-through');
            
            feedback.className = "mt-4 font-bold text-lg p-3 rounded-xl bg-red-600 border border-red-400 text-white";
            feedback.innerHTML = `
                <div class="flex items-center justify-center mb-1"><i class="fa-solid fa-xmark mr-2"></i> Falsch!</div>
                <div class="text-red-100 text-sm font-normal pt-2 border-t border-red-400/50">
                    Правильно: <b class="text-white text-base tracking-wide">${correct}</b>
                </div>`;
            setTimeout(exercises.next, 3000);
        }
    },

    next: async () => {
        exercises.currentIndex++;
        
        if (!exercises.isRoomMode && typeof training !== 'undefined' && training.state && training.state.data) {
            await lessonStateManager.updateState('practice', exercises.currentIndex, training.state.data);
        }

        if (exercises.currentIndex < exercises.queue.length) {
            exercises.renderCurrent();
        } else {
            exercises.onFinish();
        }
    }
};