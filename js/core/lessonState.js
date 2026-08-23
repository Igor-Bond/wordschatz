const lessonStateManager = {
    getCurrentState: async () => {
        const today = new Date().toISOString().split('T')[0];
        let state = await db.lessonState.where('date').equals(today).first();

        if (!state) {
            state = {
                date: today,
                status: 'not_started',
                currentStep: 0,
                data: {} 
            };
            state.id = await db.lessonState.add(state);
        }
        return state;
    },

    updateState: async (status, currentStep = 0, data = {}) => {
        const state = await lessonStateManager.getCurrentState();
        await db.lessonState.update(state.id, {
            status: status,
            currentStep: currentStep,
            data: data
        });
    },

    completeLesson: async () => {
        await lessonStateManager.updateState('completed', 100, { 
            finishedAt: new Date().toISOString() 
        });
    }
};
