const db = new Dexie("WortSchatzProDB");

// Версия 1 (Старая схема)
db.version(1).stores({
    words: '++id, word, translation, type, topic, interval, ease, repetitions, isDifficult, nextReview, createdAt',
    stats: '++id, date, xp, reviewsCount, newWordsCount',
    user: 'id, league, totalXP, currentStreak, lastActiveDate'
});

// Версия 2 (Обновленная архитектура)
db.version(2).stores({
    words: '++id, word, translation, type, topic, interval, ease, repetitions, isDifficult, nextReview, createdAt, cycleId, status, mastery', 
    cycles: '++id, title, status',
    dayPlans: '++id, cycleId, date, dailyGoal, status',
    lessonState: '++id, date, status, currentStep, data',
    mistakes: '++id, wordId, taskType, userInput, timestamp',
    stats: '++id, date, xp, reviewsCount, newWordsCount',
    user: 'id, league, totalXP, currentStreak, lastActiveDate'
}).upgrade(async (tx) => {
    console.log('Начало миграции БД на версию 2.0...');
    
    await tx.words.toCollection().modify(word => {
        if (!word.status) word.status = 'existing';
        if (typeof word.mastery === 'undefined') word.mastery = 0;
        if (typeof word.cycleId === 'undefined') word.cycleId = null;
    });
    
    console.log('Миграция успешно завершена: старым словам присвоен статус "existing".');
});

const dbService = {
    addWord: async (wordObj) => {
        return await db.words.add({
            ...wordObj,
            interval: 0,
            ease: 2.5,
            repetitions: 0,
            isDifficult: 0,
            nextReview: Date.now(),
            createdAt: Date.now(),
            status: 'new',
            mastery: 0,
            cycleId: null
        });
    },

    saveMultipleWords: async (wordsArray) => {
        const existingWords = new Set((await db.words.toArray()).map(w => w.word.toLowerCase().trim()));
        let savedCount = 0;
        
        for (let w of wordsArray) {
            if (!existingWords.has(w.word.toLowerCase().trim())) {
                await dbService.addWord(w);
                existingWords.add(w.word.toLowerCase().trim());
                savedCount++;
            }
        }
        return savedCount;
    },

    getWordsToReview: async () => {
        const now = Date.now();
        return await db.words.filter(w => w.nextReview <= now).toArray();
    },

    getAllWords: async () => {
        return await db.words.orderBy('createdAt').reverse().toArray();
    },

    addXP: async (points) => {
        let user = await db.user.get(1);
        if (!user) {
            user = { id: 1, league: 'Деревянная', totalXP: 0, currentStreak: 0, lastActiveDate: null };
        }
        user.totalXP += points;
        
        if (user.totalXP > 5000) user.league = 'Алмазная';
        else if (user.totalXP > 2500) user.league = 'Золотая';
        else if (user.totalXP > 1000) user.league = 'Серебряная';
        else if (user.totalXP > 300) user.league = 'Бронзовая';
        else if (user.totalXP > 100) user.league = 'Каменная';

        await db.user.put(user);
        return user;
    },

    // МЕТОД ДЛЯ ЗАПИСИ ОШИБОК В ЖУРНАЛ
    logMistake: async (wordId, exerciseType, userInput) => {
        try {
            await db.mistakes.add({
                wordId: parseInt(wordId),
                taskType: exerciseType,
                userInput: String(userInput),
                timestamp: Date.now()
            });
            console.log(`[Журнал] Ошибка записана (Слово ID: ${wordId})`);
        } catch (e) {
            console.error('Не удалось записать ошибку:', e);
        }
    }
};