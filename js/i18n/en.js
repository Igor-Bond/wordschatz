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
        hour: { one: '{count} h', other: '{count} h' },
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
        checkConnection: 'TEST CONNECTION',
        checking: 'Testing...',
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
    },

    ai: {
        noKey: 'No API key configured. Add one in settings.',
        invalidKey: 'All configured API keys are invalid. Check them in settings.',
        quota: 'Request limit reached on every key. Wait a minute and try again.',
        overloaded: 'The AI service is overloaded. Try again in a minute.',
        offline: 'Cannot reach the AI service. Check your connection.',
        network: 'Connection to the AI service failed.',
        blocked: 'The response was blocked by safety filters. Try a different topic or wording.',
        emptyResponse: 'The model returned an empty response. Please try again.',
        badJson: 'The model’s response could not be parsed. Please try again.',
        modelUnavailable: 'The selected model is not available for your key.',
        allModelsBusy: 'Every available model is busy right now. Try again in a few minutes.',
        unknown: 'Unknown AI error.'
    },

    card: {
        synonyms: 'Synonyms',
        antonyms: 'Antonyms'
    },

    training: {
        review: 'REVIEW',
        newWords: 'NEW WORDS',
        wordOf: 'Word {current} of {total}',
        showAnswer: 'SHOW ANSWER',
        again: 'Again',
        hard: 'Hard',
        good: 'Good',
        easy: 'Easy',
        doneTitle: 'Great work!',
        doneText: 'Today’s plan is complete.',
        learnedNew: 'New words learned:',
        reviewed: 'Reviewed:',
        xpEarned: 'XP earned:',
        currentLeague: 'Current league:',
        backToBase: 'BACK TO BASE'
    },

    exercises: {
        freeTraining: 'FREE PRACTICE',
        practice: 'PRACTICE (STAGE 2)',
        taskOf: 'Task {current} of {total}',
        matchPairs: 'Match the pairs',
        howInGerman: 'How do you say this in German?',
        pickTranslation: 'Pick the correct translation',
        pickArticle: 'Pick the correct article',
        perfektLabel: 'Perfekt (with auxiliary verb)',
        writeVerbForm: 'Write the verb form',
        check: 'CHECK',
        fillBlank: 'Fill in the blank',
        translationLabel: 'Translation',
        wordPlaceholder: 'Word...',
        rektionQuestion: 'Which preposition does this verb take?',
        rektionCaseQuestion: 'Which case does this verb govern?',
        rektionCaseHint: 'Case: {kase}',
        listening: 'Listening',
        writeWhatYouHear: 'Write what you hear',
        buildSentence: 'Build the sentence',
        tooHardSkip: 'TOO HARD, SKIP',
        tapToRemove: 'Tap a word to send it back to the pool.',
        builderHint: 'Tap any word to remove it from any position',
        correctAnswer: 'Correct answer:',
        correctIs: 'Correct'
    },

    control: {
        exam: 'EXAM',
        questionOf: 'Question {current} of {total}',
        translateWord: 'Translate the word',
        whichArticle: 'Which article?',
        answer: 'ANSWER',
        notEnoughWords: 'Not enough words for a knowledge check. At least 5 words in study are needed.',
        startFailed: 'Could not start the test.',
        gradeGreat: 'Excellent result!',
        gradeOk: 'Good, but there is room to grow',
        gradePoor: 'Needs more practice',
        wordsToReview: 'Words to review:',
        mistake: 'Mistake',
        correctAnswers: 'Correct answers',
        xpGained: 'XP gained',
        finishExam: 'FINISH THE EXAM'
    },

    room: {
        title: 'Practice room',
        microTrainers: 'Micro trainers',
        onlyHard: 'Hard words only',
        modeDeRu: 'Reverse<br>translation (DE➔EN)',
        modeRuDe: 'Direct<br>translation (EN➔DE)',
        modeMatch: 'Match<br>pairs',
        modeArticles: 'Articles<br>(Der/Die/Das)',
        modeVerbForms: 'Verb<br>forms',
        modeContext: 'Words<br>in context',
        modeBuilder: 'Sentence<br>building',
        modeRektion: 'Rektion<br>(Verb government)',
        modeListening: 'Listening comprehension',
        immersive: 'Immersive modes',
        storyTitle: 'Interactive AI story',
        storyHint: 'Read a story with tap-to-translate',
        notEnough: 'Not enough suitable words for this mode! At least 4 words are needed.',
        notEnoughHard: 'You may not have any “hard” words of this type.',
        notEnoughNouns: 'Add more nouns to your dictionary.',
        notEnoughVerbs: 'Add more verbs with Präteritum/Perfekt forms filled in.',
        notEnoughRektion: 'Add verbs that have the Rektion field filled in.',
        notEnoughExamples: 'Add words that have a German example sentence.',
        doneTitle: 'Practice complete!',
        doneText: 'Nice warm-up in the Room. Words reinforced.',
        backToRoom: 'BACK TO THE ROOM',
        emptyDict: 'Your dictionary is empty. Add some words first!',
        storyLoading: 'The AI is writing an interactive story...',
        storyHeader: 'Interactive story',
        newStory: 'New story',
        addWord: 'Add',
        added: 'Added!',
        showTranslation: 'SHOW TEXT TRANSLATION',
        hideTranslation: 'HIDE TEXT TRANSLATION',
        searching: 'Looking up “{word}”...',
        alreadyInDict: '(already in dictionary)',
        translateFailed: 'Could not translate “{word}”',
        usedExample: 'He used {word}.'
    },

    scanner: {
        title: 'Add words',
        tabSingle: 'Single word',
        tabTopic: 'Whole topic',
        tabText: 'Text',
        wordLabel: 'German word or phrase',
        wordPlaceholder: 'For example: Leistung...',
        topicLabel: 'Which topic should we generate?',
        topicPlaceholder: 'Food, Travel, Circuit design...',
        countLabel: 'Number of words (up to 30)',
        generate: 'GENERATE',
        textLabel: 'Text to analyse',
        textPlaceholder: 'Paste German text here...',
        analyze: 'ANALYSE',
        loadingWord: 'Analysing “{word}”...',
        loadingTopic: 'The AI is collecting {count} words on “{topic}”...',
        loadingText: 'Analysing the text, looking for useful words...',
        topicMisc: 'Misc',
        topicDefault: 'Everyday life',
        topicFromText: 'From text',
        nothingFound: 'Nothing found.',
        selected: 'Selected',
        nothingSelected: 'Select at least one word to save!',
        savedTitle: 'Saved successfully!',
        savedCount: 'New words added',
        goToPlan: 'GO TO THE PLAN'
    },

    chat: {
        title: 'AI Tutor',
        online: 'Online',
        greeting: 'Hallo, {name}! I’m your AI tutor. We can just chat in German, and if you make a mistake I’ll gently correct it. What would you like to talk about today?',
        speak: 'Play audio',
        roleTutor: 'Tutor',
        roleStudent: 'Student',
        networkError: 'Sorry, a network error occurred. Please try again.',
        clearConfirm: 'Are you sure you want to clear the chat history?'
    },

    profile: {
        title: 'Profile and data',
        searchPlaceholder: 'Search by word, translation, topic...',
        filterAll: 'All',
        shownCount: 'Showing {shown} of {total}',
        nothingFound: 'Nothing found',
        toggleHard: 'Mark as hard',
        status: { all: 'All', difficult: 'Hard', learning: 'Learning', mastered: 'Mastered' },
        sort: { recent: 'Newest first', alphabet: 'Alphabetical', mastery: 'Weakest first' },
        tabStats: 'Statistics',
        tabDict: 'My dictionary',
        defaultName: 'Student',
        wordCard: 'Word card',
        germanWord: 'German word',
        translation: 'Translation',
        exampleDe: 'German example',
        exampleTranslation: 'Example translation',
        currentLeague: 'Current league',
        maxLeague: 'Maximum',
        xpMax: '{xp} XP (max)',
        activity: 'Activity over 30 days',
        today: 'today',
        noActivity: 'no practice',
        xpWeek: 'XP this week',
        xpMonth: 'XP this month',
        activeDays: 'days practised',
        dictStats: 'Dictionary statistics',
        totalWords: 'Total words',
        mastered: 'Mastered (100%)',
        difficult: 'Hard',
        weakSpots: 'Weak spots (Top 5)',
        statsError: 'Could not load statistics',
        mistakes: { one: '{count} mistake', other: '{count} mistakes' },
        noMistakes: 'No mistakes yet. Great work!',
        export: 'EXPORT',
        import: 'IMPORT',
        emptyDict: 'Your dictionary is still empty.',
        mastery: 'Mastery: {percent}%',
        hardBadge: 'Hard',
        deleteConfirm: 'Delete “{word}” from the dictionary?',
        exportEmpty: 'The dictionary is empty, nothing to export!',
        unknownFormat: 'Unknown file format',
        unknownDate: 'unknown date',
        importFailed: 'Could not read the file. Make sure it is a WortSchatz backup.',
        importChoice: 'Backup from {date}: {words} words, {cycles} topics.\n\nOK — full restore: your current dictionary and progress will be replaced by the backup.\nCancel — only add the words from the backup to your current dictionary.',
        restored: 'Restored:\n• words — {words}\n• topics — {cycles}\n• plan days — {dayPlans}\n\nProgress, XP and league restored. The app will reload.',
        mergedFromBackup: 'New words added: {count}. Their progress was kept from the backup.',
        importedLegacy: 'Words imported: {count}.\n\nThis is an old-format backup — it has no progress data, so the words were added as new.'
    }
};
