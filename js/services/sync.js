import { auth } from './auth.js';
import { db, dbService } from './db.js';
import { config } from '../config.js';
import { t } from '../i18n/i18n.js';

/**
 * Синхронизация с Firestore (§37 ТЗ).
 *
 * Ключевое решение — обмен только изменившимся, по метке updatedAt.
 * Firestore тарифицирует каждый прочитанный документ, и на бесплатном
 * тарифе около 50 000 чтений в сутки: если тянуть весь словарь при каждом
 * запуске, две тысячи слов съедали бы по 2000 операций за раз. Поля
 * updatedAt для этого заложены в схему заранее.
 *
 * Разрешение конфликтов — «побеждает последняя запись» по updatedAt.
 * Для приложения, которым пользуется один человек с нескольких устройств,
 * этого достаточно, а удаления не воскресают, потому что стираются мягко
 * через deletedAt.
 */

const COLLECTIONS = {
    words: () => db.words,
    cycles: () => db.cycles,
    dayPlans: () => db.dayPlans,
    stats: () => db.stats
};

export const sync = {

    LAST_SYNC_KEY: 'last_sync',

    /** Идёт ли обмен прямо сейчас — чтобы не запускать второй. */
    inProgress: false,

    _listeners: new Set(),

    /** Подписка на состояние: { state, message, at } */
    onStatus: (callback) => {
        sync._listeners.add(callback);
        return () => sync._listeners.delete(callback);
    },

    _emit: (state, message = '') => {
        const payload = { state, message, at: Date.now() };
        sync._listeners.forEach(cb => {
            try { cb(payload); } catch (e) { console.error('[Синхронизация] Ошибка слушателя:', e); }
        });
    },

    getLastSync: () => Number(config.get(sync.LAST_SYNC_KEY) || 0),
    setLastSync: (value) => config.set(sync.LAST_SYNC_KEY, String(value)),

    /**
     * Ссылки на документы. Функции Firestore берём из SDK, загруженного
     * модулем авторизации: статический импорт тянул бы его при каждом запуске.
     */
    _userDoc: (ctx, uid) => ctx.fs.doc(ctx.db, 'users', uid),
    _collection: (ctx, uid, name) => ctx.fs.collection(ctx.db, 'users', uid, name),

    /**
     * Полный проход: сначала забираем чужие изменения, потом отдаём свои.
     * Порядок важен — иначе локальная запись, сделанная до синхронизации,
     * затёрлась бы более старой версией из облака.
     */
    run: async ({ silent = false } = {}) => {
        if (!auth.isSignedIn) return { skipped: 'not-signed-in' };
        if (sync.inProgress) return { skipped: 'already-running' };

        sync.inProgress = true;
        if (!silent) sync._emit('running', t('sync.inProgress'));

        const startedAt = Date.now();
        const since = sync.getLastSync();

        try {
            // Что пришло из облака, обратно не отправляем: у такой записи
            // updatedAt заведомо больше since, и push отдавал её назад тем
            // же значением. На бесплатном тарифе Firestore это удваивало
            // расход записей на каждой синхронизации
            const applied = new Map();
            const pulled = await sync.pull(auth.user.uid, since, applied);
            const pushed = await sync.push(auth.user.uid, since, applied);

            sync.setLastSync(startedAt);
            sync._emit('done', t('sync.done'));

            return { pulled, pushed, at: startedAt };
        } catch (e) {
            console.error('[Синхронизация] Сбой:', e);
            sync._emit('error', sync._describe(e));
            throw e;
        } finally {
            sync.inProgress = false;
        }
    },

    /**
     * Забираем из облака всё, что изменилось после прошлой синхронизации.
     * В `applied` складываем принятые ключи — их не надо отдавать обратно.
     */
    pull: async (uid, since, applied = new Map()) => {
        const counts = {};
        const ctx = await auth.getDb();
        const { getDoc, getDocs, query, where } = ctx.fs;

        // Профиль и игровые показатели лежат в самом документе пользователя
        const userSnap = await getDoc(sync._userDoc(ctx, uid));
        if (userSnap.exists()) {
            const remote = userSnap.data();
            const local = await dbService.getUser();

            if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
                await dbService.saveUser({ ...local, ...remote, id: 1 });
                if (remote.profile) await sync._applyProfile(remote.profile);
                counts.user = 1;
            }
        }

        for (const name of Object.keys(COLLECTIONS)) {
            const snapshot = await getDocs(
                query(sync._collection(ctx, uid, name), where('updatedAt', '>', since))
            );

            let count = 0;
            for (const document of snapshot.docs) {
                const remote = document.data();
                const table = COLLECTIONS[name]();
                const local = await table.get(remote.id);

                if (!sync.remoteWins(local, remote)) continue;

                await table.put(remote);
                count++;

                if (!applied.has(name)) applied.set(name, new Set());
                applied.get(name).add(sync.rowKey(remote));
            }

            if (count) counts[name] = count;
        }

        return counts;
    },

    /**
     * Решение о том, принимать ли запись из облака.
     *
     * Побеждает более свежая по updatedAt. Метку ставит устройство, и это
     * известное ограничение: при разъехавшихся часах свежая правка может
     * проиграть старой. Для одного человека с несколькими устройствами
     * это принято сознательно — альтернатива требует сервера.
     */
    remoteWins: (local, remote) => !local || (remote?.updatedAt || 0) > (local.updatedAt || 0),

    /** Ключ записи в облаке: id как строка. */
    rowKey: (row) => String(row?.id),

    /** Что менялось локально после отметки и не пришло только что из облака. */
    changedSince: (rows, since, skip = null) => rows.filter(row => {
        if ((row.updatedAt || 0) <= since) return false;
        return !skip?.has(sync.rowKey(row));
    }),

    /** Firestore разрешает не больше 500 операций в пачке. */
    BATCH_SIZE: 400,

    batches: (rows, size = sync.BATCH_SIZE) => {
        const result = [];
        for (let i = 0; i < rows.length; i += size) result.push(rows.slice(i, i + size));
        return result;
    },

    /** Отдаём в облако всё, что менялось локально. */
    push: async (uid, since, applied = new Map()) => {
        const counts = {};
        const ctx = await auth.getDb();
        const { doc, setDoc, writeBatch } = ctx.fs;

        const user = await dbService.getUser();
        await setDoc(sync._userDoc(ctx, uid), {
            totalXP: user.totalXP || 0,
            league: user.league || 'wooden',
            currentStreak: user.currentStreak || 0,
            lastActiveDate: user.lastActiveDate || null,
            profile: user.profile || config.getSyncableProfile(),
            updatedAt: user.updatedAt || Date.now()
        }, { merge: true });

        for (const [name, getTable] of Object.entries(COLLECTIONS)) {
            // По индексу updatedAt, а не перебором всей таблицы: он
            // заведён в схеме как раз ради этого запроса
            const changed = await getTable().where('updatedAt').above(since).toArray();
            const rows = sync.changedSince(changed, since, applied.get(name));

            if (rows.length === 0) continue;

            for (const chunk of sync.batches(rows)) {
                const batch = writeBatch(ctx.db);

                chunk.forEach(row => {
                    batch.set(doc(sync._collection(ctx, uid, name), sync.rowKey(row)), row);
                });

                await batch.commit();
            }

            counts[name] = rows.length;
        }

        return counts;
    },

    /** Профиль из облака поднимаем в localStorage. */
    _applyProfile: async (profile) => {
        const map = {
            name: 'name', level: 'level', dailyGoal: 'daily_goal',
            interests: 'interests', model: 'model'
        };

        for (const [field, key] of Object.entries(map)) {
            if (profile[field] !== undefined && profile[field] !== null) {
                localStorage.setItem(`ws_${key}`, profile[field]);
            }
        }
    },

    /**
     * Первый вход на устройстве, где уже есть локальный словарь.
     * Что делать с ним — решает пользователь, поэтому здесь только
     * подсчёт, а вопрос задаёт интерфейс.
     */
    inspectFirstSignIn: async (uid) => {
        const localWords = await dbService.countWords();

        const ctx = await auth.getDb();
        const remoteSnap = await ctx.fs.getDocs(sync._collection(ctx, uid, 'words'));
        const remoteWords = remoteSnap.size;

        return { localWords, remoteWords, conflict: localWords > 0 && remoteWords > 0 };
    },

    /** Забыть локальные данные и взять всё из облака. */
    replaceLocalWithCloud: async (uid) => {
        await db.transaction('rw', db.words, db.cycles, db.dayPlans, db.stats, async () => {
            await Promise.all([db.words.clear(), db.cycles.clear(), db.dayPlans.clear(), db.stats.clear()]);
        });

        sync.setLastSync(0);
        return await sync.pull(uid, 0);
    },

    _describe: (e) => {
        const code = e?.code || '';
        if (code.includes('permission-denied')) return t('sync.permissionDenied');
        if (code.includes('unavailable')) return t('sync.offline');
        if (code.includes('resource-exhausted')) return t('sync.quota');
        return e?.message || t('sync.error');
    }
};
