import { config } from '../config.js';
import { i18n, t } from '../i18n/i18n.js';
import { aiService } from '../services/ai.js';

export const chat = {
    history: [],

    render: () => {
        const main = document.getElementById('main-content');
        
        main.innerHTML = `
            <div class="fade-in flex flex-col h-full max-w-lg mx-auto">
                <!-- Заголовок чата -->
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg flex items-center justify-between z-10 shrink-0 mt-2 mx-2">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-slate-900 border-2 border-slate-900 shadow-inner">
                            <i class="fa-solid fa-robot text-xl"></i>
                        </div>
                        <div>
                            <h2 class="font-bold text-slate-100 leading-tight">${t('chat.title')}</h2>
                            <p class="text-[10px] text-green-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <span class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> ${t('chat.online')}
                            </p>
                        </div>
                    </div>
                    <button onclick="chat.clearHistory()" class="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-900/50 transition-colors flex items-center justify-center">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>

                <!-- Окно сообщений -->
                <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-5 hide-scrollbar flex flex-col pb-4">
                    <!-- Сообщения будут добавляться сюда -->
                </div>

                <!-- Поле ввода -->
                <div class="p-2 shrink-0 mb-4 mx-2">
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-2 flex items-end gap-2 shadow-xl focus-within:border-amber-500 transition-colors">
                        <textarea id="chat-input" rows="1" class="flex-1 bg-transparent text-slate-100 px-3 py-2 outline-none resize-none hide-scrollbar placeholder-slate-500 min-h-[44px] max-h-32" placeholder="Schreibe eine Nachricht..." oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"></textarea>
                        <button onclick="chat.sendMessage()" id="chat-send-btn" class="w-11 h-11 rounded-xl bg-amber-500 text-slate-900 flex items-center justify-center hover:bg-amber-400 transition-transform active:scale-95 shrink-0 shadow">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const profile = config.getProfile();
        
        // Если история пуста, выводим приветствие
        if (chat.history.length === 0) {
            chat.history.push({ 
                role: 'ai', 
                text: t('chat.greeting', { name: profile.name })
            });
        }
        
        // Отрисовываем историю
        chat.history.forEach(msg => chat.renderMessage(msg.role, msg.text));
        
        // Обработка клавиши Enter (без Shift)
        document.getElementById('chat-input').addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chat.sendMessage();
            }
        });
    },

    renderMessage: (role, text) => {
        const container = document.getElementById('chat-messages');
        const isAI = role === 'ai';
        
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex w-full ${isAI ? 'justify-start' : 'justify-end'} fade-in`;
        
        // Кнопка озвучки только для ИИ
        const audioBtn = isAI 
            ? `<button onclick="chat.playAudio(this, '${text.replace(/'/g, "\\'")}')" class="mt-2 text-slate-500 hover:text-amber-500 transition-colors text-xs flex items-center gap-1"><i class="fa-solid fa-volume-high"></i> ${t('chat.speak')}</button>`
            : '';

        msgDiv.innerHTML = `
            <div class="max-w-[85%] ${isAI ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl rounded-tl-sm' : 'bg-amber-500 text-slate-900 rounded-2xl rounded-tr-sm shadow-md'} p-4">
                <p class="text-sm leading-relaxed whitespace-pre-wrap ${isAI ? '' : 'font-medium'}">${text}</p>
                ${audioBtn}
            </div>
        `;
        
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    },

    showTypingIndicator: () => {
        const container = document.getElementById('chat-messages');
        const id = 'typing-' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.id = id;
        msgDiv.className = `flex w-full justify-start fade-in`;
        msgDiv.innerHTML = `
            <div class="max-w-[85%] bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                <span class="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
                <span class="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
                <span class="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
            </div>
        `;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
        return id;
    },

    sendMessage: async () => {
        const inputEl = document.getElementById('chat-input');
        const text = inputEl.value.trim();
        const btn = document.getElementById('chat-send-btn');
        
        if (!text) return;
        
        // Блокируем ввод
        inputEl.value = '';
        inputEl.style.height = '44px';
        inputEl.disabled = true;
        btn.disabled = true;
        
        // Отрисовываем сообщение юзера
        chat.history.push({ role: 'user', text: text });
        chat.renderMessage('user', text);
        
        const typingId = chat.showTypingIndicator();
        
        try {
            const profile = config.getProfile();
            
            // Формируем историю для контекста ИИ
            const conversationHistory = chat.history.map(msg => 
                `${msg.role === 'ai' ? t('chat.roleTutor') : t('chat.roleStudent')}: ${msg.text}`
            ).join('\n');
            
            const prompt = `Ты — дружелюбный и поддерживающий ИИ-репетитор немецкого языка. 
            Твой студент (имя: ${profile.name}, уровень: ${profile.level}).
            Твоя задача — вести естественный диалог на немецком языке.
            
            ПРАВИЛА:
            1. Отвечай преимущественно на немецком языке (соответствующем уровню ${profile.level}).
            2. Если студент сделал грамматическую ошибку в последнем сообщении, мягко укажи на нее (можно кратко пояснить на языке ${i18n.aiLanguage().name}) и напиши правильный вариант, прежде чем продолжить беседу.
            3. Если студент задает вопрос на языке ${i18n.aiLanguage().name}, можешь ответить на нём, но обязательно приведи примеры на немецком.
            4. Поддерживай беседу, задавая короткие вопросы в конце ответа.
            5. Не пиши слишком длинные тексты (максимум 3-4 предложения).
            
            История диалога:
            ${conversationHistory}
            
            Напиши свой следующий ответ (только текст ответа, без указания роли):`;

            // Вызываем ИИ
            const responseText = await aiService.callGemini(prompt, false);
            
            document.getElementById(typingId).remove();
            
            chat.history.push({ role: 'ai', text: responseText.trim() });
            chat.renderMessage('ai', responseText.trim());
            
        } catch (error) {
            document.getElementById(typingId).remove();
            chat.renderMessage('ai', t('chat.networkError') + ' (' + error.message + ')');
            chat.history.pop(); 
        } finally {
            inputEl.disabled = false;
            btn.disabled = false;
            inputEl.focus();
        }
    },

    clearHistory: () => {
        if (confirm(t('chat.clearConfirm'))) {
            chat.history = [];
            chat.render();
        }
    },

    playAudio: (btn, text) => {
        // Очищаем текст от русского языка, оставляя только немецкий
        const germanText = text.replace(/[А-Яа-яЁёІіЇїЄєҐґ]/g, '').trim();
        
        if (!germanText) return;
        
        // 1. Принудительно сбрасываем очередь (помогает от зависаний)
        window.speechSynthesis.cancel();
        
        const icon = btn.querySelector('i');
        icon.className = 'fa-solid fa-spinner fa-spin text-amber-500';
        
        const utterance = new SpeechSynthesisUtterance(germanText);
        utterance.lang = 'de-DE';
        
        // 2. Сохраняем в глобальную область видимости, чтобы сборщик мусора не удалил объект
        window.currentSpeechUtterance = utterance;
        
        utterance.onend = () => {
            icon.className = 'fa-solid fa-volume-high';
        };
        
        utterance.onerror = () => {
            icon.className = 'fa-solid fa-volume-high';
        };

        // 3. Запускаем озвучку
        window.speechSynthesis.speak(utterance);
    }
};