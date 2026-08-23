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
    }
};
