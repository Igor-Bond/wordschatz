import { config } from '../config.js';
import { i18n } from '../i18n/i18n.js';
import { dbService } from './db.js';

export const aiService = {
    callGemini: async (prompt, isJson = true, imgBase64 = null) => {
        const rawKeyConfig = config.get('api_key') || "";
        // Разбиваем строку по запятым на случай, если указано несколько ключей
        const apiKeys = rawKeyConfig.split(',').map(k => k.trim()).filter(k => k);
        
        if (apiKeys.length === 0) throw new Error("API ключ не настроен.");

        let model = config.get('model');
        if (!model || model === 'gemini-1.5-flash-latest') {
            model = 'gemini-flash-latest';
        }

        const parts = [{ text: prompt }];
        if (imgBase64) {
            parts.push({ inline_data: { mime_type: "image/jpeg", data: imgBase64 } });
        }
        
        const body = { 
            contents: [{ role: "user", parts }], 
            generationConfig: { temperature: 0.7 } 
        };
        
        if (isJson) {
            body.generationConfig.responseMimeType = "application/json";
        }

        const maxRetries = 2; // 2 попытки на каждый ключ
        let delay = 1500;
        let lastError = null;

        // --- ЦИКЛ РОТАЦИИ КЛЮЧЕЙ ---
        for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
            const apiKey = apiKeys[keyIndex];
            
            for (let i = 0; i < maxRetries; i++) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify(body)
                    });
                    
                    const data = await response.json();
                    if (data.error) throw new Error(data.error.message);
                    
                    return data.candidates[0].content.parts[0].text;

                } catch (error) {
                    lastError = error;
                    const errMsg = error.message.toLowerCase();
                    const isOverloadOrQuota = errMsg.includes('high demand') || 
                                              errMsg.includes('503') || 
                                              errMsg.includes('fetch') || 
                                              errMsg.includes('quota') || 
                                              errMsg.includes('429');
                                              
                    const isKeyInvalid = errMsg.includes('api key not valid') || errMsg.includes('api_key_invalid');

                    if (isKeyInvalid) {
                        console.warn(`Ключ №${keyIndex + 1} недействителен. Переходим к следующему.`);
                        break; // Выходим из цикла попыток, берем следующий ключ
                    }

                    if (isOverloadOrQuota) {
                        if (i < maxRetries - 1) {
                            console.warn(`Ошибка квоты/перегрузки (Ключ №${keyIndex + 1}). Попытка ${i + 2}. Ждем ${delay}мс...`);
                            await new Promise(res => setTimeout(res, delay));
                            delay *= 1.5;
                            continue;
                        } else {
                            console.warn(`Исчерпаны попытки для ключа №${keyIndex + 1}. Переходим к следующему (если есть).`);
                            break; // Пробуем следующий ключ
                        }
                    }

                    // Если ошибка другого типа (например, бан по safety policy) - пробрасываем сразу
                    throw new Error(error.message.split('For more information')[0].trim());
                }
            }
        }

        // Если мы вышли из циклов, значит все ключи не сработали
        const finalErrMsg = lastError ? lastError.message.toLowerCase() : '';
        if (finalErrMsg.includes('quota') || finalErrMsg.includes('429')) {
            throw new Error("Превышен лимит запросов на всех доступных ключах. Пожалуйста, подождите около минуты.");
        }
        if (finalErrMsg.includes('api key not valid')) {
            throw new Error("Все указанные API ключи недействительны. Проверьте настройки профиля.");
        }
        
        throw new Error(lastError ? lastError.message.split('For more information')[0].trim() : "Неизвестная ошибка ИИ.");
    },

    _getJsonFormat: () => {
        return `[
            {"type":"noun", "word":"слово с артиклем (der Tisch)", "translation":"перевод", "plural":"мн.ч. (die Tische)", "dativ":"форма в Dativ (dem Tisch)", "synonym":"синоним", "gegenteil":"антоним", "example_de":"пример", "example_ru":"перевод", "topic":"категория"},
            {"type":"verb", "word":"инфинитив", "translation":"перевод", "present":"ich ..., du ..., er/sie/es ...", "preterite":"Präteritum", "participle_ii":"Partizip II", "auxiliary":"haben/sein", "rektion":"предлог + падеж", "synonym":"синоним", "gegenteil":"антоним", "example_de":"пример", "example_ru":"перевод", "topic":"категория"},
            {"type":"adjective", "word":"слово", "translation":"перевод", "comparative":"сравн.", "superlative":"превосх.", "synonym":"синоним", "gegenteil":"антоним", "example_de":"пример", "example_ru":"перевод", "topic":"категория"},
            {"type":"phrase", "word":"фраза", "translation":"перевод", "synonym":"синоним", "example_de":"пример", "example_ru":"перевод", "topic":"категория"}
        ]`;
    },

    /** Нормализация для сравнения: «der Tisch» и «Tisch» — одно и то же слово. */
    _normalizeWord: (w) => String(w || '').replace(/^(der|die|das|sich|ein|eine)\s+/i, '').trim().toLowerCase(),

    /** Одна порция слов от ИИ. Исключения передаём в промпт, чтобы не повторялся. */
    _generateBatch: async (topic, requestCount, excludeList = []) => {
        const profile = config.getProfile();
        const lang = i18n.aiLanguage();
        const rule = `ОБЯЗАТЕЛЬНО: Существительным заполняй plural и dativ. Глаголам — спряжение present (ich, du, er) и rektion. Всем словам подбирай synonym (синоним) и gegenteil (антоним), если это возможно.
        ЯЗЫК ПЕРЕВОДА: поля translation и example_ru должны быть на языке "${lang.name}", а не на русском, если указан другой язык.`;

        // Длинный список исключений раздувает промпт — берём последние 60
        const exclude = excludeList.slice(-60);
        const excludeRule = exclude.length
            ? `\nНЕ используй эти слова, они уже есть у пользователя: ${exclude.join(', ')}.`
            : '';

        const prompt = `Сгенерируй ровно ${requestCount} немецких слов уровня ${profile.level} по теме "${topic}".
        Сделай примеры предложений (example_de) интересными, опираясь на увлечения пользователя: ${profile.interests}.
        ${rule}${excludeRule}
        Верни ТОЛЬКО плоский JSON массив. Формат: \n${aiService._getJsonFormat()}`;

        const responseText = await aiService.callGemini(prompt, true);
        return aiService._parseJsonResponse(responseText, profile.level, topic);
    },

    /**
     * Набор слов по теме.
     *
     * Для больших наборов (тема на неделю — это 50–140 слов) генерируем
     * порциями: одним запросом модель либо обрывает JSON, либо начинает
     * повторяться. Дубликаты и уже известные слова отсеиваются локально.
     *
     * @param {string} topic
     * @param {number} count сколько слов нужно на выходе
     * @param {Function} onProgress вызывается как (собрано, нужно)
     */
    generateSet: async (topic, count, onProgress = null) => {
        const target = parseInt(count) || 10;
        const BATCH_SIZE = 25;          // столько модель отдаёт без потери качества
        const MAX_ATTEMPTS = Math.ceil(target / BATCH_SIZE) + 3;

        // Всё, что уже есть в словаре
        let known = new Set();
        try {
            const saved = await dbService.getAllWords();
            known = new Set(saved.map(w => aiService._normalizeWord(w.word)));
        } catch (e) {
            console.error('Не удалось прочитать словарь для фильтрации:', e);
        }

        const collected = [];
        const collectedKeys = new Set();
        let attempts = 0;
        let emptyRounds = 0;

        while (collected.length < target && attempts < MAX_ATTEMPTS && emptyRounds < 2) {
            attempts++;
            const need = target - collected.length;
            const requestCount = Math.min(BATCH_SIZE, Math.max(need + 5, 10));

            let batch;
            try {
                batch = await aiService._generateBatch(
                    topic,
                    requestCount,
                    [...collectedKeys]
                );
            } catch (e) {
                // Первая порция не удалась — сообщаем об ошибке, дальше пробовать нечего
                if (collected.length === 0) throw e;
                console.warn('Порция слов не сгенерировалась, останавливаемся:', e.message);
                break;
            }

            let addedThisRound = 0;
            for (const w of batch) {
                if (collected.length >= target) break;
                const key = aiService._normalizeWord(w.word);
                if (!key || known.has(key) || collectedKeys.has(key)) continue;

                collected.push(w);
                collectedKeys.add(key);
                addedThisRound++;
            }

            emptyRounds = addedThisRound === 0 ? emptyRounds + 1 : 0;
            if (onProgress) onProgress(collected.length, target);
        }

        return collected;
    },

    generateStory: async (wordsArray) => {
        const profile = config.getProfile();
        const wordsList = wordsArray.map(w => w.word).join(', ');
        
        const prompt = `Напиши короткий, увлекательный рассказ на немецком языке (уровень ${profile.level}), используя ОБЯЗАТЕЛЬНО следующие слова: ${wordsList}. 
        Тематика рассказа должна быть связана с: ${profile.interests}.
        Верни JSON в формате: {"story_de": "текст рассказа", "story_ru": "литературный перевод на язык ${i18n.aiLanguage().name}"}`;
        
        const responseText = await aiService.callGemini(prompt, true);
        return JSON.parse(responseText);
    },

    _parseJsonResponse: (rawText, defaultLevel, defaultTopic) => {
        let cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        let parsed = JSON.parse(cleanJson);
        
        if (parsed && !Array.isArray(parsed)) {
            for (let key in parsed) { if (Array.isArray(parsed[key])) { parsed = parsed[key]; break; } }
            if (!Array.isArray(parsed)) parsed = [parsed];
        }

        return parsed.map(w => ({
            ...w,
            level: w.level || defaultLevel,
            topic: w.topic || defaultTopic,
            type: w.type || 'phrase'
        }));
    }
};