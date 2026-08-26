import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { speech } from '../core/speech.js';
import { masteryUtils } from '../core/mastery.js';
import { quiz } from '../core/quiz.js';
import { germanUtils } from '../core/german.js';
import { dbService } from '../services/db.js';
import { i18n, t } from '../i18n/i18n.js';
import { aiService } from '../services/ai.js';
import { exercises } from './exercises.js';

export const room = {

    /**
     * Тема, по которой тренируемся. Пусто — все темы сразу.
     *
     * Комната брала весь пройденный словарь целиком, и вернуться к одной
     * теме было нельзя: слова из «Электроники» перемешивались с «Едой»,
     * а повторить перед экзаменом нужную тему — обычное желание.
     */
    topic: '',

    render: async () => {
        document.body.classList.remove('lesson-mode');
        const main = document.getElementById('main-content');
        
        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-10">
                <h2 class="text-2xl font-bold text-slate-100 mb-6 text-center">${t('room.title')}</h2>
                
                ${await room.renderTopicPicker()}

                <h3 class="text-sm font-bold text-amber-500 mb-4 px-1 uppercase tracking-wider flex justify-between items-center">
                    ${t('room.microTrainers')}
                    <label class="flex items-center gap-2 cursor-pointer">
                        <span class="text-xs text-slate-400">${t('room.onlyHard')}</span>
                        <input type="checkbox" id="room-hard-mode" class="accent-amber-500 w-4 h-4">
                    </label>
                </h3>
                
                <div class="grid grid-cols-2 auto-rows-fr gap-3 mb-8">
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
                    <!--
                        Сборка слова из букв. В уроке она появилась потому,
                        что новому слову без рода и примера доступны всего
                        три задания; здесь — потому, что это единственный
                        тренажёр написания, который не требует ничего, кроме
                        самого слова: удвоенные согласные, умляуты, ß.
                    -->
                    <button onclick="room.startExerciseMode(['word_builder'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-green-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-shapes text-green-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeWordBuilder')}</span>
                    </button>
                    <button onclick="room.startExerciseMode(['rektion'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-green-500 transition-colors flex flex-col items-center gap-2 active:scale-95">
                        <i class="fa-solid fa-link text-green-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeRektion')}</span>
                    </button>
                    <!--
                        Аудирование тоже во всю ширину. Плиток в один
                        столбец стало одиннадцать — нечётно, и последняя
                        оставалась в строке одна, с дырой рядом. Двух
                        широких внизу хватает, чтобы сетка сошлась.
                    -->
                    <button onclick="room.startExerciseMode(['listening'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-teal-500 transition-colors flex flex-row items-center justify-center gap-3 col-span-2 active:scale-95">
                        <i class="fa-solid fa-headphones text-teal-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeListening')}</span>
                    </button>
                    <!--
                        Одиннадцатая плитка занимает обе колонки: нечётное
                        число оставляет дыру рядом с последней. Значок
                        стоит слева от подписи — в широкой плитке над
                        коротким текстом он смотрелся одиноко. Высоту
                        держит auto-rows-fr на сетке, а не подобранное
                        число: строка равняется по соседям сама
                    -->
                    <button onclick="room.startExerciseMode(['adjective_ending'])" class="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-teal-500 transition-colors flex flex-row items-center justify-center gap-3 col-span-2 active:scale-95">
                        <i class="fa-solid fa-table-cells text-teal-500 text-2xl"></i>
                        <span class="text-xs font-bold text-slate-300 text-center">${t('room.modeDeclension')}</span>
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

    /**
     * Выбор темы над тренажёрами.
     *
     * Список — только из пройденных слов: предлагать темы, к которым ещё
     * не приступали, значит обещать тренировку, которой не будет. Рядом
     * с названием стоит, сколько слов доступно.
     *
     * Одна строка, а не облако кнопок. Плашки занимали столько строк,
     * сколько тем накопилось, и высота блока росла вместе со словарём:
     * при одиннадцати темах на телефоне это 180 точек против 42, и
     * тренажёры, ради которых сюда заходят, уезжали за нижний край.
     *
     * И не `select`. Он был первой попыткой и решал ту же задачу, но
     * раскрытый список рисует система: на Android он светлый, на iPhone
     * это вовсе колесо снизу экрана. Ни то ни другое к тёмной теме
     * приложения отношения не имеет, и стилями это не лечится — раскрытую
     * часть `select` браузер не отдаёт.
     *
     * Поэтому строка открывает обычный диалог приложения — тот же, что у
     * лиг и подтверждений. Он наш от рамки до кнопок и одинаков везде.
     */
    renderTopicPicker: async () => {
        const studied = await dbService.getStudiedWords();
        if (studied.length === 0) return '';

        const counts = room._topicCounts(studied);

        // Одна тема на весь словарь — выбирать не из чего
        if (counts.size < 2) return '';

        // Выбранной темы могло не остаться после удаления слов
        if (room.topic && !counts.has(room.topic)) room.topic = '';

        const выбрано = room.topic || t('room.allTopics');
        const сколько = room.topic ? counts.get(room.topic) : studied.length;

        return `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg mb-6">
                <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">${t('room.topicLabel')}</div>
                <button onclick="room.openTopicPicker()"
                    class="w-full flex items-center justify-between gap-3 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-left hover:border-amber-500 active:scale-[0.99] transition-all">
                    <span class="text-sm font-bold text-slate-100 truncate">${actions.attr(выбрано)}</span>
                    <span class="shrink-0 flex items-center gap-2">
                        <span class="text-xs font-bold text-amber-500">${сколько}</span>
                        <i class="fa-solid fa-chevron-down text-slate-500 text-[10px]"></i>
                    </span>
                </button>
            </div>`;
    },

    /** Сколько пройденных слов в каждой теме. */
    _topicCounts: (studied) => {
        const counts = new Map();
        for (const w of studied) {
            const topic = String(w.topic ?? '').trim();
            if (topic) counts.set(topic, (counts.get(topic) || 0) + 1);
        }
        return counts;
    },

    openTopicPicker: async () => {
        const studied = await dbService.getStudiedWords();
        const counts = room._topicCounts(studied);

        const темы = [...counts.entries()].sort((a, b) => b[1] - a[1]);

        // Значение выбранной темы — пустая строка, а её dialog.choose
        // вернуть не может: пустая строка неотличима от отмены. Поэтому
        // «все темы» ходят под своим ключом
        const ВСЕ = ' все';

        const выбор = await dialog.choose('', [
            { value: ВСЕ, label: `${t('room.allTopics')} · ${studied.length}`, primary: !room.topic },
            ...темы.map(([topic, count]) => ({
                value: topic,
                label: `${topic} · ${count}`,
                primary: room.topic === topic
            }))
        ], { title: t('room.topicLabel') });

        if (выбор === null) return;          // отмена — ничего не меняем

        room.topic = выбор === ВСЕ ? '' : выбор;
        await room.render();
    },

    /** Пройденные слова выбранной темы. */
    _pool: async () => {
        const studied = await dbService.getStudiedWords();
        if (!room.topic) return studied;
        return studied.filter(w => String(w.topic ?? '').trim() === room.topic);
    },

    startExerciseMode: async (allowedModes) => {
        // Комната — это закрепление, а не первое знакомство. Слова, которые
        // ещё ни разу не показали карточкой, спрашивать нельзя: раньше сюда
        // попадал весь словарь, включая заготовленные на будущие дни слова.
        let allWords = await room._pool();

        if (allWords.length === 0) {
            await dialog.alert(t('room.nothingStudied'));
            return;
        }

        // Аудирование без немецкого голоса — это просьба записать тишину
        if (allowedModes.includes('listening') && !(await speech.isAvailable())) {
            await dialog.alert(t('speech.noVoiceHint'), { title: t('speech.noVoiceTitle') });
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

            // Сборке слова хватает самого слова — лишь бы букв было больше
            // двух: складывать «Ei» нечего
            if (allowedModes.includes('word_builder')
                && germanUtils.stripArticle(w).replace(/\s/g, '').length > 2) isValid = true;

            if (allowedModes.includes('rektion') && w.type === 'verb' && w.rektion) isValid = true;
            if (allowedModes.includes('adjective_ending') && w.type === 'adjective') isValid = true;
            
            return isValid;
        });

        // Порог в четыре слова остался с тех пор, когда неверные варианты
        // брались из этого же списка. Сейчас каждое задание добывает их само:
        // перевод и пары — из всего словаря, склонение и формы глагола — из
        // собственной таблицы слова. Одного подходящего слова достаточно,
        // и одинокое прилагательное больше не отказывается тренироваться
        if (compatibleWords.length < 1) {
            // При выбранной теме общая фраза «нужно хотя бы 4 слова» неверна:
            // порог там другой, и дело не в количестве, а в самой теме
            let errorMsg = room.topic ? '' : t('room.notEnough') + '\n\n';

            if (room.topic) errorMsg += t('room.notEnoughInTopic', { topic: room.topic });
            else if (studiedCount < 4) errorMsg += t('room.notEnoughStudied');
            else if (isHardMode) errorMsg += t('room.notEnoughHard');
            else if (allowedModes.includes('article')) errorMsg += t('room.notEnoughNouns');
            else if (allowedModes.includes('verb_form')) errorMsg += t('room.notEnoughVerbs');
            else if (allowedModes.includes('rektion')) errorMsg += t('room.notEnoughRektion');
            else if (allowedModes.includes('adjective_ending')) errorMsg += t('room.notEnoughAdjectives');
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
        const studied = await room._pool();
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
                return `<span data-action="room.translateWord" data-word="${actions.attr(cleanWord)}" class="cursor-pointer hover:bg-amber-500/20 hover:text-amber-400 rounded px-1 transition-colors">${token}</span>`;
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

    translateWord: async (el) => {
        const cleanWord = el.dataset.word ?? '';
        if (cleanWord.length < 2) return;
        
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
                    addBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${t('room.adding')}`;

                    // Быстрый перевод годится для подсказки, но не для словаря:
                    // карточка без грамматики и с выдуманным примером
                    // «Er hat X verwendet» ломала половину упражнений
                    let card = null;
                    try {
                        card = await aiService.describeWord(cleanWord, t('room.storyHeader'));
                    } catch (e) {
                        console.error('[Комната] Не удалось разобрать слово:', e);
                    }

                    await dbService.addWord({
                        ...(card || {
                            word: wordData.word,
                            translation: wordData.translation,
                            type: wordData.type || 'phrase'
                        }),
                        topic: t('room.storyHeader')
                    });

                    addBtn.innerText = t('room.added');
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