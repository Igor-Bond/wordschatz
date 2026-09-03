import { dbService } from './services/db.js';

/**
 * Настройки профиля.
 *
 * Хранятся в localStorage — доступ синхронный, разметка собирается без await.
 * Параллельно всё, кроме секретов, зеркалится в базу: там оно попадёт под
 * будущую облачную синхронизацию, а на новом устройстве профиль подтянется
 * обратно в localStorage (см. hydrateFromDb).
 *
 * API-ключ в базу не пишется и в облако не уедет: это секрет пользователя,
 * его вводят на каждом устройстве отдельно.
 */
export const config = {

    /** Ключи, которые остаются только на устройстве. */
    LOCAL_ONLY_KEYS: ['api_key'],

    get: (key) => localStorage.getItem(`ws_${key}`),

    set: (key, value) => {
        localStorage.setItem(`ws_${key}`, value);
        if (!config.LOCAL_ONLY_KEYS.includes(key)) config.mirrorToDb();
    },

    isConfigured: () => !!localStorage.getItem('ws_api_key'),

    /** Все настройки профиля одним объектом. Синхронно. */
    getProfile: () => {
        let currentModel = config.get('model');

        if (currentModel === 'gemini-1.5-flash-latest' || !currentModel) {
            currentModel = 'gemini-flash-latest';
            config.set('model', currentModel);
        }

        const норма = parseInt(config.get('daily_goal') || '10');

        return {
            name: config.get('name') || 'Ученик',
            level: config.get('level') || 'B1',
            dailyGoal: норма,

            /*
             * Норма, выбранная человеком, — отдельно от действующей.
             *
             * Они расходятся, когда приложение снижает норму само из-за
             * трёх дней переносов. Действующая падает, а эта остаётся:
             * от неё считается потолок повторений.
             *
             * Иначе выходило наоборот задуманному. Потолок считается от
             * нормы, и снижение резало его вместе с ней — 140 в день
             * превращались в 70 ровно тогда, когда очередь и без того не
             * помещалась. Приложение сужало трубу, которую надо было
             * расширить: замер показал, что при точности 90 % очередь
             * росла с двух слов до сорока девяти именно из-за этого.
             *
             * Смысл разделения простой. Норму снизили вы — значит у вас
             * меньше времени, и потолок справедливо падает. Снизило
             * приложение — ваше время не изменилось, душить нечего.
             */
            chosenGoal: parseInt(config.get('chosen_goal') || String(норма)),

            interests: config.get('interests') || '',
            apiKey: config.get('api_key') || '',
            model: currentModel
        };
    },

    /** Поля, которые синхронизируются. Ключ намеренно отсутствует. */
    getSyncableProfile: () => {
        const { apiKey, ...syncable } = config.getProfile();
        return syncable;
    },

    /**
     * Запись профиля в базу. Вызывается из config.set, поэтому склеиваем
     * подряд идущие изменения — onboarding сохраняет полдюжины ключей разом.
     */
    _mirrorTimer: null,
    _mirrorSuspended: false,

    /** Сброс приложения: не даём отложенной записи воссоздать удалённую базу. */
    suspendMirror: () => {
        config._mirrorSuspended = true;
        clearTimeout(config._mirrorTimer);
    },

    mirrorToDb: () => {
        if (typeof dbService === 'undefined' || config._mirrorSuspended) return;

        clearTimeout(config._mirrorTimer);
        config._mirrorTimer = setTimeout(() => {
            dbService.saveStoredProfile(config.getSyncableProfile())
                .catch(e => console.error('Не удалось сохранить профиль в базу:', e));
        }, 100);
    },

    /**
     * Подъём профиля из базы в localStorage.
     * Нужен, когда база уже есть, а localStorage пуст: восстановление на новом
     * устройстве или очистка данных сайта без удаления IndexedDB.
     */
    hydrateFromDb: async () => {
        if (typeof dbService === 'undefined') return false;

        try {
            const stored = await dbService.getStoredProfile();
            if (!stored) return false;

            const map = {
                name: 'name',
                level: 'level',
                dailyGoal: 'daily_goal',
                chosenGoal: 'chosen_goal',
                interests: 'interests',
                model: 'model'
            };

            let restored = false;
            for (const [field, key] of Object.entries(map)) {
                const value = stored[field];
                if (value === undefined || value === null || value === '') continue;
                if (localStorage.getItem(`ws_${key}`) !== null) continue;

                localStorage.setItem(`ws_${key}`, value);
                restored = true;
            }

            if (restored) console.log('[Профиль] Настройки восстановлены из базы.');
            return restored;
        } catch (e) {
            console.error('Не удалось прочитать профиль из базы:', e);
            return false;
        }
    }
};
