export const en = {

    common: {
        save: 'SAVE',
        next: 'NEXT',
        back: 'Back',
        later: 'Later',
        close: 'Close',
        error: 'Something went wrong',
        tryAgain: 'TRY AGAIN',
        selectAll: 'SELECT ALL',
        deselectAll: 'CLEAR ALL',
        day: { one: '{count} day', other: '{count} days' },
        dayShort: { one: 'day', other: 'days' },
        word: { one: '{count} word', other: '{count} words' },
        wordShort: { one: 'word', other: 'words' },
        minute: { one: '{count} min', other: '{count} min' },
        month: { one: '{count} mo', other: '{count} mo' },
        lessThanDay: '< 1 day'
    },

    nav: {
        plan: 'PLAN',
        room: 'ROOM',
        chat: 'AI CHAT',
        profile: 'PROFILE'
    },

    app: {
        description: 'AI tutor and German vocabulary trainer',
        moduleInProgress: 'Module in progress',
        moduleUnavailable: 'This section is not available yet.',
        updateAvailable: 'A new version is available',
        updateButton: 'UPDATE',
        resetConfirm:
            'Delete ALL data?\n\n' +
            'Your dictionary, progress, XP, league, lesson history and settings will be erased.\n' +
            'This cannot be undone. If you need a backup, export your dictionary first.',
        resetDbFailed:
            'Could not delete the database. ' +
            'The app may be open in another tab — close it and try again.'
    },

    settings: {
        title: 'Settings',
        language: 'Interface language',
        level: 'Level',
        dailyGoal: 'Words / day',
        apiKey: 'API key (Gemini)',
        model: 'AI model',
        reset: 'RESET EVERYTHING',
        createdBy: 'Created by Igor Bondarenko'
    },

    levels: {
        A1: 'A1 (Beginner)',
        A2: 'A2 (Elementary)',
        B1: 'B1 (Intermediate)',
        B2: 'B2 (Upper-intermediate)'
    },

    goals: {
        5: '~ 5 min a day (Easy start)',
        10: '~ 15 min a day (Standard)',
        15: '~ 25 min a day (Intensive)',
        20: '~ 35 min a day (Hardcore)'
    },

    onboarding: {
        appName: 'WortSchatz Pro',
        intro: 'A smart AI-powered way to learn German. Let’s set up your personal study plan.',
        nameLabel: 'What should I call you?',
        namePlaceholder: 'Your name...',
        nameRequired: 'Please enter your name',
        start: 'START',

        languageTitle: 'Interface language',
        languageHint: 'The interface and word translations will use this language.',

        levelTitle: 'Your level and goals',
        levelLabel: 'Current German level',
        interestsLabel: 'Your interests (comma separated)',
        interestsPlaceholder: 'Electronics, cars, rap music, basketball...',
        interestsHint: 'The AI will build cards and stories around these topics.',

        paceTitle: 'Study pace',
        paceHint: 'Choose how many new words you want to learn each day. This sets your daily load.',

        apiTitle: 'LAST STEP',
        apiSubtitle: 'The brain of the app',
        apiStep1: 'Go to',
        apiStep2: 'Sign in with your Google account',
        apiStep3: 'Press the blue button',
        apiStep4: 'and copy the key.',
        apiPlaceholder: 'Paste the key (AIzaSy...)',
        apiRequired: 'An API key is required for the app to work!',
        finish: '🚀 LAUNCH WORTSCHATZ'
    },

    dashboard: {
        hello: 'Hallo, {name}! 👋',
        league: 'League',
        xp: 'XP',
        toNextLeague: '{xp} XP to the {league} league',
        maxLeague: 'Highest league reached',

        topic: 'Topic',
        dayOf: 'Day {current} of {total}',
        daysDone: 'Days completed: {count}',
        wordsInTopic: 'Words in topic: {count}',

        examTitle: 'Topic complete!',
        examText: 'You have finished every day of “{topic}”. Take the final knowledge check.',
        examButton: 'TAKE THE TOPIC TEST',

        emptyTitle: 'Where do we start?',
        emptyText: 'Pick a topic — the AI will build a word set and spread it across days.',
        chooseTopic: 'CHOOSE A TOPIC',
        chooseNextTopic: 'CHOOSE A NEW TOPIC',

        planTitle: 'Today’s plan',
        freeWords: 'Free words',
        review: 'Review',
        newWords: 'New words',
        postponed: '{count} more queued — postponed so the lesson stays finite',
        startLesson: 'START LESSON ({count})',
        planDone: 'PLAN COMPLETE 🎉'
    },

    cycle: {
        newTopic: 'New topic',
        intro: 'Choose what to learn next. The AI will pick words for your level ({level}) and interests.',
        topicLabel: 'Topic',
        topicPlaceholder: 'For example: Home',
        topicRequired: 'Enter a topic or pick one of the suggestions.',
        durationLabel: 'Duration',
        durationSummary: '{days} × {goal} words = <span class="text-amber-500 font-bold">{total} words</span> in the topic',
        generate: 'BUILD THE WORD SET',

        loadingTitle: 'Building your word set',
        loadingTopic: 'Topic “{topic}”',
        loadingProgress: '{done} of {total}',
        loadingHint: 'A large set is built over several requests — this can take up to a minute.',
        emptyResult: 'The AI returned no new words. Try another topic.',

        previewTitle: 'Topic “{topic}”',
        previewHint: 'Uncheck the words you already know.',
        selectedCount: 'Selected: <b id="cycle-selected-count" class="text-slate-100">{selected}</b> of {total}',
        daysOfStudy: 'of study',
        approve: 'START THE TOPIC',
        nothingSelected: 'Select at least one word.',
        belowGoal:
            'You selected {count} words — fewer than your daily goal ({goal}).\n' +
            'The topic will take a single day. Continue?',
        allWordsKnown: 'All selected words are already in your dictionary.',

        topics: {
            everyday: 'Everyday life',
            travel: 'Travel',
            food: 'Food',
            work: 'Work',
            health: 'Health',
            engineRepair: 'Engine repair',
            carDiagnostics: 'Car diagnostics',
            basketball: 'Basketball',
            microelectronics: 'Microelectronics',
            electronics: 'Electronics'
        }
    },

    wordTypes: {
        noun: 'noun',
        verb: 'verb',
        adjective: 'adj.',
        phrase: 'phrase'
    },

    leagues: {
        wooden: 'Wooden',
        stone: 'Stone',
        bronze: 'Bronze',
        silver: 'Silver',
        gold: 'Gold',
        diamond: 'Diamond'
    }
};
