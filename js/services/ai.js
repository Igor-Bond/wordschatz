import { config } from '../config.js';
import { i18n, t } from '../i18n/i18n.js';
import { dbService } from './db.js';

/**
 * Ошибка ИИ с типом — чтобы вызывающий код мог отличить исчерпанную квоту
 * от битого ответа, а не разбирать текст сообщения регулярками.
 */
export class AiError extends Error {
    constructor(kind, messageKey, details = '') {
        super(t(messageKey) + (details ? ` (${details})` : ''));
        this.name = 'AiError';
        this.kind = kind;          // quota | invalidKey | blocked | empty | network | unknown
        this.messageKey = messageKey;
        this.details = details;
    }
}

export const aiService = {

    /** Настройки генерации в одном месте — их приходится подбирать под бесплатную квоту. */
    LIMITS: {
        /**
         * Слов за один запрос.
         * Было 25 — на таком объёме модель упиралась в лимит вывода и обрывала
         * JSON на середине, а JSON.parse валил всю генерацию темы.
         */
        BATCH_SIZE: 12,

        /** Явный потолок вывода: без него использовался умолчательный и ответ резался молча. */
        MAX_OUTPUT_TOKENS: 8192,

        /** Пауза между порциями, чтобы не упереться в лимит запросов в минуту. */
        BATCH_PAUSE_MS: 1200,

        /** Попыток на каждый ключ (только для сетевых сбоев). */
        RETRIES_PER_KEY: 2,

        /** Сколько ключ «отдыхает» после исчерпания квоты. */
        KEY_COOLDOWN_MS: 60_000
    },

    /** Разбор ответа Gemini с проверкой всех мест, где он может оказаться пустым. */
    _extractText: (data) => {
        // Запрос целиком отклонён фильтрами
        const blockReason = data.promptFeedback?.blockReason;
        if (blockReason) throw new AiError('blocked', 'ai.blocked', blockReason);

        const candidate = data.candidates?.[0];
        if (!candidate) throw new AiError('empty', 'ai.emptyResponse');

        const finishReason = candidate.finishReason;
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
            throw new AiError('blocked', 'ai.blocked', finishReason);
        }

        // parts может содержать несколько фрагментов — склеиваем
        const text = (candidate.content?.parts || [])
            .map(p => p.text)
            .filter(Boolean)
            .join('');

        if (!text) throw new AiError('empty', 'ai.emptyResponse', finishReason || '');

        // Ответ обрезан по лимиту токенов: текст есть, но JSON неполный.
        // Не бросаем ошибку — парсер вытащит из него целые объекты.
        if (finishReason === 'MAX_TOKENS') {
            console.warn('[ИИ] Ответ обрезан по лимиту токенов, спасаем что есть.');
        }

        return text;
    },

    /**
     * Запрос к Gemini с ротацией ключей и повторами.
     *
     * @param {string} prompt
     * @param {boolean} isJson запрашивать ответ в JSON
     * @param {string|null} imgBase64 изображение для распознавания
     * @param {Object} options { maxOutputTokens, temperature }
     */
    callGemini: async (prompt, isJson = true, imgBase64 = null, options = {}) => {
        const rawKeyConfig = config.get('api_key') || '';
        // Ключей может быть несколько через запятую — квота Gemini считается
        // на проект, поэтому смысл есть только в ключах из разных проектов
        const apiKeys = rawKeyConfig.split(',').map(k => k.trim()).filter(Boolean);

        if (apiKeys.length === 0) throw new AiError('invalidKey', 'ai.noKey');

        const model = options.model || await aiService.resolveModel();

        const parts = [{ text: prompt }];
        if (imgBase64) {
            parts.push({ inline_data: { mime_type: 'image/jpeg', data: imgBase64 } });
        }

        const body = {
            contents: [{ role: 'user', parts }],
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxOutputTokens ?? aiService.LIMITS.MAX_OUTPUT_TOKENS
            }
        };

        if (isJson) body.generationConfig.responseMimeType = 'application/json';

        let lastError = null;
        let delay = 1500;
        let modelFailed = false;

        // Порядок ключей: начинаем с того, который сработал в прошлый раз,
        // и пропускаем те, что недавно упёрлись в квоту. Без этого мёртвый
        // первый ключ съедал по два запроса в каждой порции.
        for (const keyIndex of aiService._keyOrder(apiKeys.length)) {
            const apiKey = apiKeys[keyIndex];

            for (let attempt = 0; attempt < aiService.LIMITS.RETRIES_PER_KEY; attempt++) {
                let error = null;

                try {
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        }
                    );

                    // Сервер может ответить не-JSON (страница ошибки шлюза)
                    let data;
                    try {
                        data = await response.json();
                    } catch (e) {
                        throw new AiError(
                            response.status === 429 ? 'quota' : 'network',
                            'ai.network',
                            `HTTP ${response.status}`
                        );
                    }

                    if (data.error) {
                        throw aiService._classifyApiError(data.error, response.status);
                    }
                    if (!response.ok) {
                        throw new AiError(response.status === 429 ? 'quota' : 'network', 'ai.network', `HTTP ${response.status}`);
                    }

                    const text = aiService._extractText(data);
                    aiService._keyState.preferred = keyIndex;      // этот ключ жив
                    aiService._modelState.resolved = model;        // и эта модель тоже
                    return text;

                } catch (e) {
                    error = e instanceof AiError ? e : aiService._classifyThrown(e);
                }

                lastError = error;

                if (error.kind === 'invalidKey') {
                    console.warn(`[ИИ] Ключ №${keyIndex + 1} недействителен, переходим к следующему.`);
                    aiService._keyState.dead.add(keyIndex);
                    break;
                }

                if (error.kind === 'quota') {
                    // Повторять тот же ключ бессмысленно — квота не восстановится
                    // за полторы секунды. Отправляем его в отдых и берём следующий.
                    console.warn(`[ИИ] Квота на ключе №${keyIndex + 1}, отдыхает ${aiService.LIMITS.KEY_COOLDOWN_MS / 1000} с.`);
                    aiService._keyState.cooldownUntil[keyIndex] = Date.now() + aiService.LIMITS.KEY_COOLDOWN_MS;
                    break;
                }

                if (error.kind === 'overloaded' || error.kind === 'modelMissing') {
                    // Перегружена сама модель — ключи тут ни при чём.
                    // Помечаем её и выходим из цикла ключей, чтобы взять другую.
                    console.warn(`[ИИ] Модель ${model}: ${error.kind}. Пробуем другую.`);
                    aiService._modelState.overloaded.add(model);
                    if (aiService._modelState.resolved === model) aiService._modelState.resolved = null;
                    modelFailed = true;
                    break;
                }

                if (error.kind === 'network') {
                    const hasMoreAttempts = attempt < aiService.LIMITS.RETRIES_PER_KEY - 1;
                    if (hasMoreAttempts) {
                        console.warn(`[ИИ] Сбой связи на ключе №${keyIndex + 1}, повтор через ${delay} мс.`);
                        await new Promise(res => setTimeout(res, delay));
                        delay = Math.round(delay * 1.6);
                        continue;
                    }
                    break;
                }

                // blocked / empty — смена ключа или модели не поможет
                throw error;
            }

            if (modelFailed) break;
        }

        // Модель не отвечает — перебираем остальные по рангу.
        // Перебор делаем здесь, а не рекурсией: иначе после первой же
        // неудачной замены цепочка обрывалась.
        if (modelFailed && !options._noFallback) {
            const ranked = await aiService.getRankedModels();

            for (const next of ranked) {
                if (aiService._modelState.overloaded.has(next)) continue;

                console.log(`[ИИ] Переключаемся на модель ${next}.`);
                try {
                    const text = await aiService.callGemini(prompt, isJson, imgBase64, {
                        ...options, model: next, _noFallback: true
                    });
                    config.set('model', next);   // запоминаем рабочую
                    return text;
                } catch (e) {
                    lastError = e;
                    if (e.kind === 'overloaded' || e.kind === 'modelMissing') continue;
                    throw e;
                }
            }

            throw new AiError('overloaded', 'ai.allModelsBusy');
        }

        throw lastError || new AiError('unknown', 'ai.unknown');
    },

    /**
     * Состояние ключей на время сессии.
     * preferred — последний сработавший, dead — заведомо недействительные,
     * cooldownUntil — когда ключ снова можно пробовать после квоты.
     */
    _keyState: {
        preferred: 0,
        dead: new Set(),
        cooldownUntil: {}
    },

    /** Порядок перебора ключей: сначала рабочий, отдыхающие — в конец. */
    _keyOrder: (total) => {
        const now = Date.now();
        const all = Array.from({ length: total }, (_, i) => i);

        const usable = all.filter(i => !aiService._keyState.dead.has(i) && (aiService._keyState.cooldownUntil[i] || 0) <= now);
        const resting = all.filter(i => !aiService._keyState.dead.has(i) && (aiService._keyState.cooldownUntil[i] || 0) > now);

        // Начинаем с того, который работал в прошлый раз
        const start = usable.indexOf(aiService._keyState.preferred);
        const ordered = start > 0 ? [...usable.slice(start), ...usable.slice(0, start)] : usable;

        // Если живых не осталось — всё равно пробуем отдыхающие, вдруг квота уже вернулась
        return ordered.length ? [...ordered, ...resting] : [...resting, ...all.filter(i => aiService._keyState.dead.has(i))];
    },

    /** Ошибка от самого API: приводим к типу. */
    _classifyApiError: (apiError, status) => {
        const message = String(apiError.message || '');
        const lower = message.toLowerCase();
        const short = message.split('For more information')[0].trim();

        if (lower.includes('api key not valid') || lower.includes('api_key_invalid') || status === 400 && lower.includes('key')) {
            return new AiError('invalidKey', 'ai.invalidKey', short);
        }
        if (status === 429 || lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
            return new AiError('quota', 'ai.quota');
        }
        if (status === 503 || lower.includes('overloaded') || lower.includes('high demand') || lower.includes('unavailable')) {
            return new AiError('overloaded', 'ai.overloaded');
        }
        if (lower.includes('not found') || lower.includes('is not supported')) {
            return new AiError('modelMissing', 'ai.modelUnavailable', short);
        }
        return new AiError('unknown', 'ai.unknown', short);
    },

    /** Исключение из fetch или разбора: тоже приводим к типу. */
    _classifyThrown: (e) => {
        const lower = String(e?.message || '').toLowerCase();
        if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
            return new AiError('network', 'ai.offline');
        }
        return new AiError('unknown', 'ai.unknown', e?.message || '');
    },

    _getJsonFormat: () => {
        return `[
            {"type":"noun", "word":"слово с артиклем (der Tisch)", "translation":"перевод", "plural":"мн.ч. (die Tische)", "dativ":"форма в Dativ (dem Tisch)", "synonym":"синоним", "gegenteil":"антоним", "example_de":"пример", "example_ru":"перевод", "topic":"категория"},
            {"type":"verb", "word":"инфинитив", "translation":"перевод", "present":"ich ..., du ..., er/sie/es ...", "preterite":"Präteritum", "participle_ii":"Partizip II", "auxiliary":"haben/sein", "rektion":"предлог + падеж", "synonym":"синоним", "gegenteil":"антоним", "example_de":"пример", "example_ru":"перевод", "topic":"категория"},
            {"type":"adjective", "word":"слово", "translation":"перевод", "comparative":"сравн.", "superlative":"превосх.", "synonym":"синоним", "gegenteil":"антоним", "example_de":"пример", "example_ru":"перевод", "topic":"категория"},
            {"type":"phrase", "word":"фраза", "translation":"перевод", "synonym":"синоним", "example_de":"пример", "example_ru":"перевод", "topic":"категория"}
        ]`;
    },

    // ======================================================
    //  Выбор модели
    // ======================================================

    /**
     * Модели не выбираются вручную: список доступных спрашивается у самого
     * API и ранжируется. Причина — «high demand» на конкретной модели никак
     * не связан с ключом, и пользователь не должен разбираться, какой
     * идентификатор сейчас живой.
     */
    _modelState: {
        resolved: null,          // модель, которая точно работает
        available: null,         // что вернул listModels
        overloaded: new Set()    // модели, ответившие «high demand» в этой сессии
    },

    /** Модели, которые нам не подходят: не текстовые или заведомо тяжёлые. */
    _MODEL_EXCLUDE: /embedding|aqa|vision|image|imagen|tts|audio|veo|live/i,

    /**
     * Оценка пригодности модели. Чем больше, тем лучше.
     * Хотим быструю flash-модель посвежее: она бесплатная и её лимиты выше.
     */
    _rankModel: (name) => {
        if (!/gemini/i.test(name) || aiService._MODEL_EXCLUDE.test(name)) return -1;

        let score = 0;
        if (/flash/i.test(name)) score += 100;
        if (/lite/i.test(name)) score -= 30;          // дешевле, но заметно слабее
        if (/pro/i.test(name)) score += 20;
        if (/preview|exp/i.test(name)) score -= 40;   // нестабильны и чаще перегружены
        if (/latest/i.test(name)) score -= 10;        // алиас: непонятно, куда указывает

        // Версия в имени: gemini-2.5-flash → 2.5
        const version = name.match(/gemini-(\d+(?:\.\d+)?)/);
        if (version) score += parseFloat(version[1]) * 10;

        return score;
    },

    /** Список моделей, доступных конкретному ключу. */
    listModels: async (apiKey) => {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json().catch(() => null);

        if (!data) throw new AiError('network', 'ai.network', `HTTP ${response.status}`);
        if (data.error) throw aiService._classifyApiError(data.error, response.status);

        return (data.models || [])
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));
    },

    /**
     * Какую модель использовать прямо сейчас.
     * Порядок: уже подтверждённая → сохранённая в настройках → лучшая
     * из доступных ключу → запасной жёсткий список.
     */
    resolveModel: async () => {
        const state = aiService._modelState;
        if (state.resolved && !state.overloaded.has(state.resolved)) return state.resolved;

        const saved = config.get('model');
        if (saved && saved !== 'gemini-1.5-flash-latest' && !state.overloaded.has(saved)) {
            return saved;
        }

        const candidates = await aiService.getRankedModels();
        const usable = candidates.find(m => !state.overloaded.has(m));

        return usable || candidates[0] || 'gemini-2.0-flash';
    },

    /** Доступные модели по убыванию пригодности. Список кэшируется на сессию. */
    getRankedModels: async () => {
        const state = aiService._modelState;
        if (state.available) return state.available;

        const keys = (config.get('api_key') || '').split(',').map(k => k.trim()).filter(Boolean);

        for (const key of keys) {
            try {
                const models = await aiService.listModels(key);
                const ranked = models
                    .map(name => ({ name, score: aiService._rankModel(name) }))
                    .filter(m => m.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .map(m => m.name);

                if (ranked.length) {
                    state.available = ranked;
                    console.log('[ИИ] Доступные модели:', ranked.slice(0, 5).join(', '));
                    return ranked;
                }
            } catch (e) {
                console.warn('[ИИ] Не удалось получить список моделей:', e.message);
            }
        }

        // Ключи не отвечают — идём по жёсткому списку
        state.available = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
        return state.available;
    },

    /**
     * Проверка подключения: гоняет каждый ключ по отдельности и собирает отчёт.
     *
     * Отчёт можно скопировать и переслать — ключи в нём замаскированы,
     * видно только начало, чтобы отличить один от другого.
     */
    diagnose: async (onStep = null) => {
        const keys = (config.get('api_key') || '').split(',').map(k => k.trim()).filter(Boolean);
        // Диагностика не должна зависеть от того, что записано в настройках:
        // спрашиваем модель тем же способом, каким её выбирает приложение
        aiService._modelState.available = null;
        aiService._modelState.overloaded.clear();
        const model = await aiService.resolveModel();

        const mask = (k) => k.length > 10 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '***';

        const report = {
            модель: model,
            ключей: keys.length,
            результаты: [],
            итог: ''
        };

        if (keys.length === 0) {
            report.итог = t('ai.noKey');
            return report;
        }

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (onStep) onStep(i + 1, keys.length);

            const entry = { ключ: mask(key), статус: '', деталь: '', мс: 0 };
            const started = performance.now();

            // Сначала спрашиваем список моделей: это дешёвый запрос, который
            // сразу отвечает, настоящий ли это ключ Gemini API
            let ranked = [];
            try {
                const models = await aiService.listModels(key);
                entry.моделей = models.length;
                ranked = models
                    .map(n => ({ n, s: aiService._rankModel(n) }))
                    .filter(m => m.s > 0)
                    .sort((a, b) => b.s - a.s)
                    .map(m => m.n);
                entry.лучшие = ranked.slice(0, 3).join(', ') || '—';
            } catch (e) {
                entry.статус = e.kind === 'invalidKey' ? 'ключ не принят' : (e.kind || 'ошибка');
                entry.деталь = `список моделей: ${e.details || e.message}`.slice(0, 200);
                entry.мс = Math.round(performance.now() - started);
                report.результаты.push(entry);
                continue;
            }

            // Пробуем сгенерировать: перебираем модели так же, как приложение,
            // иначе одна перегруженная модель выглядела бы как нерабочий ключ
            const toTry = [model, ...ranked.filter(m => m !== model)].slice(0, 4);

            for (const candidateModel of toTry) {
                try {
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${key}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ role: 'user', parts: [{ text: 'Верни JSON: [{"word":"der Test","translation":"тест"}]' }] }],
                                generationConfig: {
                                    temperature: 0,
                                    maxOutputTokens: 256,
                                    responseMimeType: 'application/json'
                                }
                            })
                        }
                    );

                    entry.мс = Math.round(performance.now() - started);
                    entry.модель = candidateModel;
                    const data = await response.json().catch(() => null);

                    if (!data) {
                        entry.статус = 'ошибка';
                        entry.деталь = `HTTP ${response.status}, ответ не JSON`;
                        break;
                    }

                    if (data.error) {
                        const classified = aiService._classifyApiError(data.error, response.status);
                        entry.статус = classified.kind;
                        entry.деталь = data.error.message.split('For more information')[0].trim().slice(0, 160);
                        // Перегруженную модель пропускаем и пробуем следующую
                        if (classified.kind === 'overloaded' || classified.kind === 'modelMissing') continue;
                        break;
                    }

                    const candidate = data.candidates?.[0];
                    entry.статус = candidate ? 'ок' : 'пустой ответ';
                    entry.деталь = candidate ? `finishReason=${candidate.finishReason}` : JSON.stringify(data.promptFeedback || {});
                    if (data.usageMetadata) {
                        entry.токены = `вход ${data.usageMetadata.promptTokenCount}, выход ${data.usageMetadata.candidatesTokenCount}`;
                    }
                    break;

                } catch (e) {
                    entry.мс = Math.round(performance.now() - started);
                    entry.статус = 'сеть';
                    entry.деталь = String(e.message).slice(0, 160);
                    break;
                }
            }

            report.результаты.push(entry);
        }

        const рабочих = report.результаты.filter(r => r.статус === 'ок').length;
        report.итог = рабочих > 0
            ? `Рабочих ключей: ${рабочих} из ${keys.length}`
            : 'Ни один ключ не ответил успешно';

        return report;
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
        const BATCH_SIZE = aiService.LIMITS.BATCH_SIZE;
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
            const requestCount = Math.min(BATCH_SIZE, Math.max(need + 2, 5));

            // Пауза между порциями: бесплатный тариф ограничивает запросы в минуту,
            // а без паузы они уходили подряд
            if (attempts > 1) {
                await new Promise(res => setTimeout(res, aiService.LIMITS.BATCH_PAUSE_MS));
            }

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
                console.warn('[ИИ] Порция не сгенерировалась, отдаём собранное:', e.message);
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

        try {
            return JSON.parse(responseText.replace(/```json/gi, '').replace(/```/g, '').trim());
        } catch (e) {
            // История длинная, её тоже может обрезать по лимиту токенов
            const salvaged = aiService._salvageObjects(responseText);
            if (salvaged.length && salvaged[0].story_de) return salvaged[0];
            throw new AiError('empty', 'ai.badJson');
        }
    },

    /**
     * Вытаскивает из оборванного JSON все объекты верхнего уровня,
     * которые успели закрыться.
     *
     * Нужно, когда ответ обрезан по лимиту токенов: раньше в этом случае
     * JSON.parse падал и терялась вся порция, хотя одиннадцать слов из
     * двенадцати пришли целыми.
     */
    _salvageObjects: (raw) => {
        const found = [];
        let depth = 0;
        let start = -1;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < raw.length; i++) {
            const ch = raw[i];

            if (inString) {
                if (escaped) escaped = false;
                else if (ch === '\\') escaped = true;
                else if (ch === '"') inString = false;
                continue;
            }

            if (ch === '"') { inString = true; continue; }

            if (ch === '{') {
                if (depth === 0) start = i;
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0 && start >= 0) {
                    found.push(raw.slice(start, i + 1));
                    start = -1;
                }
            }
        }

        return found
            .map(chunk => { try { return JSON.parse(chunk); } catch { return null; } })
            .filter(obj => obj && typeof obj === 'object');
    },

    _parseJsonResponse: (rawText, defaultLevel, defaultTopic) => {
        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

        let parsed = null;
        try {
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            // Ответ обрезан или испорчен — спасаем целые объекты
            const salvaged = aiService._salvageObjects(cleanJson);
            if (salvaged.length === 0) {
                console.error('[ИИ] Ответ не разобрать:', cleanJson.slice(0, 300));
                throw new AiError('empty', 'ai.badJson');
            }
            console.warn(`[ИИ] JSON повреждён, спасено объектов: ${salvaged.length}`);
            parsed = salvaged;
        }

        if (parsed && !Array.isArray(parsed)) {
            for (const key in parsed) {
                if (Array.isArray(parsed[key])) { parsed = parsed[key]; break; }
            }
            if (!Array.isArray(parsed)) parsed = [parsed];
        }

        return parsed
            .filter(w => w && typeof w === 'object' && w.word && w.translation)
            .map(w => ({
                ...w,
                level: w.level || defaultLevel,
                topic: w.topic || defaultTopic,
                type: w.type || 'phrase'
            }));
    }
};