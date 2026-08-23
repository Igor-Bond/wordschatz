/**
 * Планировщик учебного цикла: раскладка темы по дням, план на сегодня,
 * стрик и прогресс по циклу.
 *
 * До этого таблицы cycles и dayPlans существовали в схеме, но никто их не
 * создавал: getDailyPlan просто брал первые N слов из словаря. Теперь план
 * дня читается из dayPlans активной темы.
 */
const scheduler = {

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

        // Прерванную серию фиксируем в базе, иначе она «воскреснет»
        if (value === 0 && (user.currentStreak || 0) > 0) {
            await dbService.saveUser({ ...user, currentStreak: 0 });
        }

        const headerStreak = document.getElementById('header-streak');
        if (headerStreak) headerStreak.innerText = value;

        return value;
    },

    /**
     * Засчитывает день серии. Вызывается по факту выполненной работы:
     * пройденный дневной урок или сданный контроль темы.
     */
    registerLessonCompleted: async () => {
        const user = await dbService.getUser();
        const today = dateUtils.today();
        const last = scheduler._normalizeDate(user.lastActiveDate);

        if (last === today) return user.currentStreak || 1; // сегодня уже засчитан

        const diff = last ? dateUtils.diffDays(last, today) : null;
        const streak = (diff === 1) ? (user.currentStreak || 0) + 1 : 1;

        await dbService.saveUser({ ...user, currentStreak: streak, lastActiveDate: today });

        const headerStreak = document.getElementById('header-streak');
        if (headerStreak) headerStreak.innerText = streak;

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
     */
    getReviewLimit: (dailyGoal) => Math.max(20, dailyGoal * 5),

    getDailyPlan: async () => {
        const profile = config.getProfile();
        const dailyGoal = profile.dailyGoal;

        const allDue = await dbService.getWordsToReview();
        const reviewLimit = scheduler.getReviewLimit(dailyGoal);
        const review = allDue
            .sort((a, b) => a.nextReview - b.nextReview)
            .slice(0, reviewLimit);
        const postponedReviews = allDue.length - review.length;

        const cycle = await dbService.getActiveCycle();
        let dayPlan = null;
        let newWords = [];

        if (cycle) {
            const today = dateUtils.today();
            dayPlan = await dbService.getPlanForDate(cycle.id, today);

            // Пропущенные дни не сгорают: подтягиваем самый ранний невыполненный
            if (!dayPlan || dayPlan.status === 'completed') {
                const pending = await dbService.getEarliestPendingPlan(cycle.id);
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
            newWords = newWords.concat(free.slice(0, dailyGoal - newWords.length));
        }

        return {
            review: review,
            newWords: newWords,
            dayPlan: dayPlan,
            cycle: cycle,
            postponedReviews: postponedReviews,
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
