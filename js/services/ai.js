const aiService = {
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

    generateSet: async (topic, count) => {
        const profile = config.getProfile();
        const rule = `ОБЯЗАТЕЛЬНО: Существительным заполняй plural и dativ. Глаголам — спряжение present (ich, du, er) и rektion. Всем словам подбирай synonym (синоним) и gegenteil (антоним), если это возможно.`;
        
        // 1. УМНАЯ ГЕНЕРАЦИЯ: Запрашиваем с запасом (в 2 раза больше, чем нужно)
        const requestCount = Math.max(count * 2, 20); 

        const prompt = `Сгенерируй ровно ${requestCount} немецких слов уровня ${profile.level} по теме "${topic}". 
        Сделай примеры предложений (example_de) интересными, опираясь на увлечения пользователя: ${profile.interests}.
        ${rule}
        Верни ТОЛЬКО плоский JSON массив. Формат: \n${aiService._getJsonFormat()}`;
        
        const responseText = await aiService.callGemini(prompt, true);
        const parsedWords = aiService._parseJsonResponse(responseText, profile.level, topic);
        
        // 2. ЛОКАЛЬНАЯ ФИЛЬТРАЦИЯ
        try {
            // Загружаем все слова из базы пользователя
            const allSavedWords = await db.words.toArray();
            
            // Нормализуем для точного сравнения (убираем артикли, приводим к нижнему регистру)
            const cleanWord = (w) => w.replace(/^(der|die|das|sich|ein|eine)\s+/i, '').trim().toLowerCase();
            const savedWordsSet = new Set(allSavedWords.map(w => cleanWord(w.word)));
            
            // Фильтруем сгенерированный массив, оставляя только новые слова
            const uniqueNewWords = parsedWords.filter(w => !savedWordsSet.has(cleanWord(w.word)));
            
            // Возвращаем строго запрошенное пользователем количество слов
            return uniqueNewWords.slice(0, count);
        } catch(e) {
            console.error("Ошибка при локальной фильтрации слов:", e);
            return parsedWords.slice(0, count); // Если фильтрация сломалась, отдаем как есть
        }
    },

    generateStory: async (wordsArray) => {
        const profile = config.getProfile();
        const wordsList = wordsArray.map(w => w.word).join(', ');
        
        const prompt = `Напиши короткий, увлекательный рассказ на немецком языке (уровень ${profile.level}), используя ОБЯЗАТЕЛЬНО следующие слова: ${wordsList}. 
        Тематика рассказа должна быть связана с: ${profile.interests}.
        Верни JSON в формате: {"story_de": "текст рассказа", "story_ru": "литературный перевод"}`;
        
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