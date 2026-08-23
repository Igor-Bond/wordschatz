import { config } from '../config.js';
import { i18n, t } from '../i18n/i18n.js';
import { dbService } from '../services/db.js';
import { aiService } from '../services/ai.js';

export const scanner = {
    currentResults: [],

    render: () => {
        const main = document.getElementById('main-content');
        
        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-10">
                <h2 class="text-2xl font-bold text-slate-100 mb-6 text-center">${t('scanner.title')}</h2>
                
                <!-- Вкладки (Режимы) -->
                <div class="flex bg-slate-800 rounded-xl p-1 mb-6 border border-slate-700">
                    <button onclick="scanner.switchTab('single')" id="tab-single" class="flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all">${t('scanner.tabSingle')}</button>
                    <button onclick="scanner.switchTab('topic')" id="tab-topic" class="flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all">${t('scanner.tabTopic')}</button>
                    <button onclick="scanner.switchTab('text')" id="tab-text" class="flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all">${t('scanner.tabText')}</button>
                </div>

                <!-- Режим: Одно слово -->
                <div id="mode-single" class="space-y-4">
                    <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg">
                        <label class="block text-sm font-bold text-slate-400 mb-2">${t('scanner.wordLabel')}</label>
                        <div class="flex gap-2">
                            <input type="text" id="scan-word-input" class="flex-1 bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500 transition-colors" placeholder="${t('scanner.wordPlaceholder')}">
                            <button onclick="scanner.searchWord()" class="w-14 h-14 bg-amber-500 text-slate-900 rounded-xl shadow-lg hover:bg-amber-400 transition-transform active:scale-95 flex items-center justify-center">
                                <i class="fa-solid fa-magnifying-glass text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Режим: Тема (Генерация ИИ) -->
                <div id="mode-topic" class="space-y-4 hidden">
                    <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg">
                        <label class="block text-sm font-bold text-slate-400 mb-2">${t('scanner.topicLabel')}</label>
                        <input type="text" id="scan-topic-input" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 mb-4 outline-none focus:border-amber-500 transition-colors" placeholder="${t('scanner.topicPlaceholder')}">
                        
                        <label class="block text-sm font-bold text-slate-400 mb-2">${t('scanner.countLabel')}</label>
                        <input type="number" id="scan-count-input" value="15" min="5" max="30" class="w-full bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 mb-6 outline-none focus:border-amber-500">
                        
                        <button onclick="scanner.generateTopic()" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg hover:bg-amber-400 transition-transform active:scale-95 flex items-center justify-center gap-2">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> ${t('scanner.generate')}
                        </button>
                    </div>
                </div>

                <!-- Режим: Текст (Умный сканер) -->
                <div id="mode-text" class="space-y-4 hidden">
                    <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg">
                        <label class="block text-sm font-bold text-slate-400 mb-2">${t('scanner.textLabel')}</label>
                        <textarea id="scan-text-input" class="w-full h-32 bg-slate-900 border-2 border-slate-600 text-slate-100 rounded-xl px-4 py-3 mb-6 outline-none focus:border-amber-500 transition-colors resize-none" placeholder="${t('scanner.textPlaceholder')}"></textarea>
                        
                        <button onclick="scanner.analyzeText()" class="w-full py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg hover:bg-amber-400 transition-transform active:scale-95 flex items-center justify-center gap-2">
                            <i class="fa-solid fa-magnifying-glass-text"></i> ${t('scanner.analyze')}
                        </button>
                    </div>
                </div>

                <!-- Зона результатов (Лоадер и карточки) -->
                <div id="scan-results" class="mt-8 space-y-4"></div>
            </div>
        `;
    },

    switchTab: (tab) => {
        const tabs = ['single', 'topic', 'text'];
        
        tabs.forEach(t => {
            const btn = document.getElementById(`tab-${t}`);
            const mode = document.getElementById(`mode-${t}`);
            
            if (t === tab) {
                btn.className = "flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all";
                mode.classList.remove('hidden');
            } else {
                btn.className = "flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all";
                mode.classList.add('hidden');
            }
        });

        // Очищаем результаты при переключении вкладок
        document.getElementById('scan-results').innerHTML = '';
        scanner.currentResults = [];
    },

    showLoader: (text) => {
        document.getElementById('scan-results').innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 fade-in">
                <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500 border-opacity-50 mb-4"></div>
                <p class="text-slate-400 font-medium animate-pulse">${text}</p>
            </div>
        `;
    },

    searchWord: async () => {
        const input = document.getElementById('scan-word-input').value.trim();
        if (!input) return;
        scanner.showLoader(t('scanner.loadingWord', { word: input }));
        
        try {
            const prompt = `Пользователь ввел слово/фразу: "${input}". 
            Определи часть речи, переведи на язык ${i18n.aiLanguage().name}.
            Если это существительное - дай plural и dativ. 
            Если глагол - present (ich, du, er) и rektion. 
            Дай антоним (gegenteil) если есть, и составь живой пример.
            Верни ТОЛЬКО 1 объект в JSON массиве. Формат:
${aiService._getJsonFormat()}`;
            
            const rawResponse = await aiService.callGemini(prompt, true);
            let result = aiService._parseJsonResponse(rawResponse, config.getProfile().level, t('scanner.topicMisc'));
            
            scanner.currentResults = result.map(w => ({...w, selected: true})); 
            scanner.renderResults(scanner.currentResults);
        } catch (error) {
            document.getElementById('scan-results').innerHTML = `<p class="text-red-400 text-center bg-red-900/20 p-4 rounded-xl border border-red-900/50">${error.message}</p>`;
        }
    },

    generateTopic: async () => {
        const topic = document.getElementById('scan-topic-input').value.trim() || t('scanner.topicDefault');
        const count = document.getElementById('scan-count-input').value;
        scanner.showLoader(t('scanner.loadingTopic', { count, topic }));
        
        try {
            const result = await aiService.generateSet(topic, count);
            scanner.currentResults = result.map(w => ({...w, selected: true}));
            scanner.renderResults(scanner.currentResults);
        } catch (error) {
            document.getElementById('scan-results').innerHTML = `<p class="text-red-400 text-center bg-red-900/20 p-4 rounded-xl border border-red-900/50">${error.message}</p>`;
        }
    },

    analyzeText: async () => {
        const text = document.getElementById('scan-text-input').value.trim();
        if (!text) return;
        scanner.showLoader(t('scanner.loadingText'));
        
        try {
            const profile = config.getProfile();
            const prompt = `Проанализируй текст: "${text}". 
            Найди от 5 до 10 самых полезных незнакомых слов для студента уровня ${profile.level}.
            Определи часть речи, переведи на язык ${i18n.aiLanguage().name}.
            Если это существительное - дай plural и dativ. 
            Если глагол - present (ich, du, er) и rektion. 
            Дай антоним (gegenteil) если есть, и вытащи предложение с этим словом из текста (или составь свое).
            Верни JSON массив объектов. Формат:
${aiService._getJsonFormat()}`;
            
            const rawResponse = await aiService.callGemini(prompt, true);
            let result = aiService._parseJsonResponse(rawResponse, profile.level, t('scanner.topicFromText'));
            
            scanner.currentResults = result.map(w => ({...w, selected: true})); 
            scanner.renderResults(scanner.currentResults);
        } catch (error) {
            document.getElementById('scan-results').innerHTML = `<p class="text-red-400 text-center bg-red-900/20 p-4 rounded-xl border border-red-900/50">${error.message}</p>`;
        }
    },

    toggleWord: (index) => {
        scanner.currentResults[index].selected = !scanner.currentResults[index].selected;
        const isSelected = scanner.currentResults[index].selected;
        
        const card = document.getElementById(`scan-card-${index}`);
        const checkbox = document.getElementById(`scan-checkbox-${index}`);
        const content = document.getElementById(`scan-content-${index}`);
        const countSpan = document.getElementById('scan-selected-count');

        checkbox.checked = isSelected;
        
        if (isSelected) {
            card.classList.remove('border-slate-700');
            card.classList.add('border-amber-500');
            content.classList.remove('opacity-40');
            content.classList.add('opacity-100');
        } else {
            card.classList.remove('border-amber-500');
            card.classList.add('border-slate-700');
            content.classList.remove('opacity-100');
            content.classList.add('opacity-40');
        }

        const totalSelected = scanner.currentResults.filter(w => w.selected).length;
        countSpan.innerText = totalSelected;
    },

    renderResults: (wordsArray) => {
        const container = document.getElementById('scan-results');
        if (!wordsArray || wordsArray.length === 0) {
            container.innerHTML = `<p class="text-center text-slate-500">${t('scanner.nothingFound')}</p>`;
            return;
        }

        const selectedCount = wordsArray.filter(w => w.selected).length;

        let html = `
            <div class="flex justify-between items-center mb-4 px-2 py-3 bg-slate-900/90 backdrop-blur-md sticky top-[72px] z-20 border-b border-slate-700 rounded-xl shadow-lg">
                <span class="text-sm font-bold text-slate-300">${t('scanner.selected')}: <span id="scan-selected-count" class="text-amber-500 text-lg">${selectedCount}</span> / ${wordsArray.length}</span>
                <button onclick="scanner.saveSelected()" class="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-lg active:scale-95 transition-all">
                    ${t('common.save')}
                </button>
            </div>
            <div class="space-y-3">
        `;

        wordsArray.forEach((w, index) => {
            let grammarBadge = '';
            if (w.type === 'noun' && w.dativ) grammarBadge = `<span class="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-blue-300 shadow-inner">Dat: ${w.dativ}</span>`;
            if (w.type === 'verb' && w.rektion) grammarBadge = `<span class="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-pink-300 shadow-inner">${w.rektion}</span>`;
            if (w.gegenteil) grammarBadge += `<span class="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 ml-1 shadow-inner">≠ ${w.gegenteil}</span>`;

            const isChecked = w.selected ? 'checked' : '';
            const borderClass = w.selected ? 'border-amber-500' : 'border-slate-700';
            const opacityClass = w.selected ? 'opacity-100' : 'opacity-40';

            html += `
                <div id="scan-card-${index}" onclick="scanner.toggleWord(${index})" class="bg-slate-800 p-4 rounded-xl border-2 ${borderClass} relative overflow-hidden group fade-in transition-all cursor-pointer select-none" style="animation-delay: ${index * 30}ms">
                    
                    <div class="absolute top-4 right-4 z-10">
                        <input type="checkbox" id="scan-checkbox-${index}" ${isChecked} class="w-6 h-6 accent-amber-500 pointer-events-none rounded shadow">
                    </div>

                    <div id="scan-content-${index}" class="${opacityClass} transition-opacity duration-200">
                        <div class="flex justify-between items-start mb-2 pr-10">
                            <h3 class="text-xl font-black text-slate-100">${w.word}</h3>
                            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">${w.type}</span>
                        </div>
                        <p class="text-amber-500 font-medium mb-2 text-lg">${w.translation}</p>
                        <div class="flex flex-wrap gap-2 mb-3">${grammarBadge}</div>
                        <div class="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                            <p class="text-sm text-slate-300 italic">"${w.example_de}"</p>
                            <p class="text-xs text-slate-500 mt-1">${w.example_ru}</p>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
    },

    saveSelected: async () => {
        const toSave = scanner.currentResults.filter(w => w.selected);
        
        if (toSave.length === 0) {
            return alert(t('scanner.nothingSelected'));
        }
        
        const { count } = await dbService.saveMultipleWords(toSave);
        
        document.getElementById('scan-results').innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 fade-in text-center bg-slate-800 rounded-xl border border-slate-700">
                <div class="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6 border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                    <i class="fa-solid fa-check text-4xl"></i>
                </div>
                <h3 class="text-2xl font-bold text-slate-100 mb-2">${t('scanner.savedTitle')}</h3>
                <p class="text-slate-400 text-lg">${t('scanner.savedCount')}: <span class="text-white font-bold">${count}</span></p>
                <button onclick="app.navigate('plan')" class="mt-8 w-full max-w-xs py-4 bg-amber-500 text-slate-900 text-lg font-black rounded-xl shadow-lg active:scale-95 transition-transform">
                    ${t('scanner.goToPlan')}
                </button>
            </div>
        `;
        scanner.currentResults = [];
    }
};