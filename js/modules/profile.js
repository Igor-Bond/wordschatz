const profile = {
    render: async () => {
        const main = document.getElementById('main-content');
        
        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-10">
                <div class="flex justify-between items-center mb-6 px-1">
                    <h2 class="text-2xl font-bold text-slate-100">Профиль и Данные</h2>
                    <button onclick="document.getElementById('settings-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('settings-modal').classList.remove('opacity-0'), 10);" class="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                </div>
                
                <div class="flex bg-slate-800 rounded-xl p-1 mb-6 border border-slate-700">
                    <button onclick="profile.switchTab('stats')" id="tab-prof-stats" class="flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all">Статистика</button>
                    <button onclick="profile.switchTab('dict')" id="tab-prof-dict" class="flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all">Мой словарь</button>
                </div>

                <div id="prof-mode-stats" class="space-y-4 fade-in">
                    <div class="flex justify-center items-center py-10"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div></div>
                </div>
                <div id="prof-mode-dict" class="space-y-4 hidden fade-in"></div>
            </div>

            <!-- Модальное окно редактирования слова -->
            <div id="edit-word-modal" class="hidden fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 transition-opacity duration-200">
                <div class="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] scale-95 transition-transform duration-200" id="edit-modal-content">
                    <div class="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                        <h3 class="text-lg font-bold text-slate-100">Карточка слова</h3>
                        <button onclick="profile.closeEditModal()" class="text-slate-400 hover:text-white transition-colors"><i class="fa-solid fa-xmark text-xl"></i></button>
                    </div>
                    
                    <div class="p-4 overflow-y-auto space-y-4 flex-1 hide-scrollbar">
                        <input type="hidden" id="edit-id">
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-1">Слово на немецком</label>
                            <input type="text" id="edit-word" class="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-bold text-lg transition-colors">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-1">Перевод</label>
                            <input type="text" id="edit-translation" class="w-full bg-slate-900 border border-slate-600 text-amber-500 font-bold rounded-lg px-3 py-2 outline-none focus:border-amber-500 transition-colors">
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 mb-1">Dativ / Rektion / Komp.</label>
                                <input type="text" id="edit-grammar1" class="w-full bg-slate-900 border border-slate-600 text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm transition-colors">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 mb-1">Plural / Präteritum</label>
                                <input type="text" id="edit-grammar2" class="w-full bg-slate-900 border border-slate-600 text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm transition-colors">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-1">Пример на немецком</label>
                            <textarea id="edit-example-de" class="w-full bg-slate-900 border border-slate-600 text-slate-200 italic rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm h-20 transition-colors"></textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-1">Перевод примера</label>
                            <textarea id="edit-example-ru" class="w-full bg-slate-900 border border-slate-600 text-slate-400 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm h-20 transition-colors"></textarea>
                        </div>
                    </div>
                    
                    <div class="p-4 border-t border-slate-700 bg-slate-900/50">
                        <button onclick="profile.saveWordEdit()" class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl shadow transition-transform active:scale-95">СОХРАНИТЬ</button>
                    </div>
                </div>
            </div>
        `;

        await profile.renderStats();
        await profile.renderDictionary();
    },

    switchTab: (tab) => {
        const tStats = document.getElementById('tab-prof-stats');
        const tDict = document.getElementById('tab-prof-dict');
        const mStats = document.getElementById('prof-mode-stats');
        const mDict = document.getElementById('prof-mode-dict');

        if (tab === 'stats') {
            tStats.className = "flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all";
            tDict.className = "flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all border border-transparent";
            mStats.classList.remove('hidden');
            mDict.classList.add('hidden');
        } else {
            tDict.className = "flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all";
            tStats.className = "flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all border border-transparent";
            mDict.classList.remove('hidden');
            mStats.classList.add('hidden');
        }
    },

    renderStats: async () => {
        const container = document.getElementById('prof-mode-stats');
        
        try {
            // Безопасное получение данных
            const user = (await db.user.get(1)) || {};
            const totalXP = user.totalXP || 0;
            const currentStreak = user.currentStreak || 0;
            
            let userProfile = { name: 'Студент' };
            if (typeof config !== 'undefined' && config.getProfile) {
                userProfile = config.getProfile() || userProfile;
            }

            // Статистика словаря
            const allWords = await db.words.toArray();
            const totalWords = allWords.length;
            const masteredCount = allWords.filter(w => w.mastery === 100).length;
            const difficultCount = allWords.filter(w => w.isDifficult === 1).length;

            // Сбор ошибок из Журнала
            let mistakes = [];
            if (db.mistakes) {
                mistakes = await db.mistakes.toArray();
            }
            
            const mistakeCounts = {};
            mistakes.forEach(m => {
                if (m && m.wordId) {
                    mistakeCounts[m.wordId] = (mistakeCounts[m.wordId] || 0) + 1;
                }
            });
            
            const topMistakeIds = Object.keys(mistakeCounts)
                .sort((a, b) => mistakeCounts[b] - mistakeCounts[a])
                .slice(0, 5)
                .map(Number);
            
            const topMistakeWords = await Promise.all(topMistakeIds.map(id => db.words.get(id)));

            // Расчет Лиг
            const leagues = [
                { name: 'Деревянная', min: 0, max: 100, color: 'text-amber-700', bg: 'bg-amber-900/30' },
                { name: 'Каменная', min: 100, max: 300, color: 'text-slate-400', bg: 'bg-slate-500/30' },
                { name: 'Бронзовая', min: 300, max: 1000, color: 'text-orange-500', bg: 'bg-orange-500/30' },
                { name: 'Серебряная', min: 1000, max: 2500, color: 'text-gray-300', bg: 'bg-gray-400/30' },
                { name: 'Золотая', min: 2500, max: 5000, color: 'text-yellow-400', bg: 'bg-yellow-500/30' },
                { name: 'Алмазная', min: 5000, max: Infinity, color: 'text-cyan-400', bg: 'bg-cyan-500/30' }
            ];

            let currentLeague = leagues[0];
            let nextLeague = leagues[1];
            
            for (let i = 0; i < leagues.length; i++) {
                if (totalXP >= leagues[i].min) {
                    currentLeague = leagues[i];
                    nextLeague = leagues[i + 1] || leagues[i];
                }
            }

            let progressPct = 100;
            let xpText = `${totalXP} XP (Макс.)`;
            
            if (currentLeague.name !== 'Алмазная') {
                const range = nextLeague.min - currentLeague.min;
                const earnedInLeague = totalXP - currentLeague.min;
                progressPct = Math.round((earnedInLeague / range) * 100);
                xpText = `${totalXP} / ${nextLeague.min} XP`;
            }

            // Генерация списка ошибок
            let mistakesHtml = '';
            const validMistakeWords = topMistakeWords.filter(w => w !== undefined);
            
            if (validMistakeWords.length > 0) {
                mistakesHtml = validMistakeWords.map(w => {
                    const count = mistakeCounts[w.id];
                    return `
                        <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 mb-2">
                            <div>
                                <div class="font-bold text-slate-200">${w.word}</div>
                                <div class="text-xs text-slate-400">${w.translation}</div>
                            </div>
                            <div class="text-red-400 text-xs bg-red-400/10 px-2 py-1 rounded font-bold border border-red-500/20">
                                ${count} ошиб.
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                mistakesHtml = `
                    <div class="text-center py-6 text-slate-500 flex flex-col items-center">
                        <i class="fa-solid fa-check-circle text-3xl mb-2 opacity-50"></i>
                        <p class="text-sm">Ошибок пока нет. Отличная работа!</p>
                    </div>`;
            }

            container.innerHTML = `
                <!-- Блок Лиги и XP -->
                <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold text-slate-100">Текущая лига</h3>
                        <span class="text-xs font-bold px-2.5 py-1 rounded-md ${currentLeague.bg} ${currentLeague.color} border border-current">
                            <i class="fa-solid fa-trophy mr-1"></i> ${currentLeague.name}
                        </span>
                    </div>
                    
                    <div class="w-full bg-slate-900 rounded-full h-3 mb-2 border border-slate-700 overflow-hidden">
                        <div class="bg-amber-500 h-full rounded-full transition-all duration-1000 relative" style="width: ${progressPct}%">
                            <div class="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                    <div class="flex justify-between text-xs font-bold text-slate-500">
                        <span>${currentLeague.name}</span>
                        <span class="text-amber-500 tracking-wide">${xpText}</span>
                        <span>${nextLeague.name !== currentLeague.name ? nextLeague.name : 'Максимум'}</span>
                    </div>
                </div>

                <!-- Аналитика словаря -->
                <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">Статистика словаря</h3>
                <div class="grid grid-cols-3 gap-3">
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center flex flex-col justify-center shadow-md">
                        <div class="text-2xl font-black text-slate-100">${totalWords}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-1 font-bold">Всего слов</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center flex flex-col justify-center shadow-md border-b-2 border-b-green-500/50">
                        <div class="text-2xl font-black text-green-400">${masteredCount}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-1 font-bold">Выучено (100%)</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center flex flex-col justify-center relative overflow-hidden shadow-md border-b-2 border-b-red-500/50">
                        <div class="text-2xl font-black text-red-400">${difficultCount}</div>
                        <div class="text-[10px] text-slate-500 uppercase mt-1 font-bold">Сложные</div>
                    </div>
                </div>

                <!-- Топ слабых мест -->
                <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider px-1 mt-2">Слабые места (Топ 5)</h3>
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
                    ${mistakesHtml}
                </div>
            `;
        } catch (error) {
            console.error("Ошибка при рендере статистики профиля:", error);
            container.innerHTML = `
                <div class="p-6 text-center text-red-400 bg-slate-800 rounded-xl border border-red-900/50">
                    <i class="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
                    <h3 class="font-bold mb-2 text-lg">Ошибка загрузки статистики</h3>
                    <p class="text-sm text-slate-500">${error.message}</p>
                </div>
            `;
        }
    },

    renderDictionary: async () => {
        const container = document.getElementById('prof-mode-dict');
        const allWords = await db.words.orderBy('createdAt').reverse().toArray();

        let html = `
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg mb-4 flex justify-between gap-2">
                <button onclick="profile.exportData()" class="flex-1 py-3 bg-slate-900 border border-slate-600 text-slate-300 text-sm font-bold rounded-xl hover:text-amber-500 hover:border-amber-500 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <i class="fa-solid fa-download"></i> ЭКСПОРТ
                </button>
                
                <input type="file" id="import-file" accept=".json" class="hidden" onchange="profile.importData(event)">
                <button onclick="document.getElementById('import-file').click()" class="flex-1 py-3 bg-slate-900 border border-slate-600 text-slate-300 text-sm font-bold rounded-xl hover:text-green-500 hover:border-green-500 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <i class="fa-solid fa-upload"></i> ИМПОРТ
                </button>
            </div>
            
            <div class="space-y-3">
        `;

        if (allWords.length === 0) {
            html += `<p class="text-center text-slate-500 py-6">Ваш словарь пока пуст.</p>`;
        } else {
            allWords.forEach(w => {
                const safeWordStr = (w.word || '').replace(/'/g, "\\'"); 
                html += `
                    <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center group relative overflow-hidden">
                        <div class="absolute left-0 top-0 bottom-0 w-1 ${w.mastery === 100 ? 'bg-green-500' : (w.isDifficult ? 'bg-red-500' : 'bg-slate-600')}"></div>
                        
                        <div class="pl-2 flex-1 mr-4 cursor-pointer" onclick="profile.openEditModal(${w.id})">
                            <h4 class="text-lg font-bold text-slate-100">${w.word}</h4>
                            <p class="text-sm text-amber-500 truncate">${w.translation}</p>
                            <div class="flex items-center gap-2 mt-1">
                                <p class="text-[10px] text-slate-500 uppercase">Освоение: ${w.mastery || 0}%</p>
                                ${w.isDifficult ? '<span class="text-[10px] bg-red-900/30 text-red-500 px-1.5 rounded uppercase font-bold border border-red-500/20">Сложное</span>' : ''}
                            </div>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="profile.openEditModal(${w.id})" class="w-10 h-10 bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center border border-transparent hover:border-slate-500 transition-colors active:scale-95">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="profile.deleteWord(${w.id}, '${safeWordStr}')" class="w-10 h-10 bg-red-900/20 text-red-500 rounded-lg flex items-center justify-center border border-transparent hover:border-red-900 transition-colors active:scale-95">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        container.innerHTML = html;
    },

    openEditModal: async (id) => {
        const word = await db.words.get(id);
        if (!word) return;

        document.getElementById('edit-id').value = word.id;
        document.getElementById('edit-word').value = word.word || '';
        document.getElementById('edit-translation').value = word.translation || '';
        document.getElementById('edit-example-de').value = word.example_de || '';
        document.getElementById('edit-example-ru').value = word.example_ru || '';

        document.getElementById('edit-grammar1').value = word.dativ || word.rektion || word.comparative || '';
        document.getElementById('edit-grammar2').value = word.plural || word.preterite || word.superlative || '';

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

        const word = await db.words.get(id);
        if (!word) return;

        word.word = document.getElementById('edit-word').value.trim();
        word.translation = document.getElementById('edit-translation').value.trim();
        word.example_de = document.getElementById('edit-example-de').value.trim();
        word.example_ru = document.getElementById('edit-example-ru').value.trim();
        
        const grammar1 = document.getElementById('edit-grammar1').value.trim();
        const grammar2 = document.getElementById('edit-grammar2').value.trim();
        
        if (word.type === 'noun') {
            word.dativ = grammar1;
            word.plural = grammar2;
        } else if (word.type === 'verb') {
            word.rektion = grammar1;
            word.preterite = grammar2;
        } else if (word.type === 'adjective') {
            word.comparative = grammar1;
            word.superlative = grammar2;
        }

        await db.words.put(word);
        profile.closeEditModal();
        profile.renderDictionary(); 
    },

    deleteWord: async (id, wordStr) => {
        if (confirm(`Удалить слово "${wordStr}" из словаря?`)) {
            await db.words.delete(id);
            profile.renderDictionary();
            profile.renderStats();
        }
    },

    exportData: async () => {
        const allWords = await db.words.toArray();
        if (allWords.length === 0) return alert('Словарь пуст, нечего экспортировать!');

        const cleanData = allWords.map(w => {
            const { id, interval, ease, repetitions, isDifficult, nextReview, createdAt, ...rest } = w;
            return rest;
        });

        const dataStr = JSON.stringify(cleanData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `wortschatz_backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importData: (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) throw new Error("Неверный формат JSON");
                
                const count = await dbService.saveMultipleWords(data);
                alert(`Успешно импортировано ${count} новых слов!`);
                
                profile.renderDictionary();
                profile.renderStats();
            } catch (err) {
                alert('Ошибка чтения файла. Убедитесь, что это валидный JSON от WortSchatz.');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
};