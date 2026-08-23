const config = {
    get: (key) => localStorage.getItem(`ws_${key}`),
    set: (key, value) => localStorage.setItem(`ws_${key}`, value),
    isConfigured: () => !!localStorage.getItem('ws_api_key'),
    
    // Получить все настройки профиля как объект
    getProfile: () => {
        let currentModel = config.get('model');
        
        if (currentModel === 'gemini-1.5-flash-latest' || !currentModel) {
            currentModel = 'gemini-flash-latest';
            config.set('model', currentModel);
        }
        
        return {
            name: config.get('name') || 'Ученик',
            level: config.get('level') || 'B1',
            dailyGoal: parseInt(config.get('daily_goal') || '10'),
            interests: config.get('interests') || '',
            apiKey: config.get('api_key') || '',
            model: currentModel,
            uiLang: config.get('ui_lang') || 'ru' // По умолчанию русский
        };
    }
};