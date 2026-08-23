export const uk = {

    common: {
        save: 'ЗБЕРЕГТИ',
        next: 'ДАЛІ',
        back: 'Назад',
        later: 'Пізніше',
        close: 'Закрити',
        error: 'Не вийшло',
        tryAgain: 'СПРОБУВАТИ ЩЕ РАЗ',
        selectAll: 'ОБРАТИ ВСЕ',
        deselectAll: 'ЗНЯТИ ВСЕ',
        day: { one: '{count} день', few: '{count} дні', many: '{count} днів', other: '{count} дня' },
        dayShort: { one: 'день', few: 'дні', many: 'днів', other: 'дня' },
        word: { one: '{count} слово', few: '{count} слова', many: '{count} слів', other: '{count} слова' },
        wordShort: { one: 'слово', few: 'слова', many: 'слів', other: 'слова' },
        minute: { one: '{count} хв', few: '{count} хв', many: '{count} хв', other: '{count} хв' },
        hour: { one: '{count} год', few: '{count} год', many: '{count} год', other: '{count} год' },
        month: { one: '{count} міс', few: '{count} міс', many: '{count} міс', other: '{count} міс' },
        lessThanDay: '< 1 дня'
    },

    nav: {
        plan: 'ПЛАН',
        room: 'КІМНАТА',
        chat: 'ШІ-ЧАТ',
        profile: 'ПРОФІЛЬ'
    },

    app: {
        description: 'ШІ-репетитор і тренажер німецьких слів',
        moduleInProgress: 'Модуль у розробці',
        moduleUnavailable: 'Цей розділ поки недоступний.',
        updateAvailable: 'Доступна нова версія',
        updateButton: 'ОНОВИТИ',
        resetConfirm:
            'Видалити ВСІ дані?\n\n' +
            'Будуть стерті словник, прогрес, XP, ліга, історія уроків і налаштування.\n' +
            'Дію не можна скасувати. Якщо потрібна копія — спершу зробіть експорт словника.',
        resetDbFailed:
            'Не вдалося видалити базу даних. ' +
            'Можливо, застосунок відкрито в іншій вкладці — закрийте її та спробуйте знову.'
    },

    settings: {
        title: 'Налаштування',
        language: 'Мова інтерфейсу',
        level: 'Рівень',
        dailyGoal: 'Норма / день',
        apiKey: 'API Ключ (Gemini)',
        model: 'Модель ШІ',
        reset: 'СКИНУТИ ВСЕ',
        checkConnection: 'ПЕРЕВІРИТИ ПІДКЛЮЧЕННЯ',
        checking: 'Перевіряємо...',
        createdBy: 'Created by Igor Bondarenko'
    },

    levels: {
        A1: 'A1 (Початковий)',
        A2: 'A2 (Базовий)',
        B1: 'B1 (Середній)',
        B2: 'B2 (Просунутий)'
    },

    goals: {
        5: '~ 5 хв на день (Легкий старт)',
        10: '~ 15 хв на день (Стандарт)',
        15: '~ 25 хв на день (Інтенсив)',
        20: '~ 35 хв на день (Хардкор)'
    },

    onboarding: {
        appName: 'WortSchatz Pro',
        intro: 'Розумна система вивчення німецької мови з ШІ. Налаштуймо твій особистий план навчання.',
        nameLabel: 'Як до тебе звертатися?',
        namePlaceholder: 'Твоє ім’я...',
        nameRequired: 'Будь ласка, введи ім’я',
        start: 'ПОЧАТИ',

        languageTitle: 'Мова інтерфейсу',
        languageHint: 'Цією мовою будуть інтерфейс і переклади слів.',

        levelTitle: 'Твій рівень і цілі',
        levelLabel: 'Поточний рівень німецької',
        interestsLabel: 'Твої інтереси (через кому)',
        interestsPlaceholder: 'Електроніка, автомобілі, реп-музика, баскетбол...',
        interestsHint: 'ШІ генеруватиме картки та історії на ці теми.',

        paceTitle: 'Темп навчання',
        paceHint: 'Обери, скільки нових слів хочеш вчити щодня. Це визначить твоє навантаження.',

        apiTitle: 'ОСТАННІЙ КРОК',
        apiSubtitle: 'Мозок застосунку',
        apiStep1: 'Перейди на',
        apiStep2: 'Увійди з Google-акаунтом',
        apiStep3: 'Натисни синю кнопку',
        apiStep4: 'і скопіюй його.',
        apiPlaceholder: 'Встав ключ (AIzaSy...)',
        apiRequired: 'Введення API ключа обов’язкове для роботи застосунку!',
        finish: '🚀 ЗАПУСТИТИ WORTSCHATZ'
    },

    dashboard: {
        hello: 'Hallo, {name}! 👋',
        league: 'Ліга',
        xp: 'XP',
        toNextLeague: 'До ліги «{league}» — {xp} XP',
        maxLeague: 'Максимальну лігу досягнуто',

        topic: 'Тема',
        dayOf: 'День {current} з {total}',
        daysDone: 'Пройдено днів: {count}',
        wordsInTopic: 'Слів у темі: {count}',

        examTitle: 'Тему завершено!',
        examText: 'Ви пройшли всі дні теми «{topic}». Пройдіть підсумковий контроль знань.',
        examButton: 'ПРОЙТИ КОНТРОЛЬ ТЕМИ',

        emptyTitle: 'З чого почнемо?',
        emptyText: 'Оберіть тему — ШІ підбере набір слів і розкладе його по днях.',
        chooseTopic: 'ОБРАТИ ТЕМУ',
        chooseNextTopic: 'ОБРАТИ НОВУ ТЕМУ',

        planTitle: 'План на сьогодні',
        freeWords: 'Вільні слова',
        review: 'Повторення',
        newWords: 'Нові слова',
        postponed: 'Ще {count} у черзі — перенесені, щоб урок не був нескінченним',
        startLesson: 'ПОЧАТИ УРОК ({count})',
        planDone: 'ПЛАН ВИКОНАНО 🎉'
    },

    cycle: {
        newTopic: 'Нова тема',
        intro: 'Оберіть, що вчимо далі. ШІ підбере слова під ваш рівень ({level}) та інтереси.',
        topicLabel: 'Тема',
        topicPlaceholder: 'Наприклад: Дім',
        topicRequired: 'Введіть тему або оберіть одну із запропонованих.',
        durationLabel: 'Тривалість',
        durationSummary: '{days} × {goal} слів = <span class="text-amber-500 font-bold">{total} слів</span> у темі',
        generate: 'ПІДІБРАТИ СЛОВА',

        loadingTitle: 'Підбираємо слова',
        loadingTopic: 'Тема «{topic}»',
        loadingProgress: '{done} із {total}',
        loadingHint: 'Великий набір збирається кількома запитами — це може зайняти до хвилини.',
        emptyResult: 'ШІ не повернув жодного нового слова. Спробуйте іншу тему.',

        previewTitle: 'Тема «{topic}»',
        previewHint: 'Зніміть галочки зі слів, які вже знаєте.',
        selectedCount: 'Обрано: <b id="cycle-selected-count" class="text-slate-100">{selected}</b> із {total}',
        daysOfStudy: 'навчання',
        approve: 'ПОЧАТИ ТЕМУ',
        nothingSelected: 'Оберіть хоча б одне слово.',
        belowGoal:
            'Обрано {count} слів — це менше за денну норму ({goal}).\n' +
            'Тема пройде за один день. Продовжити?',
        allWordsKnown: 'Усі обрані слова вже є у словнику.',

        topics: {
            everyday: 'Побут',
            travel: 'Подорожі',
            food: 'Їжа',
            work: 'Робота',
            health: 'Здоров’я',
            engineRepair: 'Ремонт двигуна',
            carDiagnostics: 'Автодіагностика',
            basketball: 'Баскетбол',
            microelectronics: 'Мікросхемотехніка',
            electronics: 'Електроніка'
        }
    },

    wordTypes: {
        noun: 'ім.',
        verb: 'дієсл.',
        adjective: 'прикм.',
        phrase: 'фраза'
    },

    leagues: {
        wooden: 'Дерев’яна',
        stone: 'Кам’яна',
        bronze: 'Бронзова',
        silver: 'Срібна',
        gold: 'Золота',
        diamond: 'Діамантова'
    },

    ai: {
        noKey: 'API-ключ не налаштований. Додайте його в налаштуваннях.',
        invalidKey: 'Усі вказані API-ключі недійсні. Перевірте їх у налаштуваннях.',
        quota: 'Вичерпано ліміт запитів на всіх ключах. Зачекайте хвилину і спробуйте знову.',
        overloaded: 'Сервіс ШІ перевантажений. Спробуйте за хвилину.',
        offline: 'Немає зв’язку із сервісом ШІ. Перевірте інтернет.',
        network: 'Збій зв’язку із сервісом ШІ.',
        blocked: 'Відповідь заблоковано фільтрами безпеки. Спробуйте іншу тему або формулювання.',
        emptyResponse: 'Модель повернула порожню відповідь. Спробуйте ще раз.',
        badJson: 'Відповідь моделі не вдалося розібрати. Спробуйте ще раз.',
        modelUnavailable: 'Обрана модель недоступна для вашого ключа.',
        allModelsBusy: 'Усі доступні моделі зараз перевантажені. Спробуйте за кілька хвилин.',
        unknown: 'Невідома помилка ШІ.'
    },

    card: {
        synonyms: 'Синоніми',
        antonyms: 'Антоніми'
    },

    training: {
        review: 'ПОВТОРЕННЯ',
        newWords: 'НОВІ СЛОВА',
        wordOf: 'Слово {current} з {total}',
        showAnswer: 'ПОКАЗАТИ ВІДПОВІДЬ',
        again: 'Знову',
        hard: 'Важко',
        good: 'Добре',
        easy: 'Легко',
        doneTitle: 'Чудова робота!',
        doneText: 'План на сьогодні успішно виконано.',
        learnedNew: 'Вивчено нових:',
        reviewed: 'Повторено:',
        xpEarned: 'Отримано XP:',
        currentLeague: 'Поточна ліга:',
        backToBase: 'ПОВЕРНУТИСЯ НА БАЗУ'
    },

    exercises: {
        freeTraining: 'ВІЛЬНЕ ТРЕНУВАННЯ',
        practice: 'ПРАКТИКА (ЕТАП 2)',
        taskOf: 'Завдання {current} з {total}',
        matchPairs: 'Знайдіть пари',
        howInGerman: 'Як це буде німецькою?',
        pickTranslation: 'Оберіть правильний переклад',
        pickArticle: 'Оберіть правильний артикль',
        perfektLabel: 'Perfekt (з допоміжним дієсловом)',
        writeVerbForm: 'Напишіть форму дієслова',
        check: 'ПЕРЕВІРИТИ',
        fillBlank: 'Заповніть пропуск',
        translationLabel: 'Переклад',
        wordPlaceholder: 'Слово...',
        rektionQuestion: 'Яке керування (Rektion) у дієслова?',
        listening: 'Аудіювання',
        writeWhatYouHear: 'Напишіть те, що почули',
        buildSentence: 'Складіть речення',
        tooHardSkip: 'СКЛАДНО, ПРОПУСТИТИ',
        tapToRemove: 'Натисніть на область, щоб прибрати слово.',
        correctAnswer: 'Правильна відповідь:',
        correctIs: 'Правильно'
    },

    control: {
        exam: 'ІСПИТ',
        questionOf: 'Питання {current} з {total}',
        translateWord: 'Перекладіть слово',
        whichArticle: 'Який артикль?',
        answer: 'ВІДПОВІСТИ',
        notEnoughWords: 'Недостатньо слів для контрольного зрізу. Потрібно щонайменше 5 слів, які ви вивчаєте.',
        startFailed: 'Не вдалося запустити тестування.',
        gradeGreat: 'Чудовий результат!',
        gradeOk: 'Добре, але є куди рости',
        gradePoor: 'Треба ще потренуватися',
        wordsToReview: 'Слова для повторення:',
        mistake: 'Помилка',
        correctAnswers: 'Правильних відповідей',
        xpGained: 'Досвіду (XP)',
        finishExam: 'ЗАВЕРШИТИ ІСПИТ'
    },

    room: {
        title: 'Тренувальна кімната',
        microTrainers: 'Мікротренажери',
        onlyHard: 'Тільки складні',
        modeDeRu: 'Зворотний<br>переклад (DE➔UA)',
        modeRuDe: 'Прямий<br>переклад (UA➔DE)',
        modeMatch: 'Знайди<br>пару',
        modeArticles: 'Артиклі<br>(Der/Die/Das)',
        modeVerbForms: 'Форми<br>дієслів',
        modeContext: 'Слова<br>в контексті',
        modeBuilder: 'Складання<br>речень',
        modeRektion: 'Rektion<br>(Керування)',
        modeListening: 'Аудіювання на слух',
        immersive: 'Занурювальні режими',
        storyTitle: 'Інтерактивне ШІ-оповідання',
        storyHint: 'Читання історії з автоперекладом по кліку',
        notEnough: 'Недостатньо відповідних слів для цього режиму! Потрібно щонайменше 4 слова.',
        notEnoughHard: 'Можливо, у вас немає «складних» слів такого типу.',
        notEnoughNouns: 'Додайте до словника більше іменників (Noun).',
        notEnoughVerbs: 'Додайте до словника більше дієслів (Verb) із заповненими формами Präteritum/Perfekt.',
        notEnoughRektion: 'Додайте дієслова, у яких заповнене поле Rektion (керування).',
        notEnoughExamples: 'Додайте слова, у яких заповнений приклад використання (Приклад DE).',
        doneTitle: 'Тренування завершено!',
        doneText: 'Чудова розминка в Кімнаті. Слова закріплені.',
        backToRoom: 'ПОВЕРНУТИСЯ ДО КІМНАТИ',
        emptyDict: 'Ваш словник порожній. Спершу додайте слова!',
        storyLoading: 'ШІ складає інтерактивну історію...',
        storyHeader: 'Інтерактивне оповідання',
        newStory: 'Нова історія',
        addWord: 'Додати',
        added: 'Додано!',
        showTranslation: 'ПОКАЗАТИ ПЕРЕКЛАД ТЕКСТУ',
        hideTranslation: 'СХОВАТИ ПЕРЕКЛАД ТЕКСТУ',
        searching: 'Шукаємо «{word}»...',
        alreadyInDict: '(вже у словнику)',
        translateFailed: 'Не вдалося перекласти «{word}»',
        usedExample: 'Він використав {word}.'
    },

    scanner: {
        title: 'Додавання слів',
        tabSingle: 'Одне слово',
        tabTopic: 'Тема цілком',
        tabText: 'Текст',
        wordLabel: 'Німецьке слово або фраза',
        wordPlaceholder: 'Наприклад: Leistung...',
        topicLabel: 'Яку тему згенерувати?',
        topicPlaceholder: 'Їжа, Подорожі, Схемотехніка...',
        countLabel: 'Кількість слів (до 30)',
        generate: 'ЗГЕНЕРУВАТИ',
        textLabel: 'Текст для аналізу',
        textPlaceholder: 'Вставте німецький текст сюди...',
        analyze: 'ПРОАНАЛІЗУВАТИ',
        loadingWord: 'Аналізуємо слово «{word}»...',
        loadingTopic: 'Нейромережа збирає {count} слів на тему «{topic}»...',
        loadingText: 'Аналізуємо текст, шукаємо корисні слова...',
        topicMisc: 'Різне',
        topicDefault: 'Повсякденне життя',
        topicFromText: 'З тексту',
        nothingFound: 'Нічого не знайдено.',
        selected: 'Обрано',
        nothingSelected: 'Оберіть хоча б одне слово для збереження!',
        savedTitle: 'Успішно збережено!',
        savedCount: 'Додано нових слів',
        goToPlan: 'ПЕРЕЙТИ ДО ПЛАНУ'
    },

    chat: {
        title: 'ШІ-Репетитор',
        online: 'Онлайн',
        greeting: 'Hallo, {name}! Я твій ШІ-репетитор. Ми можемо просто побалакати німецькою, а якщо ти помилишся — я м’яко виправлю. Про що хочеш поговорити сьогодні?',
        speak: 'Озвучити',
        roleTutor: 'Репетитор',
        roleStudent: 'Студент',
        networkError: 'Вибачте, сталася помилка мережі. Спробуйте ще раз.',
        clearConfirm: 'Ви впевнені, що хочете очистити історію чату?'
    },

    profile: {
        title: 'Профіль і дані',
        tabStats: 'Статистика',
        tabDict: 'Мій словник',
        defaultName: 'Студент',
        wordCard: 'Картка слова',
        germanWord: 'Слово німецькою',
        translation: 'Переклад',
        exampleDe: 'Приклад німецькою',
        exampleTranslation: 'Переклад прикладу',
        currentLeague: 'Поточна ліга',
        maxLeague: 'Максимум',
        xpMax: '{xp} XP (макс.)',
        dictStats: 'Статистика словника',
        totalWords: 'Усього слів',
        mastered: 'Вивчено (100%)',
        difficult: 'Складні',
        weakSpots: 'Слабкі місця (Топ 5)',
        statsError: 'Помилка завантаження статистики',
        mistakes: { one: '{count} помилка', few: '{count} помилки', many: '{count} помилок', other: '{count} помилки' },
        noMistakes: 'Помилок поки немає. Чудова робота!',
        export: 'ЕКСПОРТ',
        import: 'ІМПОРТ',
        emptyDict: 'Ваш словник поки порожній.',
        mastery: 'Засвоєння: {percent}%',
        hardBadge: 'Складне',
        deleteConfirm: 'Видалити слово «{word}» зі словника?',
        exportEmpty: 'Словник порожній, нема чого експортувати!',
        unknownFormat: 'Невідомий формат файлу',
        unknownDate: 'невідомо коли',
        importFailed: 'Не вдалося прочитати файл. Переконайтеся, що це резервна копія WortSchatz.',
        importChoice: 'Резервна копія від {date}: слів — {words}, тем — {cycles}.\n\nОК — повне відновлення: поточні словник і прогрес буде замінено копією.\nСкасувати — лише додати слова з копії до поточного словника.',
        restored: 'Відновлено:\n• слів — {words}\n• тем — {cycles}\n• днів плану — {dayPlans}\n\nПрогрес, XP і лігу відновлено. Застосунок перезавантажиться.',
        mergedFromBackup: 'Додано нових слів: {count}. Прогрес по них збережено з копії.',
        importedLegacy: 'Імпортовано слів: {count}.\n\nЦе копія старого формату — у ній немає даних про прогрес, слова додано як нові.'
    }
};
