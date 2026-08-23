import { dateUtils } from '../core/dates.js';
import Dexie from '../../vendor/dexie.min.mjs';

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

export const db = new Dexie("WortSchatzProDB");

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

// Версия 4 (разбор грамматики: род, спряжение, Akkusativ, признак проверки)
db.version(4).stores({
    words: '++id, word, translation, type, topic, interval, ease, repetitions, isDifficult, nextReview, createdAt, cycleId, status, mastery, updatedAt, gender, verified',
    cycles: '++id, title, status, updatedAt',
    dayPlans: '++id, cycleId, date, dailyGoal, status, updatedAt',
    lessonState: '++id, date, status, currentStep, data, updatedAt',
    mistakes: '++id, wordId, taskType, userInput, timestamp',
    stats: '++id, date, xp, reviewsCount, newWordsCount, updatedAt',
    user: 'id, league, totalXP, currentStreak, lastActiveDate, updatedAt'
}).upgrade(async (tx) => {
    console.log('[DB] Миграция на версию 4...');

    await tx.words.toCollection().modify(word => {
        // Род вытаскиваем из самого слова: «der Tisch» → gender: 'der'.
        // Для старых карточек это бесплатно и сразу чинит задание на артикли.
        if (word.gender === undefined) {
            const parts = String(word.word ?? '').trim().split(/\s+/);
            const first = (parts[0] || '').toLowerCase();
            word.gender = (parts.length > 1 && ['der', 'die', 'das'].includes(first)) ? first : null;
        }

        // Спряжение хранилось строкой «ich mache, du machst, er macht» —
        // из неё нельзя было спросить конкретное лицо. Разбираем, что получится.
        if (word.conjugation === undefined) {
            word.conjugation = parsePresentString(word.present);
        }

        if (word.akkusativ === undefined) word.akkusativ = null;

        // Карточка сгенерирована ИИ и человеком не проверялась
        if (word.verified === undefined) word.verified = 0;
    });

    console.log('[DB] Миграция 4 завершена: разобраны род и спряжение.');
});

// Версия 5 (история ответов: освоенность считается, а не копится)
db.version(5).stores({
    words: '++id, word, translation, type, topic, interval, ease, repetitions, isDifficult, nextReview, createdAt, cycleId, status, mastery, updatedAt, gender, verified',
    cycles: '++id, title, status, updatedAt',
    dayPlans: '++id, cycleId, date, dailyGoal, status, updatedAt',
    lessonState: '++id, date, status, currentStep, data, updatedAt',
    mistakes: '++id, wordId, taskType, userInput, timestamp',
    stats: '++id, date, xp, reviewsCount, newWordsCount, updatedAt',
    user: 'id, league, totalXP, currentStreak, lastActiveDate, updatedAt'
}).upgrade(async (tx) => {
    console.log('[DB] Миграция на версию 5...');

    await tx.words.toCollection().modify(word => {
        if (!Array.isArray(word.recent)) word.recent = [];
        if (typeof word.attempts !== 'number') word.attempts = 0;
        if (typeof word.correct !== 'number') word.correct = 0;

        // Накопленное значение считать нельзя: оно росло и от «Снова».
        // Пересчитываем из интервала — истории ответов у старых слов нет,
        // но состояние SRS честное и доступно прямо сейчас.
        word.mastery = computeMastery(word);
        word.updatedAt = Date.now();
    });

    console.log('[DB] Миграция 5 завершена: освоенность пересчитана из интервалов.');
});

/**
 * Расчёт освоенности для миграции.
 *
 * Повторяет формулу из core/mastery.js. Импортировать оттуда нельзя:
 * миграция выполняется при открытии базы, до загрузки модулей приложения,
 * и лишняя зависимость здесь означала бы цикл.
 */
function computeMastery(word) {
    const interval = word.interval || 0;
    const repetitions = word.repetitions || 0;
    const phase = word.phase || (interval > 0 && repetitions > 0 ? 'review' : 'learning');

    if (phase === 'learning' || interval <= 0) return Math.min(25, repetitions * 8);
    if (interval < 7) return Math.round(25 + ((interval - 1) / 6) * 30);
    if (interval < 21) return Math.round(55 + ((interval - 7) / 14) * 25);

    return Math.min(100, Math.round(80 + ((interval - 21) / 69) * 20));
}

/**
 * Разбор строки спряжения вида «ich mache, du machst, er/sie/es macht».
 * Возвращает null, если разобрать нечего.
 */
function parsePresentString(present) {
    const text = String(present ?? '').trim();
    if (!text) return null;

    const PRONOUNS = {
        ich: 'ich', du: 'du', er: 'er', sie: 'er', es: 'er',
        wir: 'wir', ihr: 'ihr'
    };

    const result = {};
    for (const chunk of text.split(/[,;]/)) {
        const match = chunk.trim().match(/^([a-zäöüß/]+)\s+(.+)$/i);
        if (!match) continue;

        // «er/sie/es macht» — берём первое местоимение
        const pronoun = PRONOUNS[match[1].toLowerCase().split('/')[0]];
        if (pronoun && !result[pronoun]) result[pronoun] = match[2].trim();
    }

    return Object.keys(result).length ? result : null;
}

const DEFAULT_USER = {
    id: 1,
    league: 'wooden',
    totalXP: 0,
    currentStreak: 0,
    lastActiveDate: null
};

export const dbService = {

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
        const { id, ...rest } = wordObj;   // чужой id не переносим: его назначит база

        return await db.words.add({
            interval: 0,
            ease: 2.5,
            repetitions: 0,
            isDifficult: 0,
            nextReview: now,
            status: 'new',
            mastery: 0,
            cycleId: null,
            gender: null,                  // род существительного отдельным полем
            conjugation: null,             // спряжение объектом, а не строкой
            akkusativ: null,
            verified: 0,                   // карточку ещё не проверял человек
            recent: [],                    // последние ответы: 1 верно, 0 нет
            attempts: 0,
            correct: 0,
            ...rest,                       // переданные поля важнее значений по умолчанию
            createdAt: rest.createdAt || now,   // при импорте дата создания сохраняется
            updatedAt: now,
            deletedAt: rest.deletedAt ?? null
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
        if (!user) return { ...DEFAULT_USER };

        // Записи прошлых версий хранили русское название лиги вместо ключа
        return { ...user, league: dbService.normalizeLeague(user.league) };
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

    /**
     * @param {number} points начисляемый опыт
     * @param {Object} activity что именно сделали: { reviews } или { newWords }
     */
    addXP: async (points, activity = {}) => {
        // Транзакция: между чтением и записью сюда может вклиниться
        // сохранение профиля.
        const user = await db.transaction('rw', db.user, async () => {
            const current = await dbService.getUser();
            current.totalXP = (current.totalXP || 0) + points;
            current.league = dbService.getLeagueForXP(current.totalXP);
            await db.user.put(dbService._stamp({ ...DEFAULT_USER, ...current, id: 1 }));
            return current;
        });

        // Дневная активность пишется здесь: все три места, где начисляется
        // опыт, проходят через addXP
        await dbService.recordActivity({ xp: points, ...activity });

        return user;
    },

    // ======================================================
    //  Дневная активность (§30 ТЗ)
    // ======================================================

    /**
     * Копит показатели за сегодняшний день.
     *
     * Таблица stats была в схеме с самого начала и даже попадала в бэкап,
     * но в неё никто не писал — поэтому графика активности построить
     * было не из чего.
     */
    recordActivity: async ({ xp = 0, reviews = 0, newWords = 0 } = {}) => {
        const date = dateUtils.today();

        return await db.transaction('rw', db.stats, async () => {
            const row = await db.stats.where('date').equals(date).first();

            if (row) {
                await db.stats.update(row.id, {
                    xp: (row.xp || 0) + xp,
                    reviewsCount: (row.reviewsCount || 0) + reviews,
                    newWordsCount: (row.newWordsCount || 0) + newWords,
                    updatedAt: Date.now()
                });
            } else {
                await db.stats.add({
                    date,
                    xp,
                    reviewsCount: reviews,
                    newWordsCount: newWords,
                    updatedAt: Date.now()
                });
            }
        });
    },

    /**
     * Активность за последние N дней, включая дни без занятий —
     * график должен показывать и пропуски.
     */
    getActivity: async (days = 30) => {
        const rows = await db.stats.toArray();
        const byDate = new Map(rows.map(r => [r.date, r]));
        const today = dateUtils.today();

        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = dateUtils.addDays(today, -i);
            const row = byDate.get(date);
            result.push({
                date,
                xp: row?.xp || 0,
                reviews: row?.reviewsCount || 0,
                newWords: row?.newWordsCount || 0
            });
        }
        return result;
    },

    /**
     * Пороги лиг в одном месте — раньше дублировались в db.js и dashboard.js.
     * В базе хранится ключ, а не название: названия переводятся при показе.
     */
    /**
     * Пороги рассчитаны примерно на 100–150 XP в день (обычный урок с
     * повторением и упражнениями): Каменная примерно через неделю,
     * Бронзовая через три недели, Серебряная через два месяца, Золотая
     * через полгода, Алмазная — за год почти ежедневных занятий.
     *
     * Прежние пороги (100/300/1000/2500/5000) давали Алмазную за полтора
     * месяца, после чего расти было некуда.
     */
    LEAGUES: [
        { key: 'wooden', minXP: 0 },
        { key: 'stone', minXP: 600 },
        { key: 'bronze', minXP: 2500 },
        { key: 'silver', minXP: 7000 },
        { key: 'gold', minXP: 18000 },
        { key: 'diamond', minXP: 40000 }
    ],

    /** Записи прошлых версий хранили русское название лиги. */
    LEGACY_LEAGUE_NAMES: {
        'Деревянная': 'wooden',
        'Каменная': 'stone',
        'Бронзовая': 'bronze',
        'Серебряная': 'silver',
        'Металлическая': 'silver',
        'Золотая': 'gold',
        'Алмазная': 'diamond'
    },

    normalizeLeague: (value) => {
        if (!value) return 'wooden';
        if (dbService.LEAGUES.some(l => l.key === value)) return value;
        return dbService.LEGACY_LEAGUE_NAMES[value] || 'wooden';
    },

    getLeagueForXP: (xp) => {
        let current = dbService.LEAGUES[0].key;
        for (const league of dbService.LEAGUES) {
            if (xp >= league.minXP) current = league.key;
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
    //  Резервная копия (§29 ТЗ)
    // ======================================================

    BACKUP_FORMAT: 'wortschatz-backup',
    BACKUP_VERSION: 2,

    /**
     * Полный слепок данных пользователя.
     *
     * Прежний экспорт выбрасывал interval, ease, repetitions и nextReview
     * и не включал XP, лигу и стрик: перенос на другое устройство означал
     * потерю всего прогресса и обучение с нуля.
     */
    exportAll: async () => {
        const [allWords, cycles, dayPlans, stats, user] = await Promise.all([
            db.words.toArray(),
            db.cycles.toArray(),
            db.dayPlans.toArray(),
            db.stats.toArray(),
            db.user.get(1)
        ]);

        return {
            format: dbService.BACKUP_FORMAT,
            version: dbService.BACKUP_VERSION,
            app: 'WortSchatz Pro',
            exportedAt: new Date().toISOString(),
            profile: user?.profile || null,     // API-ключ сюда не попадает
            user: user ? {
                totalXP: user.totalXP || 0,
                league: user.league || null,
                currentStreak: user.currentStreak || 0,
                lastActiveDate: user.lastActiveDate || null
            } : null,
            words: allWords.filter(dbService._alive),   // удалённые в копию не идут
            cycles: cycles,
            dayPlans: dayPlans,
            stats: stats
        };
    },

    /** Копия ли это нового формата. */
    isFullBackup: (data) => !!data && data.format === dbService.BACKUP_FORMAT && Array.isArray(data.words),

    /**
     * Полное восстановление: текущие данные заменяются копией.
     * Идентификаторы сохраняются, поэтому связи слов с темами и планами
     * не рвутся.
     */
    restoreFromBackup: async (data) => {
        const now = Date.now();

        await db.transaction('rw', db.words, db.cycles, db.dayPlans, db.stats, db.user, async () => {
            await Promise.all([db.words.clear(), db.cycles.clear(), db.dayPlans.clear(), db.stats.clear()]);

            if (data.words?.length) {
                await db.words.bulkPut(data.words.map(w => ({
                    ...w,
                    updatedAt: w.updatedAt || now,
                    deletedAt: w.deletedAt ?? null
                })));
            }
            if (data.cycles?.length) await db.cycles.bulkPut(data.cycles);
            if (data.dayPlans?.length) await db.dayPlans.bulkPut(data.dayPlans);
            if (data.stats?.length) await db.stats.bulkPut(data.stats);

            const existing = await db.user.get(1);
            await db.user.put({
                ...DEFAULT_USER,
                ...existing,
                ...(data.user || {}),
                profile: data.profile || existing?.profile || null,
                id: 1,
                updatedAt: now
            });
        });

        return {
            words: data.words?.length || 0,
            cycles: data.cycles?.length || 0,
            dayPlans: data.dayPlans?.length || 0
        };
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
