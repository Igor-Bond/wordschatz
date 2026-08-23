const scheduler = {
    updateStreak: async () => {
        let user = await db.user.get(1);
        if (!user) {
            user = { id: 1, league: 'Деревянная', totalXP: 0, currentStreak: 0, lastActiveDate: null };
            await db.user.put(user);
        }

        const now = new Date();
        const todayStr = now.toDateString(); 
        
        if (user.lastActiveDate !== todayStr) {
            if (user.lastActiveDate) {
                const todayMidnight = new Date(todayStr); 
                const lastMidnight = new Date(user.lastActiveDate);
                const diffTime = todayMidnight.getTime() - lastMidnight.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
                
                if (diffDays === 1) {
                    user.currentStreak += 1; 
                } else if (diffDays > 1) {
                    user.currentStreak = 1; 
                }
            } else {
                user.currentStreak = 1; 
            }
            
            user.lastActiveDate = todayStr;
            await db.user.put(user);
        }

        const headerStreak = document.getElementById('header-streak');
        if (headerStreak) headerStreak.innerText = user.currentStreak;
        
        return user;
    },

    getDailyPlan: async () => {
        const profile = config.getProfile();
        const now = Date.now();
        const allWords = await db.words.toArray();

        const toReview = allWords.filter(w => w.repetitions > 0 && w.nextReview <= now);
        const newWords = allWords.filter(w => w.repetitions === 0).slice(0, profile.dailyGoal);

        return {
            review: toReview,
            newWords: newWords,
            total: toReview.length + newWords.length
        };
    },

    recalculateFuturePlans: async (cycleId, newDailyGoal) => {
        console.log(`Начинаем пересчет плана для цикла ${cycleId}`);
        const today = new Date().toISOString().split('T')[0];
        const cycleWords = await db.words.where('cycleId').equals(cycleId).toArray();
        const pastAndActivePlans = await db.dayPlans
            .where('cycleId').equals(cycleId)
            .filter(plan => plan.date < today || (plan.date === today && plan.status !== 'pending'))
            .toArray();

        const processedWordIds = new Set();
        pastAndActivePlans.forEach(plan => {
            if (plan.wordIds) plan.wordIds.forEach(id => processedWordIds.add(id));
        });

        const remainingWords = cycleWords.filter(word => !processedWordIds.has(word.id));
        const plansToDelete = await db.dayPlans
            .where('cycleId').equals(cycleId)
            .filter(plan => plan.date > today || (plan.date === today && plan.status === 'pending'))
            .toArray();
        
        const idsToDelete = plansToDelete.map(p => p.id);
        await db.dayPlans.bulkDelete(idsToDelete);

        let currentDate = new Date();
        const hasActivePlanToday = pastAndActivePlans.some(p => p.date === today);
        if (hasActivePlanToday) {
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const newPlans = [];
        for (let i = 0; i < remainingWords.length; i += newDailyGoal) {
            const chunk = remainingWords.slice(i, i + newDailyGoal);
            const planDate = currentDate.toISOString().split('T')[0];
            
            newPlans.push({
                cycleId: cycleId,
                date: planDate,
                dailyGoal: newDailyGoal,
                status: 'pending',
                wordIds: chunk.map(w => w.id)
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (newPlans.length > 0) {
            await db.dayPlans.bulkAdd(newPlans);
        }
        return newPlans;
    }
};
