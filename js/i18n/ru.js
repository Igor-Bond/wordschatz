export const ru = {

    common: {
        save: 'СОХРАНИТЬ',
        next: 'ДАЛЕЕ',
        back: 'Назад',
        later: 'Позже',
        close: 'Закрыть',
        error: 'Не получилось',
        tryAgain: 'ПОПРОБОВАТЬ СНОВА',
        selectAll: 'ВЫБРАТЬ ВСЁ',
        deselectAll: 'СНЯТЬ ВСЁ',
        day: { one: '{count} день', few: '{count} дня', many: '{count} дней', other: '{count} дня' },
        dayShort: { one: 'день', few: 'дня', many: 'дней', other: 'дня' },
        word: { one: '{count} слово', few: '{count} слова', many: '{count} слов', other: '{count} слова' },
        wordShort: { one: 'слово', few: 'слова', many: 'слов', other: 'слова' },
        minute: { one: '{count} мин', few: '{count} мин', many: '{count} мин', other: '{count} мин' },
        hour: { one: '{count} ч', few: '{count} ч', many: '{count} ч', other: '{count} ч' },
        month: { one: '{count} мес', few: '{count} мес', many: '{count} мес', other: '{count} мес' },
        lessThanDay: '< 1 дня'
    },

    nav: {
        plan: 'ПЛАН',
        room: 'КОМНАТА',
        chat: 'ИИ-ЧАТ',
        profile: 'ПРОФИЛЬ'
    },

    app: {
        description: 'ИИ-репетитор и тренажер немецких слов',
        moduleInProgress: 'Модуль в разработке',
        moduleUnavailable: 'Этот раздел пока недоступен.',
        updateAvailable: 'Доступна новая версия',
        updateButton: 'ОБНОВИТЬ',
        resetConfirm:
            'Удалить ВСЕ данные?\n\n' +
            'Будут стёрты словарь, прогресс, XP, лига, история уроков и настройки.\n' +
            'Действие необратимо. Если нужен бэкап — сначала сделайте экспорт словаря.',
        resetDbFailed:
            'Не удалось удалить базу данных. ' +
            'Возможно, приложение открыто в другой вкладке — закройте её и попробуйте снова.'
    },

    settings: {
        title: 'Настройки',
        language: 'Язык интерфейса',
        level: 'Уровень',
        dailyGoal: 'Норма / день',
        apiKey: 'API Ключ (Gemini)',
        model: 'Модель ИИ',
        reset: 'СБРОСИТЬ ВСЁ',
        checkConnection: 'ПРОВЕРИТЬ ПОДКЛЮЧЕНИЕ',
        checking: 'Проверяем...',
        createdBy: 'Created by Igor Bondarenko'
    },

    levels: {
        A1: 'A1 (Начинающий)',
        A2: 'A2 (Базовый)',
        B1: 'B1 (Средний)',
        B2: 'B2 (Продвинутый)'
    },

    goals: {
        5: '~ 5 мин в день (Лёгкий старт)',
        10: '~ 15 мин в день (Стандарт)',
        15: '~ 25 мин в день (Интенсив)',
        20: '~ 35 мин в день (Хардкор)'
    },

    onboarding: {
        appName: 'WortSchatz Pro',
        intro: 'Умная система изучения немецкого языка с ИИ. Давай настроим твой личный план обучения.',
        nameLabel: 'Как к тебе обращаться?',
        namePlaceholder: 'Твоё имя...',
        nameRequired: 'Пожалуйста, введи имя',
        start: 'НАЧАТЬ',

        languageTitle: 'Язык интерфейса',
        languageHint: 'На этом языке будет интерфейс и переводы слов.',

        levelTitle: 'Твой уровень и цели',
        levelLabel: 'Текущий уровень немецкого',
        interestsLabel: 'Твои интересы (через запятую)',
        interestsPlaceholder: 'Электроника, автомобили, рэп-музыка, баскетбол...',
        interestsHint: 'ИИ будет генерировать карточки и истории на эти темы.',

        paceTitle: 'Темп обучения',
        paceHint: 'Выбери, сколько новых слов ты хочешь учить каждый день. Это определит твою нагрузку.',

        apiTitle: 'ПОСЛЕДНИЙ ШАГ',
        apiSubtitle: 'Мозг приложения',
        apiStep1: 'Перейди на',
        apiStep2: 'Войди с Google-аккаунтом',
        apiStep3: 'Нажми синюю кнопку',
        apiStep4: 'и скопируй его.',
        apiPlaceholder: 'Вставь ключ (AIzaSy...)',
        apiRequired: 'Ввод API ключа обязателен для работы приложения!',
        finish: '🚀 ЗАПУСТИТЬ WORTSCHATZ'
    },

    dashboard: {
        hello: 'Hallo, {name}! 👋',
        league: 'Лига',
        xp: 'XP',
        toNextLeague: 'До лиги «{league}» — {xp} XP',
        maxLeague: 'Максимальная лига достигнута',

        topic: 'Тема',
        dayOf: 'День {current} из {total}',
        daysDone: 'Пройдено дней: {count}',
        wordsInTopic: 'Слов в теме: {count}',

        examTitle: 'Тема завершена!',
        examText: 'Вы прошли все дни темы «{topic}». Пройдите итоговый контроль знаний.',
        examButton: 'ПРОЙТИ КОНТРОЛЬ ТЕМЫ',

        emptyTitle: 'С чего начнём?',
        emptyText: 'Выберите тему — ИИ подберёт набор слов и разложит его по дням.',
        chooseTopic: 'ВЫБРАТЬ ТЕМУ',
        chooseNextTopic: 'ВЫБРАТЬ НОВУЮ ТЕМУ',

        planTitle: 'План на сегодня',
        freeWords: 'Свободные слова',
        review: 'Повторение',
        newWords: 'Новые слова',
        postponed: 'Ещё {count} на очереди — перенесены, чтобы урок не был бесконечным',
        startLesson: 'НАЧАТЬ УРОК ({count})',
        planDone: 'ПЛАН ВЫПОЛНЕН 🎉'
    },

    cycle: {
        newTopic: 'Новая тема',
        intro: 'Выберите, что учим дальше. ИИ подберёт слова под ваш уровень ({level}) и интересы.',
        topicLabel: 'Тема',
        topicPlaceholder: 'Например: Дом',
        topicRequired: 'Введите тему или выберите одну из предложенных.',
        durationLabel: 'Продолжительность',
        durationSummary: '{days} × {goal} слов = <span class="text-amber-500 font-bold">{total} слов</span> в теме',
        generate: 'ПОДОБРАТЬ СЛОВА',

        loadingTitle: 'Подбираем слова',
        loadingTopic: 'Тема «{topic}»',
        loadingProgress: '{done} из {total}',
        loadingHint: 'Большой набор собирается несколькими запросами — это может занять до минуты.',
        emptyResult: 'ИИ не вернул ни одного нового слова. Попробуйте другую тему.',

        previewTitle: 'Тема «{topic}»',
        previewHint: 'Снимите галочки со слов, которые уже знаете.',
        selectedCount: 'Выбрано: <b id="cycle-selected-count" class="text-slate-100">{selected}</b> из {total}',
        daysOfStudy: 'обучения',
        approve: 'НАЧАТЬ ТЕМУ',
        nothingSelected: 'Выберите хотя бы одно слово.',
        belowGoal:
            'Выбрано {count} слов — это меньше дневной нормы ({goal}).\n' +
            'Тема пройдёт за один день. Продолжить?',
        allWordsKnown: 'Все выбранные слова уже есть в словаре.',

        topics: {
            everyday: 'Быт',
            travel: 'Путешествия',
            food: 'Еда',
            work: 'Работа',
            health: 'Здоровье',
            engineRepair: 'Ремонт двигателя',
            carDiagnostics: 'Автодиагностика',
            basketball: 'Баскетбол',
            microelectronics: 'Микросхемотехника',
            electronics: 'Электроника'
        }
    },

    wordTypes: {
        noun: 'сущ.',
        verb: 'глаг.',
        adjective: 'прил.',
        phrase: 'фраза'
    },

    leagues: {
        wooden: 'Деревянная',
        stone: 'Каменная',
        bronze: 'Бронзовая',
        silver: 'Серебряная',
        gold: 'Золотая',
        diamond: 'Алмазная'
    },

    ai: {
        noKey: 'API-ключ не настроен. Добавьте его в настройках.',
        invalidKey: 'Все указанные API-ключи недействительны. Проверьте их в настройках.',
        quota: 'Исчерпан лимит запросов на всех ключах. Подождите минуту и попробуйте снова.',
        overloaded: 'Сервис ИИ перегружен. Попробуйте через минуту.',
        offline: 'Нет связи с сервисом ИИ. Проверьте интернет.',
        network: 'Сбой связи с сервисом ИИ.',
        blocked: 'Ответ заблокирован фильтрами безопасности. Попробуйте другую тему или формулировку.',
        emptyResponse: 'Модель вернула пустой ответ. Попробуйте ещё раз.',
        badJson: 'Ответ модели не удалось разобрать. Попробуйте ещё раз.',
        modelUnavailable: 'Выбранная модель недоступна для вашего ключа.',
        allModelsBusy: 'Все доступные модели сейчас перегружены. Попробуйте через несколько минут.',
        unknown: 'Неизвестная ошибка ИИ.'
    },

    card: {
        synonyms: 'Синонимы',
        antonyms: 'Антонимы'
    },

    training: {
        review: 'ПОВТОРЕНИЕ',
        newWords: 'НОВЫЕ СЛОВА',
        wordOf: 'Слово {current} из {total}',
        showAnswer: 'ПОКАЗАТЬ ОТВЕТ',
        again: 'Снова',
        hard: 'Трудно',
        good: 'Хорошо',
        easy: 'Легко',
        doneTitle: 'Отличная работа!',
        doneText: 'План на сегодня успешно выполнен.',
        learnedNew: 'Выучено новых:',
        reviewed: 'Повторено:',
        xpEarned: 'Получено XP:',
        currentLeague: 'Текущая лига:',
        backToBase: 'ВЕРНУТЬСЯ НА БАЗУ'
    },

    exercises: {
        freeTraining: 'СВОБОДНАЯ ТРЕНИРОВКА',
        practice: 'ПРАКТИКА (ЭТАП 2)',
        taskOf: 'Задание {current} из {total}',
        matchPairs: 'Найдите пары',
        howInGerman: 'Как это будет по-немецки?',
        pickTranslation: 'Выберите верный перевод',
        pickArticle: 'Выберите правильный артикль',
        perfektLabel: 'Perfekt (со вспом. глаголом)',
        writeVerbForm: 'Напишите форму глагола',
        check: 'ПРОВЕРИТЬ',
        fillBlank: 'Заполните пропуск',
        translationLabel: 'Перевод',
        wordPlaceholder: 'Слово...',
        rektionQuestion: 'Какой предлог у этого глагола?',
        rektionCaseQuestion: 'Какой падеж требует этот глагол?',
        rektionCaseHint: 'Падеж: {kase}',
        listening: 'Аудирование',
        writeWhatYouHear: 'Напишите то, что услышали',
        buildSentence: 'Соберите предложение',
        tooHardSkip: 'СЛОЖНО, ПРОПУСТИТЬ',
        tapToRemove: 'Нажмите на слово, чтобы вернуть его в набор.',
        builderHint: 'Нажмите на слово, чтобы убрать его с любой позиции',
        correctAnswer: 'Правильный ответ:',
        correctIs: 'Правильно'
    },

    control: {
        exam: 'ЭКЗАМЕН',
        questionOf: 'Вопрос {current} из {total}',
        translateWord: 'Переведите слово',
        whichArticle: 'Какой артикль?',
        answer: 'ОТВЕТИТЬ',
        notEnoughWords: 'Недостаточно слов для проведения контрольного среза. Нужно минимум 5 изучаемых слов.',
        startFailed: 'Не удалось запустить тестирование.',
        gradeGreat: 'Отличный результат!',
        gradeOk: 'Хорошо, но есть куда расти',
        gradePoor: 'Нужно ещё потренироваться',
        wordsToReview: 'Слова для повторения:',
        mistake: 'Ошибка',
        correctAnswers: 'Верных ответов',
        xpGained: 'Опыта (XP)',
        finishExam: 'ЗАВЕРШИТЬ ЭКЗАМЕН'
    },

    room: {
        title: 'Тренировочная комната',
        microTrainers: 'Микро-тренажёры',
        onlyHard: 'Только сложные',
        modeDeRu: 'Обратный<br>перевод (DE➔RU)',
        modeRuDe: 'Прямой<br>перевод (RU➔DE)',
        modeMatch: 'Найди<br>пару',
        modeArticles: 'Артикли<br>(Der/Die/Das)',
        modeVerbForms: 'Формы<br>глаголов',
        modeContext: 'Слова<br>в контексте',
        modeBuilder: 'Сборка<br>предложений',
        modeRektion: 'Rektion<br>(Управление)',
        modeListening: 'Аудирование на слух',
        immersive: 'Иммерсивные режимы',
        storyTitle: 'Интерактивный ИИ-рассказ',
        storyHint: 'Чтение истории с авто-переводом по клику',
        notEnough: 'Недостаточно подходящих слов для этого режима! Нужно хотя бы 4 слова.',
        notEnoughHard: 'Возможно, у вас нет «сложных» слов такого типа.',
        notEnoughNouns: 'Добавьте в словарь больше существительных (Noun).',
        notEnoughVerbs: 'Добавьте в словарь больше глаголов (Verb) с заполненными формами Präteritum/Perfekt.',
        notEnoughRektion: 'Добавьте глаголы, у которых заполнено поле Rektion (управление).',
        notEnoughExamples: 'Добавьте слова, у которых заполнен пример использования (Пример на DE).',
        doneTitle: 'Тренировка завершена!',
        doneText: 'Отличная разминка в Комнате. Слова закреплены.',
        backToRoom: 'ВЕРНУТЬСЯ В КОМНАТУ',
        emptyDict: 'Ваш словарь пуст. Сначала добавьте слова!',
        storyLoading: 'ИИ сочиняет интерактивную историю...',
        storyHeader: 'Интерактивный рассказ',
        newStory: 'Новая история',
        addWord: 'Добавить',
        added: 'Добавлено!',
        showTranslation: 'ПОКАЗАТЬ ПЕРЕВОД ТЕКСТА',
        hideTranslation: 'СКРЫТЬ ПЕРЕВОД ТЕКСТА',
        searching: 'Ищем «{word}»...',
        alreadyInDict: '(уже в словаре)',
        translateFailed: 'Не удалось перевести «{word}»',
        usedExample: 'Он использовал {word}.'
    },

    scanner: {
        title: 'Добавление слов',
        tabSingle: 'Одно слово',
        tabTopic: 'Тема целиком',
        tabText: 'Текст',
        wordLabel: 'Немецкое слово или фраза',
        wordPlaceholder: 'Например: Leistung...',
        topicLabel: 'Какую тему сгенерировать?',
        topicPlaceholder: 'Еда, Путешествия, Схемотехника...',
        countLabel: 'Количество слов (до 30)',
        generate: 'СГЕНЕРИРОВАТЬ',
        textLabel: 'Текст для анализа',
        textPlaceholder: 'Вставьте немецкий текст сюда...',
        analyze: 'ПРОАНАЛИЗИРОВАТЬ',
        loadingWord: 'Анализируем слово «{word}»...',
        loadingTopic: 'Нейросеть собирает {count} слов на тему «{topic}»...',
        loadingText: 'Анализируем текст, ищем полезные слова...',
        topicMisc: 'Разное',
        topicDefault: 'Повседневная жизнь',
        topicFromText: 'Из текста',
        nothingFound: 'Ничего не найдено.',
        selected: 'Выбрано',
        nothingSelected: 'Выберите хотя бы одно слово для сохранения!',
        savedTitle: 'Успешно сохранено!',
        savedCount: 'Добавлено новых слов',
        goToPlan: 'ПЕРЕЙТИ К ПЛАНУ'
    },

    chat: {
        title: 'AI-Репетитор',
        online: 'Онлайн',
        greeting: 'Hallo, {name}! Я твой ИИ-репетитор. Мы можем просто поболтать на немецком, а если ты сделаешь ошибку — я мягко её исправлю. О чём хочешь поговорить сегодня?',
        speak: 'Озвучить',
        roleTutor: 'Репетитор',
        roleStudent: 'Студент',
        networkError: 'Извините, произошла ошибка сети. Попробуйте ещё раз.',
        clearConfirm: 'Вы уверены, что хотите очистить историю чата?'
    },

    profile: {
        title: 'Профиль и данные',
        searchPlaceholder: 'Поиск по слову, переводу, теме...',
        filterAll: 'Все',
        shownCount: 'Показано {shown} из {total}',
        nothingFound: 'Ничего не найдено',
        toggleHard: 'Отметить как сложное',
        status: { all: 'Все', difficult: 'Сложные', learning: 'В изучении', mastered: 'Выучено' },
        sort: { recent: 'Сначала новые', alphabet: 'По алфавиту', mastery: 'Сначала слабые' },
        tabStats: 'Статистика',
        tabDict: 'Мой словарь',
        defaultName: 'Студент',
        wordCard: 'Карточка слова',
        germanWord: 'Слово на немецком',
        translation: 'Перевод',
        exampleDe: 'Пример на немецком',
        exampleTranslation: 'Перевод примера',
        currentLeague: 'Текущая лига',
        maxLeague: 'Максимум',
        xpMax: '{xp} XP (макс.)',
        activity: 'Активность за 30 дней',
        today: 'сегодня',
        noActivity: 'занятий не было',
        xpWeek: 'XP за неделю',
        xpMonth: 'XP за месяц',
        activeDays: 'дней с занятиями',
        dictStats: 'Статистика словаря',
        totalWords: 'Всего слов',
        mastered: 'Выучено (100%)',
        difficult: 'Сложные',
        weakSpots: 'Слабые места (Топ 5)',
        statsError: 'Ошибка загрузки статистики',
        mistakes: { one: '{count} ошибка', few: '{count} ошибки', many: '{count} ошибок', other: '{count} ошибки' },
        noMistakes: 'Ошибок пока нет. Отличная работа!',
        export: 'ЭКСПОРТ',
        import: 'ИМПОРТ',
        emptyDict: 'Ваш словарь пока пуст.',
        mastery: 'Освоение: {percent}%',
        hardBadge: 'Сложное',
        deleteConfirm: 'Удалить слово «{word}» из словаря?',
        exportEmpty: 'Словарь пуст, нечего экспортировать!',
        unknownFormat: 'Неизвестный формат файла',
        unknownDate: 'неизвестно когда',
        importFailed: 'Не удалось прочитать файл. Убедитесь, что это резервная копия WortSchatz.',
        importChoice: 'Резервная копия от {date}: слов — {words}, тем — {cycles}.\n\nОК — полное восстановление: текущие словарь и прогресс будут заменены копией.\nОтмена — только добавить слова из копии к текущему словарю.',
        restored: 'Восстановлено:\n• слов — {words}\n• тем — {cycles}\n• дней плана — {dayPlans}\n\nПрогресс, XP и лига восстановлены. Приложение перезагрузится.',
        mergedFromBackup: 'Добавлено новых слов: {count}. Прогресс по ним сохранён из копии.',
        importedLegacy: 'Импортировано слов: {count}.\n\nЭто копия старого формата — в ней нет данных о прогрессе, слова добавлены как новые.'
    }
};
