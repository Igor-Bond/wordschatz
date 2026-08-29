import { config } from '../config.js';
import { dbService } from '../services/db.js';
import { dialog } from './dialog.js';
import { t, plural } from '../i18n/i18n.js';
import { dateUtils } from './dates.js';
import { frequency } from './frequency.js';

/**
 * Планировщик учебного цикла: раскладка темы по дням, план на сегодня,
 * стрик и прогресс по циклу.
 *
 * До этого таблицы cycles и dayPlans существовали в схеме, но никто их не
 * создавал: getDailyPlan просто брал первые N слов из словаря. Теперь план
 * дня читается из dayPlans активной темы.
 */
export const scheduler = {

    // ======================================================
    //  Стрик
    // ======================================================

    /** Старые записи хранили дату как Date.toDateString(). */
    _normalizeDate: (value) => {
        if (!value) return null;
        return value.includes('-') ? value : dateUtils.toKey(new Date(value));
    },

    /**
     * Значение стрика для показа.
     *
     * Стрик — это серия дней, в которые пользователь ЗАНИМАЛСЯ. Раньше он
     * рос от простого открытия экрана «План»: зашёл, ничего не сделал —
     * получил +1 к серии.
     */
    getStreakValue: (user) => {
        const last = scheduler._normalizeDate(user.lastActiveDate);
        if (!last) return 0;

        const diff = dateUtils.diffDays(last, dateUtils.today());
        if (diff <= 0) return user.currentStreak || 0;   // занимался сегодня
        if (diff === 1) return user.currentStreak || 0;  // вчера — серия ещё жива
        return 0;                                        // пропущен день, серия прервана
    },

    /** Обновляет счётчик в шапке. Ничего не начисляет. */
    refreshStreak: async () => {
        const user = await dbService.getUser();
        const value = scheduler.getStreakValue(user);

        // Прерванную серию фиксируем в базе, иначе она «воскреснет».
        // Через updateUser, а не saveUser: запись общая с опытом, и целый
        // put затёр бы очки, начисленные между чтением и записью
        if (value === 0 && (user.currentStreak || 0) > 0) {
            await dbService.updateUser({ currentStreak: 0 });
        }

        scheduler._paintStreak(value);
        return value;
    },

    /**
     * Показ значения в шапке.
     *
     * Потухшая серия раньше выглядела как живая: тот же оранжевый огонёк,
     * только цифра ноль. Гасим его, чтобы разница была видна не вчитываясь.
     */
    _paintStreak: (value) => {
        const headerStreak = document.getElementById('header-streak');
        if (headerStreak) headerStreak.innerText = value;

        const icon = document.getElementById('header-streak-icon');
        if (icon) {
            icon.classList.toggle('text-orange-500', value > 0);
            icon.classList.toggle('text-slate-600', value === 0);
        }
    },

    /**
     * Что означает огонёк. Правило «пропустил день — серия сгорела» нигде
     * не написано, и пользователю остаётся догадываться, почему цифра
     * обнулилась.
     */
    explainStreak: async () => {
        const user = await dbService.getUser();
        const value = scheduler.getStreakValue(user);
        const last = scheduler._normalizeDate(user.lastActiveDate);

        const когда = last
            ? (dateUtils.diffDays(last, dateUtils.today()) === 0
                ? t('streak.today')
                : dateUtils.format(last))
            : t('streak.never');

        const строки = [
            t('streak.current', { days: plural('common.day', value) }),
            t('streak.last', { when: когда }),
            '',
            value > 0 ? t('streak.keepHint') : t('streak.startHint')
        ];

        await dialog.alert(строки.join('\n'), { title: t('streak.title') });
    },

    /**
     * Засчитывает день серии. Вызывается по факту выполненной работы:
     * пройденный дневной урок или сданный контроль темы.
     */
    registerLessonCompleted: async () => {
        const today = dateUtils.today();

        /*
         * Решение принимается внутри транзакции, а не до неё.
         *
         * Раньше здесь читали запись пользователя, считали новую серию и
         * клали запись целиком обратно. В конце урока это столкнулось с
         * начислением опыта, которое пишет в ту же запись: оно успевало
         * прочитать её до нас, а записать — после, и серия исчезала.
         * Опыт при этом оставался, потому что его правка ложилась
         * последней, — отсюда и жалоба «серия пропала, а очки на месте».
         */
        const итог = await dbService.updateUser((user) => {
            const last = scheduler._normalizeDate(user.lastActiveDate);
            if (last === today) return null;   // сегодня уже засчитан

            const diff = last ? dateUtils.diffDays(last, today) : null;
            return {
                currentStreak: (diff === 1) ? (user.currentStreak || 0) + 1 : 1,
                lastActiveDate: today
            };
        });

        const streak = итог.currentStreak || 1;
        scheduler._paintStreak(streak);
        return streak;
    },

    // ======================================================
    //  Раскладка темы по дням
    // ======================================================

    /**
     * Разбивает утверждённый набор слов на дневные порции.
     * Первый день — сегодня.
     *
     * @param {number} cycleId
     * @param {Array<number>} wordIds
     * @param {number} dailyGoal
     * @param {string} startDate YYYY-MM-DD
     * @returns {Promise<Array>} созданные планы
     */
    buildDayPlans: async (cycleId, wordIds, dailyGoal, startDate = dateUtils.today()) => {
        const plans = [];
        let dayIndex = 1;

        for (let i = 0; i < wordIds.length; i += dailyGoal) {
            plans.push({
                cycleId: cycleId,
                date: dateUtils.addDays(startDate, dayIndex - 1),
                dayIndex: dayIndex,
                dailyGoal: dailyGoal,
                status: 'pending',
                wordIds: wordIds.slice(i, i + dailyGoal)
            });
            dayIndex++;
        }

        if (plans.length > 0) await dbService.createDayPlans(plans);
        return plans;
    },

    /**
     * Пересчёт будущих дней при смене дневной нормы (§3 ТЗ).
     * Пройденные и сегодняшний начатый день не трогаем.
     */
    recalculateFuturePlans: async (cycleId, newDailyGoal) => {
        const today = dateUtils.today();
        const cycleWords = await dbService.getWordsByCycle(cycleId);
        const allPlans = await dbService.getPlansByCycle(cycleId);

        const keptPlans = allPlans.filter(p =>
            p.date < today || (p.date === today && p.status !== 'pending')
        );

        const processedWordIds = new Set();
        keptPlans.forEach(plan => {
            (plan.wordIds || []).forEach(id => processedWordIds.add(id));
        });

        const remainingWords = cycleWords.filter(w => !processedWordIds.has(w.id));

        const plansToDelete = allPlans.filter(p => !keptPlans.includes(p));
        if (plansToDelete.length > 0) {
            await dbService.deleteDayPlans(plansToDelete.map(p => p.id));
        }

        // Если сегодняшний день уже начат — новая раскладка стартует с завтра
        const hasActiveToday = keptPlans.some(p => p.date === today);
        const startDate = hasActiveToday ? dateUtils.addDays(today, 1) : today;

        const plans = [];
        let dayIndex = keptPlans.length + 1;
        for (let i = 0; i < remainingWords.length; i += newDailyGoal) {
            plans.push({
                cycleId: cycleId,
                date: dateUtils.addDays(startDate, plans.length),
                dayIndex: dayIndex++,
                dailyGoal: newDailyGoal,
                status: 'pending',
                wordIds: remainingWords.slice(i, i + newDailyGoal).map(w => w.id)
            });
        }

        if (plans.length > 0) await dbService.createDayPlans(plans);

        console.log(`[Планировщик] Цикл ${cycleId}: пересчитано ${plans.length} дней по ${newDailyGoal} слов.`);
        return plans;
    },

    // ======================================================
    //  План на сегодня
    // ======================================================

    /**
     * Что нужно сделать сегодня.
     *
     * Повторение берётся по всему словарю (SRS), новые слова — из плана дня
     * активной темы. Слова, добавленные вручную через «+», не привязаны к теме
     * и добираются сверху, если план дня не заполняет дневную норму.
     */
    /**
     * Потолок повторений на день.
     *
     * Без него словарь на 500 слов однажды выдаёт урок на 200 карточек,
     * пользователь его не проходит, долг растёт дальше. Самые просроченные
     * идут первыми, остальные подождут до завтра.
     *
     * Множитель четырнадцать, и он измерен, а не выведен.
     *
     * Сначала он был пять — просто круглое число. Потом восемь: я
     * посчитал по ступеням интервала (1, 3, 8, 20, 50, 125, 313 дней),
     * рассудив, что карточек с интервалом I накапливается I×норма и
     * каждая ступень даёт ровно «норму» повторений в день. Рассуждение
     * верное, но неполное — оно не учитывает двух вещей:
     *
     *   лестницу заучивания — новое слово проходит ещё два коротких
     *       шага, и это две лишних ежедневных ступени;
     *   провалы — забытое слово возвращается в заучивание и лезет по
     *       лестнице заново. При точности 90 % это треть всей нагрузки.
     *
     * Прогон на 365 дней с подменой часов дал зрелый спрос 13,2–13,4
     * нормы при точности 90 %. Взято четырнадцать, с небольшим запасом:
     * тринадцати при норме 5 уже не хватило, и поймала это не голова, а
     * та самая проверка прогоном.
     *
     * При точности 80 % спрос уходит в 40 норм и не сходится вовсе. Это
     * не потолком лечится: столько ошибок означает, что слов берётся
     * больше, чем усваивается, — на этот случай норма снижается сама
     * (см. overloadDecision).
     */
    getReviewLimit: (dailyGoal) => Math.max(30, dailyGoal * 14),

    // ======================================================
    //  Норма новых слов под силы человека
    // ======================================================

    /** Сколько дней подряд терпим перенос, прежде чем снизить норму. */
    OVERLOAD_LIMIT: 3,

    /** Ступени дневной нормы — те же, что в настройках. */
    GOAL_STEPS: [5, 10, 15, 20],

    /** Ближайшая ступень вниз. С нижней уже некуда. */
    lowerGoal: (goal) => {
        const ниже = scheduler.GOAL_STEPS.filter(g => g < goal);
        return ниже.length ? ниже[ниже.length - 1] : goal;
    },

    /**
     * Решение о норме по итогам дня.
     *
     * Норма новых слов и потолок повторений были двумя независимыми
     * числами, и это главная беда расписания: сколько новых слов брать,
     * человек выбирает один раз, а расплачивается за это через полгода,
     * когда повторения от них созреют. К тому времени связь между
     * причиной и следствием уже не видна.
     *
     * Поэтому норма подчиняется факту: не помещаются повторения три дня
     * подряд — норма опускается на ступень. Вверх сама не идёт: поднимать
     * себе нагрузку человек должен осознанно, а не по случайной удачной
     * неделе.
     *
     * Функция чистая — состояние читает и пишет вызывающий.
     */
    overloadDecision: ({ postponed = 0, goal = 10, streak = 0 } = {}) => {
        const набежало = postponed > 0 ? streak + 1 : 0;

        if (набежало < scheduler.OVERLOAD_LIMIT) {
            return { streak: набежало, goal, lowered: null };
        }

        const ниже = scheduler.lowerGoal(goal);

        // Ниже нижней ступени не опускаем: там уже не норма виновата
        if (ниже === goal) return { streak: набежало, goal, lowered: null };

        return { streak: 0, goal: ниже, lowered: { from: goal, to: ниже } };
    },

    /** Ключи, под которыми живёт счётчик перегрузок. */
    OVERLOAD_STREAK_KEY: 'overload_streak',
    OVERLOAD_DATE_KEY: 'overload_date',

    /**
     * Проверка перегрузки — раз в сутки.
     *
     * План строится при каждой отрисовке экрана, а считать день можно
     * только один раз, иначе счётчик набежит за один вечер.
     */
    _applyOverload: (postponed) => {
        const today = dateUtils.today();
        if (config.get(scheduler.OVERLOAD_DATE_KEY) === today) return null;

        const решение = scheduler.overloadDecision({
            postponed: postponed,
            goal: config.getProfile().dailyGoal,
            streak: parseInt(config.get(scheduler.OVERLOAD_STREAK_KEY) || '0')
        });

        config.set(scheduler.OVERLOAD_DATE_KEY, today);
        config.set(scheduler.OVERLOAD_STREAK_KEY, String(решение.streak));

        if (решение.lowered) config.set('daily_goal', String(решение.goal));

        return решение.lowered;
    },

    getDailyPlan: async () => {
        const allDue = await dbService.getWordsToReview();
        const reviewLimit = scheduler.getReviewLimit(config.getProfile().dailyGoal);
        const review = allDue
            .sort((a, b) => a.nextReview - b.nextReview)
            .slice(0, reviewLimit);
        const postponedReviews = allDue.length - review.length;

        // Норму проверяем до того, как набирать новые слова: если она
        // сегодня опустилась, пусть опустится уже сегодня, а не завтра
        const goalLowered = scheduler._applyOverload(postponedReviews);
        const dailyGoal = config.getProfile().dailyGoal;

        const activeCycle = await dbService.getActiveCycle();
        let dayPlan = null;
        let newWords = [];

        if (activeCycle) {
            const today = dateUtils.today();
            dayPlan = await dbService.getPlanForDate(activeCycle.id, today);

            // Пропущенные дни не сгорают: подтягиваем самый ранний невыполненный
            if (!dayPlan || dayPlan.status === 'completed') {
                const pending = await dbService.getEarliestPendingPlan(activeCycle.id);
                if (pending && pending.date <= today) dayPlan = pending;
                else if (dayPlan && dayPlan.status === 'completed') dayPlan = null;
            }

            if (dayPlan) {
                const planWords = await dbService.getWordsByIds(dayPlan.wordIds || []);
                newWords = planWords.filter(w => w.repetitions === 0);
            }
        }

        // Добор словами вне темы (быстрое добавление, импорт)
        if (newWords.length < dailyGoal) {
            const all = await dbService.getAllWords();
            const inPlan = new Set(newWords.map(w => w.id));
            const free = all.filter(w =>
                w.repetitions === 0 && !w.cycleId && !inPlan.has(w.id)
            );

            // По частоте, а не по дате добавления.
            //
            // Считалось, что порядок сохраняется сам: набор утверждается
            // разложенным от ходовых к редким. Оказалось, нет — словарь
            // отдаёт слова новыми вперёд, и порядок переворачивался. Нашли
            // это сквозные проверки; поодиночке обе части были правы.
            const поЧастоте = frequency.ready ? frequency.sort(free) : free;
            newWords = newWords.concat(поЧастоте.slice(0, dailyGoal - newWords.length));
        }

        // Внутри дня темы — тоже от ходовых к редким
        if (frequency.ready && newWords.length > 1) newWords = frequency.sort(newWords);

        return {
            review: review,
            newWords: newWords,
            dayPlan: dayPlan,
            cycle: activeCycle,
            postponedReviews: postponedReviews,
            goalLowered: goalLowered,
            total: review.length + newWords.length
        };
    },

    /** Отмечает день плана выполненным — вызывается при завершении урока. */
    completeDayPlan: async (planId) => {
        if (!planId) return;
        await dbService.updateDayPlan(planId, {
            status: 'completed',
            completedAt: Date.now()
        });
    },

    // ======================================================
    //  Прогресс по теме
    // ======================================================

    getCycleProgress: async (cycleId) => {
        const plans = await dbService.getPlansByCycle(cycleId);
        const words = await dbService.getWordsByCycle(cycleId);

        const completedDays = plans.filter(p => p.status === 'completed').length;
        const startedWords = words.filter(w => w.repetitions > 0).length;

        // Текущий день — первый невыполненный, иначе цикл пройден
        const pendingIndex = plans.findIndex(p => p.status !== 'completed');
        const currentDay = pendingIndex === -1 ? plans.length : pendingIndex + 1;

        return {
            totalDays: plans.length,
            completedDays: completedDays,
            currentDay: currentDay,
            totalWords: words.length,
            startedWords: startedWords,
            isFinished: plans.length > 0 && completedDays === plans.length,
            percent: plans.length ? Math.round((completedDays / plans.length) * 100) : 0
        };
    }
};
