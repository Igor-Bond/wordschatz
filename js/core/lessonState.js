const lessonStateManager = {
    getCurrentState: async () => {
        const today = new Date().toISOString().split('T')[0];
        let state = await dbService.getLessonStateByDate(today);

        if (!state) {
            state = {
                date: today,
                status: 'not_started',
                currentStep: 0,
                data: {}
            };
            state.id = await dbService.addLessonState(state);
        }
        return state;
    },

    updateState: async (status, currentStep = 0, data = {}) => {
        const state = await lessonStateManager.getCurrentState();
        await dbService.updateLessonState(state.id, {
            status: status,
            currentStep: currentStep,
            data: data
        });
    },

    completeLesson: async () => {
        // Счётчики урока (XP, новые, повторённые) нужно сохранить:
        // иначе после перезагрузки экран итогов покажет нули.
        const state = await lessonStateManager.getCurrentState();
        await lessonStateManager.updateState('completed', 100, {
            ...(state.data || {}),
            finishedAt: new Date().toISOString()
        });
    }
};
