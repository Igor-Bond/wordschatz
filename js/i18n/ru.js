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
    }
};
