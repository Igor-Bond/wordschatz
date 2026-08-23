/**
 * Единственная точка работы с хранилищем (§39 ТЗ).
 *
 * Остальное приложение обращается только к dbService и не знает, что под ним
 * Dexie. Когда появится Firebase/Supabase, менять придётся этот файл, а не
 * двадцать модулей.
 *
 * Правила:
 *   - никаких обращений к `db.*` вне этого файла;
 *   - каждая запись получает updatedAt — без него невозможна синхронизация;
 *   - слова удаляются мягко (deletedAt), иначе удаление не доедет до облака.
 */

const db = new Dexie("WortSchatzProDB");

// Версия 1 (историческая схема)
db.version(1).stores({
    words: '++id, word, translation, type, topic, interval, ease, repetitions, isDifficult, nextReview, createdAt',
    stats: '++id, date, xp, reviewsCount, newWordsCount',
    user: 'id, league, totalXP, currentStreak, lastActiveDate'
});

// Версия 2 (циклы, планы, журнал ошибок)
db.version(2).stores({
    words: '++id, word, translation, type, topic, interval, ease, repetitions, isDifficult, nextReview, createdAt, cycleId, status, mastery',
    cycles: '++id, title, status',
    dayPlans: '++id, cycleId, date, dailyGoal, status',
    lessonState: '++id, date, status, currentStep, data',
    mistakes: '++id, wordId, taskType, userInput, timestamp',
    stats: '++id, date, xp, reviewsCount, newWordsCount',
    user: 'id, league, totalXP, currentStreak, lastActiveDate'
}).upgrade(async (tx) => {
    console.log('[DB] Миграция на версию 2...');
    await tx.words.toCollection().modify(word => {
        if (!word.status) word.status = 'existing';
        if (typeof word.mastery === 'undefined') word.mastery = 0;
        if (typeof word.cycleId === 'undefined') word.cycleId = null;
    });
    console.log('[DB] Миграция 2 завершена: старым словам присвоен статус "existing".');
});

// Версия 3 (подготовка к облачной синхронизации: updatedAt + мягкое удаление)
db.version(3).stores({
    words: '++id, word, translation, type, topic, interval, ease, repetitions, isDifficult, nextReview, createdAt, cycleId, status, mastery, updatedAt',
    cycles: '++id, title, status, updatedAt',
    dayPlans: '++id, cycleId, date, dailyGoal, status, updatedAt',
    lessonState: '++id, date, status, currentStep, data, updatedAt',
    mistakes: '++id, wordId, taskType, userInput, timestamp',
    stats: '++id, date, xp, reviewsCount, newWordsCount, updatedAt',
    user: 'id, league, totalXP, currentStreak, lastActiveDate, updatedAt'
}).upgrade(async (tx) => {
    console.log('[DB] Миграция на версию 3...');
    const stamp = (rec) => {
        if (!rec.updatedAt) rec.updatedAt = rec.createdAt || Date.now();
        if (typeof rec.deletedAt === 'undefined') rec.deletedAt = null;
    };
    await tx.words.toCollection().modify(stamp);
    await tx.cycles.toCollection().modify(stamp);
    await tx.dayPlans.toCollection().modify(stamp);
    await tx.user.toCollection().modify(stamp);
    console.log('[DB] Миграция 3 завершена: проставлены updatedAt и deletedAt.');
});

const DEFAULT_USER = {
    id: 1,
    league: 'Деревянная',
    totalXP: 0,
    currentStreak: 0,
    lastActiveDate: null
};

const dbService = {

    // ======================================================
    //  Служебное
    // ======================================================

    /** Метка времени для синхронизации. Ставится при каждой записи. */
    _stamp: (obj) => ({ ...obj, updatedAt: Date.now() }),

    /** Слово считается живым, если его не удаляли мягко. */
    _alive: (w) => !w.deletedAt,

    /** Полное удаление базы — используется только сбросом приложения. */
    resetDatabase: async () => {
        db.close();
        await db.delete();
    },

    // ======================================================
    //  Слова
    // ======================================================

    addWord: async (wordObj) => {
        const now = Date.now();
        return await db.words.add({
            interval: 0,
            ease: 2.5,
            repetitions: 0,
            isDifficult: 0,
            nextReview: now,
            status: 'new',
            mastery: 0,
            cycleId: null,
            ...wordObj,          // переданные поля важнее значений по умолчанию
            createdAt: now,
            updatedAt: now,
            deletedAt: null
        });
    },

    /**
     * Массовое сохранение с отсевом дублей.
     * @param {Array} wordsArray слова из ИИ или импорта
     * @param {Object} extra общие поля (например cycleId и status)
     * @returns {Promise<{count:number, ids:Array}>}
     */
    saveMultipleWords: async (wordsArray, extra = {}) => {
        const existing = await db.words.toArray();
        const known = new Set(
            existing.filter(dbService._alive).map(w => (w.word || '').toLowerCase().trim())
        );

        const ids = [];
        for (const w of wordsArray) {
            const key = (w.word || '').toLowerCase().trim();
            if (!key || known.has(key)) continue;

            ids.push(await dbService.addWord({ ...w, ...extra }));
            known.add(key);
        }
        return { count: ids.length, ids };
    },

    getAllWords: async () => {
        const words = await db.words.orderBy('createdAt').reverse().toArray();
        return words.filter(dbService._alive);
    },

    getWordById: async (id) => {
        const word = await db.words.get(parseInt(id));
        return word && dbService._alive(word) ? word : undefined;
    },

    getWordsByIds: async (ids) => {
        if (!ids || ids.length === 0) return [];
        const words = await db.words.bulkGet(ids.map(Number));
        return words.filter(w => w && dbService._alive(w));
    },

    getWordsByCycle: async (cycleId) => {
        const words = await db.words.where('cycleId').equals(cycleId).toArray();
        return words.filter(dbService._alive);
    },

    /** Слова, у которых подошёл срок повторения (только уже начатые). */
    getWordsToReview: async (now = Date.now()) => {
        const words = await db.words.toArray();
        return words.filter(w => dbService._alive(w) && w.repetitions > 0 && w.nextReview <= now);
    },

    /** Слова, которые пользователь уже начал учить — для контрольных срезов. */
    getStudiedWords: async () => {
        const words = await db.words.toArray();
        return words.filter(w => dbService._alive(w) && w.repetitions > 0);
    },

    updateWord: async (id, changes) => {
        return await db.words.update(parseInt(id), dbService._stamp(changes));
    },

    /** Перезапись слова целиком (после пересчёта SRS). */
    putWord: async (word) => {
        return await db.words.put(dbService._stamp(word));
    },

    /**
     * Мягкое удаление: запись остаётся, но помечается удалённой.
     * Иначе после подключения облака удалённое слово вернулось бы
     * с другого устройства.
     */
    deleteWord: async (id) => {
        return await db.words.update(parseInt(id), dbService._stamp({ deletedAt: Date.now() }));
    },

    countWords: async () => {
        const words = await db.words.toArray();
        return words.filter(dbService._alive).length;
    },

    // ======================================================
    //  Профиль, XP и лиги
    // ======================================================

    getUser: async () => {
        const user = await db.user.get(1);
        return user || { ...DEFAULT_USER };
    },

    saveUser: async (user) => {
        return await db.user.put(dbService._stamp({ ...DEFAULT_USER, ...user, id: 1 }));
    },

    /**
     * Настройки профиля живут в той же записи, что XP и стрик: это данные
     * одного пользователя, и в облако они поедут вместе. Секреты сюда не
     * попадают — их отсеивает config.getSyncableProfile.
     */
    saveStoredProfile: async (profile) => {
        // Транзакция и частичное обновление: XP пишется в эту же запись из
        // другого потока выполнения, и обычный put затёр бы начисленные очки.
        return await db.transaction('rw', db.user, async () => {
            const existing = await db.user.get(1);
            if (existing) {
                await db.user.update(1, { profile: profile, updatedAt: Date.now() });
            } else {
                await db.user.put({ ...DEFAULT_USER, profile: profile, updatedAt: Date.now() });
            }
        });
    },

    getStoredProfile: async () => {
        const user = await db.user.get(1);
        return user?.profile || null;
    },

    addXP: async (points) => {
        // Тоже в транзакции: между чтением и записью сюда может вклиниться
        // сохранение профиля.
        return await db.transaction('rw', db.user, async () => {
            const user = await dbService.getUser();
            user.totalXP = (user.totalXP || 0) + points;
            user.league = dbService.getLeagueForXP(user.totalXP);
            await db.user.put(dbService._stamp({ ...DEFAULT_USER, ...user, id: 1 }));
            return user;
        });
    },

    /** Пороги лиг в одном месте — раньше дублировались в db.js и dashboard.js. */
    LEAGUES: [
        { name: 'Деревянная', minXP: 0 },
        { name: 'Каменная', minXP: 100 },
        { name: 'Бронзовая', minXP: 300 },
        { name: 'Серебряная', minXP: 1000 },
        { name: 'Золотая', minXP: 2500 },
        { name: 'Алмазная', minXP: 5000 }
    ],

    getLeagueForXP: (xp) => {
        let current = dbService.LEAGUES[0].name;
        for (const league of dbService.LEAGUES) {
            if (xp >= league.minXP) current = league.name;
        }
        return current;
    },

    /** Следующая лига и сколько XP до неё — для прогресса на главном экране. */
    getNextLeague: (xp) => {
        return dbService.LEAGUES.find(l => xp < l.minXP) || null;
    },

    // ======================================================
    //  Циклы (темы обучения)
    // ======================================================

    getAllCycles: async () => await db.cycles.toArray(),

    getCycleById: async (id) => await db.cycles.get(parseInt(id)),

    getActiveCycle: async () => await db.cycles.where('status').equals('active').first(),

    createCycle: async (cycle) => {
        const now = Date.now();
        return await db.cycles.add({
            status: 'active',
            ...cycle,
            createdAt: now,
            updatedAt: now
        });
    },

    updateCycle: async (id, changes) => {
        return await db.cycles.update(parseInt(id), dbService._stamp(changes));
    },

    // ======================================================
    //  Дневные планы
    // ======================================================

    getPlansByCycle: async (cycleId) => {
        const plans = await db.dayPlans.where('cycleId').equals(cycleId).toArray();
        return plans.sort((a, b) => a.date.localeCompare(b.date));
    },

    getPlanForDate: async (cycleId, date) => {
        return await db.dayPlans
            .where('cycleId').equals(cycleId)
            .filter(p => p.date === date)
            .first();
    },

    /** Ближайший невыполненный план — на случай пропущенных дней. */
    getEarliestPendingPlan: async (cycleId) => {
        const plans = await dbService.getPlansByCycle(cycleId);
        return plans.find(p => p.status !== 'completed');
    },

    createDayPlans: async (plans) => {
        const now = Date.now();
        return await db.dayPlans.bulkAdd(
            plans.map(p => ({ status: 'pending', ...p, createdAt: now, updatedAt: now }))
        );
    },

    updateDayPlan: async (id, changes) => {
        return await db.dayPlans.update(parseInt(id), dbService._stamp(changes));
    },

    deleteDayPlans: async (ids) => await db.dayPlans.bulkDelete(ids),

    // ======================================================
    //  Состояние текущего урока
    // ======================================================

    getLessonStateByDate: async (date) => await db.lessonState.where('date').equals(date).first(),

    addLessonState: async (state) => await db.lessonState.add(dbService._stamp(state)),

    updateLessonState: async (id, changes) => {
        return await db.lessonState.update(parseInt(id), dbService._stamp(changes));
    },

    // ======================================================
    //  Журнал ошибок
    // ======================================================

    logMistake: async (wordId, exerciseType, userInput) => {
        try {
            await db.mistakes.add({
                wordId: parseInt(wordId),
                taskType: exerciseType,
                userInput: String(userInput),
                timestamp: Date.now()
            });
        } catch (e) {
            console.error('Не удалось записать ошибку в журнал:', e);
        }
    },

    getMistakes: async () => {
        try {
            return await db.mistakes.toArray();
        } catch (e) {
            return [];
        }
    }
};
