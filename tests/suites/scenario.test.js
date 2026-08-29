import { группа, тест, проверить } from '../runner.js';

/*
 * Сквозные проверки: путь целиком, а не отдельная функция.
 *
 * Остальные наборы проверяют чистую логику — правило склонения, формулу
 * интервала, разбор статьи. Они ловят ошибку внутри модуля и молчат про
 * ошибку между модулями: когда две верные по отдельности части не
 * сходятся. Именно такие и обходились дороже всего — двойной зачёт
 * ответа в сборке предложения, запись, уезжавшая обратно в облако,
 * слово, не попавшее в план после миграции.
 *
 * База здесь отдельная: имя подменяется до импорта, словарь живого
 * человека эти проверки не видят и не трогают.
 */


const { db, dbService } = await import('../../js/services/db.js');
const { srs } = await import('../../js/core/srs.js');
const { masteryUtils } = await import('../../js/core/mastery.js');
const { scheduler } = await import('../../js/core/scheduler.js');
const { exercises } = await import('../../js/modules/exercises.js');
const { migrations } = await import('../../js/services/migrations.js');
const { frequency } = await import('../../js/core/frequency.js');
const { dateUtils } = await import('../../js/core/dates.js');
const { germanUtils } = await import('../../js/core/german.js');

проверить.равно(db.name, 'WortSchatzTestDB', 'проверки идут по отдельной базе');

const очистить = async () => {
    await db.words.clear();
    await db.cycles.clear();
    await db.dayPlans.clear();
    await db.stats.clear();
    await db.mistakes.clear();
    await db.lessonState.clear();
};

const НАБОР = [
    { word: 'die Tür', translation: 'дверь', type: 'noun', gender: 'die', plural: 'die Türen',
      topic: 'Быт', example_de: 'Die Tür ist zu.', example_ru: 'Дверь закрыта.' },
    { word: 'die Waschmaschine', translation: 'стиральная машина', type: 'noun', gender: 'die',
      topic: 'Быт', example_de: 'Die Waschmaschine läuft.', example_ru: 'Машина работает.' },
    { word: 'laufen', translation: 'бежать', type: 'verb', preterite: 'lief', participle_ii: 'gelaufen',
      conjugation: { ich: 'laufe', du: 'läufst', er: 'läuft' },
      topic: 'Быт', example_de: 'Das Kind läuft.', example_ru: 'Ребёнок бежит.' },
    { word: 'hell', translation: 'светлый', type: 'adjective', comparative: 'heller',
      topic: 'Быт', example_de: 'Der Raum ist hell.', example_ru: 'Комната светлая.' }
];

группа('Сквозная: слово доходит от словаря до задания', () => {

    тест('добавленное слово попадает в план и получает посильное задание', async () => {
        await очистить();
        const { count } = await dbService.saveMultipleWords(НАБОР);
        проверить.равно(count, 4, 'все четыре сохранились');

        const план = await scheduler.getDailyPlan();
        проверить.равно(план.newWords.length, 4, 'новые слова попали в план на сегодня');
        проверить.равно(план.review.length, 0, 'повторять пока нечего');

        // Задание выбирается по этапу слова и должно быть ему посильно
        const слова = await dbService.getAllWords();
        for (const слово of слова) {
            const доступные = ['translation_de_ru', 'translation_ru_de', 'match_pairs'];
            if (germanUtils.hasKnownArticle(слово)) доступные.push('article');
            if (слово.type === 'verb' && слово.preterite) доступные.push('verb_form');
            if (слово.example_de) доступные.push('fill_blanks', 'sentence_builder');

            const режим = exercises.pickByStage(слово, доступные);
            проверить.содержит(доступные, режим, `${слово.word}: режим из посильных`);

            // Главная ловушка: артикль у глагола и прилагательного
            if (слово.type !== 'noun') {
                проверить.ложь(режим === 'article', `${слово.word}: артикль не спрашиваем`);
            }
        }

        await очистить();
    });

    тест('глагол без форм не получает задание на форму глагола', async () => {
        await очистить();
        await dbService.saveMultipleWords([
            { word: 'schwimmen', translation: 'плавать', type: 'verb', topic: 'Быт' }
        ]);

        const [слово] = await dbService.getAllWords();
        const доступные = ['translation_de_ru'];
        if (слово.type === 'verb' && (слово.preterite || слово.participle_ii)) доступные.push('verb_form');

        проверить.ложь(доступные.includes('verb_form'), 'форм нет — задания тоже');
        await очистить();
    });
});

группа('Сквозная: ответы двигают слово по интервалам', () => {

    тест('четыре верных ответа выводят слово из заучивания в повторение', async () => {
        await очистить();
        await dbService.saveMultipleWords([НАБОР[0]]);
        let [слово] = await dbService.getAllWords();

        const этапы = [];
        for (let i = 0; i < 4; i++) {
            слово = { ...слово, ...srs.calculate(3, слово) };
            слово = { ...слово, ...masteryUtils.registerAnswer(слово, true) };
            await dbService.putWord(слово);
            слово = await db.words.get(слово.id);
            этапы.push({ интервал: слово.interval, фаза: слово.phase, освоенность: слово.mastery });
        }

        проверить.истина(этапы[3].интервал > этапы[0].интервал, 'интервал растёт');
        проверить.равно(этапы[3].фаза, 'review', 'слово перешло к повторению');
        проверить.истина(этапы[3].освоенность > этапы[0].освоенность, 'освоенность растёт');
        проверить.истина(слово.correct === 4 && слово.attempts === 4, 'история ответов накопилась');

        await очистить();
    });

    тест('провал возвращает слово в заучивание и роняет освоенность', async () => {
        await очистить();
        await dbService.saveMultipleWords([НАБОР[0]]);
        let [слово] = await dbService.getAllWords();

        // Порядок как в приложении: сперва интервал, потом ответ по уже
        // обновлённому слову. registerAnswer меняет слово на месте, и при
        // обратном порядке он затирает свежий интервал старым
        for (let i = 0; i < 4; i++) {
            слово = { ...слово, ...srs.calculate(3, слово) };
            masteryUtils.registerAnswer(слово, true);
        }
        await dbService.putWord(слово);
        const сохранено = await db.words.get(слово.id);
        const до = сохранено.mastery;
        const слово_до_провала = сохранено.interval;

        слово = { ...слово, ...srs.calculate(1, слово) };
        masteryUtils.registerAnswer(слово, false);
        await dbService.putWord(слово);
        const после = await db.words.get(слово.id);

        проверить.истина(после.mastery < до, `освоенность упала: ${до} → ${после.mastery}`);

        // Интервал именно ополовинивается, а не сбрасывается: прежний
        // прогресс не сгорает целиком — так задумано в core/srs.js
        проверить.истина(после.interval < слово_до_провала, "интервал уменьшился");
        проверить.равно(после.phase, "learning", "слово вернулось в заучивание");
        // Отдельного счётчика провалов в схеме нет: возврат в заучивание
        // и укороченный интервал и есть его след

        await очистить();
    });
});

группа('Сквозная: старое слово переживает миграции и попадает в план', () => {

    тест('запись первой версии схемы доходит до сегодняшнего плана', async () => {
        await очистить();

        // Ровно то, что лежало бы у человека, поставившего приложение давно
        let древнее = {
            word: 'der Tisch', translation: 'стол', type: 'noun',
            present: 'ich stehe, du stehst', interval: 30, repetitions: 6,
            createdAt: Date.now() - 90 * 86400000,
            nextReview: Date.now() - 86400000        // повторить надо было вчера
        };

        древнее = migrations.toV2(древнее);
        древнее = migrations.toV3(древнее, Date.now());
        древнее = migrations.toV4(древнее);
        древнее = migrations.toV5(древнее, Date.now());

        проверить.равно(древнее.gender, 'der', 'род вытащен из слова');
        проверить.истина(древнее.mastery > 60, 'освоенность посчитана из интервала');

        await db.words.add(древнее);
        const план = await scheduler.getDailyPlan();

        проверить.равно(план.review.length, 1, 'просроченное слово попало в повторение');
        проверить.равно(план.review[0].word, 'der Tisch');

        // И задание ему достаётся из старших этапов, а не из узнавания
        проверить.равно(exercises.getStage(план.review[0]), 'production', 'слово давно знакомо');

        await очистить();
    });
});

группа('Сквозная: частотность управляет порядком набора', () => {

    тест('утверждённый набор ложится в план от ходовых к редким', async () => {
        await очистить();
        await frequency.load();

        // Порядок как от модели: вперемешку
        const отМодели = [НАБОР[1], НАБОР[3], НАБОР[0], НАБОР[2]];
        const разложено = frequency.sort(отМодели);

        await dbService.saveMultipleWords(разложено);
        const план = await scheduler.getDailyPlan();

        const места = план.newWords.map(w => frequency.rank(w.word) ?? Infinity);
        const поПорядку = места.every((m, i) => i === 0 || места[i - 1] <= m);

        проверить.истина(поПорядку, `порядок в плане: ${места.join(' → ')}`);
        проверить.равно(план.newWords[0].word, 'die Tür', 'самое ходовое первым');

        await очистить();
    });
});

группа('Сквозная: резервная копия переживает круг', () => {

    тест('выгрузка и восстановление не теряют ни слова, ни прогресса', async () => {
        await очистить();
        await dbService.saveMultipleWords(НАБОР);

        let [слово] = await dbService.getAllWords();
        слово = { ...слово, ...srs.calculate(3, слово) };
        masteryUtils.registerAnswer(слово, true);
        await dbService.putWord(слово);
        await dbService.addXP(40);

        const копия = await dbService.exportAll();
        проверить.равно(копия.words.length, 4);
        проверить.ложь(JSON.stringify(копия).includes('api_key'), 'ключ ИИ в копию не попадает');

        await очистить();
        проверить.равно((await dbService.getAllWords()).length, 0, 'база пуста перед восстановлением');

        const итог = await dbService.restoreFromBackup(копия);
        проверить.равно(итог.words, 4);

        const восстановленные = await dbService.getAllWords();
        проверить.равно(восстановленные.length, 4);

        const тот = восстановленные.find(w => w.word === слово.word);
        проверить.равно(тот.interval, слово.interval, 'интервал уцелел');
        проверить.равно(тот.mastery, слово.mastery, 'освоенность уцелела');

        const пользователь = await dbService.getUser();
        проверить.истина(пользователь.totalXP >= 40, 'опыт уцелел');

        await очистить();
    });
});

группа('Сквозная: мягкое удаление доезжает до облака', () => {

    тест('удалённое слово уходит из выдачи, но остаётся для обмена', async () => {
        await очистить();
        await dbService.saveMultipleWords([НАБОР[0]]);
        const [слово] = await dbService.getAllWords();

        await dbService.deleteWord(слово.id);

        проверить.равно((await dbService.getAllWords()).length, 0, 'из словаря исчезло');
        проверить.равно(await db.words.count(), 1, 'из таблицы — нет');

        const запись = await db.words.get(слово.id);
        проверить.истина(запись.deletedAt > 0, 'помечено удалённым');
        проверить.истина(запись.updatedAt >= запись.deletedAt - 1000, 'метка изменения обновлена');

        const план = await scheduler.getDailyPlan();
        проверить.равно(план.newWords.length, 0, 'в план не попадает');

        await очистить();
    });
});

/*
 * Серия дней и опыт пишутся в одну запись.
 *
 * Владелец сообщил: серия пропала, а начисленные за тот же урок очки
 * остались. Причина оказалась в том, что запись пользователя одна на
 * всё — опыт, лига, серия, дата последнего занятия, — а писали в неё
 * двое: начисление опыта и отметка о пройденном уроке. Оба читали
 * запись целиком и клали обратно целиком. Кто прочитал раньше, а
 * записал позже, тот и затирал чужое.
 *
 * В конце урока эти двое приходят с разницей в миллисекунды, поэтому
 * ловилось это не всегда — и выглядело как случайная пропажа.
 */
группа('Серия дней переживает одновременное начисление опыта', () => {

    тест('серия и опыт не затирают друг друга', async () => {
        const { scheduler } = await import('../../js/core/scheduler.js');

        await db.user.clear();
        await dbService.saveUser({ totalXP: 100, currentStreak: 0, lastActiveDate: null });

        // Ровно тот порядок, что и в конце урока: последнее задание
        // начисляет опыт, и почти сразу отмечается пройденный урок
        const [, серия] = await Promise.all([
            dbService.addXP(40, { reviews: 1 }),
            scheduler.registerLessonCompleted()
        ]);

        const запись = await dbService.getUser();

        проверить.равно(запись.totalXP, 140, 'опыт потерян');
        проверить.равно(запись.currentStreak, 1, 'серия затёрта начислением опыта');
        проверить.равно(серия, 1, 'функция вернула не то, что записала');
        проверить.истина(!!запись.lastActiveDate, 'дата последнего занятия не записалась');
    });

    тест('повторный вызов за тот же день серию не растит', async () => {
        const { scheduler } = await import('../../js/core/scheduler.js');

        await db.user.clear();
        await dbService.saveUser({ totalXP: 0, currentStreak: 0, lastActiveDate: null });

        const первый = await scheduler.registerLessonCompleted();
        const второй = await scheduler.registerLessonCompleted();

        проверить.равно(первый, 1);
        проверить.равно(второй, 1, 'второй урок за день добавил лишний день серии');
    });

    тест('частичное изменение не сносит остальные поля', async () => {
        // updateUser пишет только переданное, остальное берёт из базы
        // под той же транзакцией
        await db.user.clear();
        await dbService.saveUser({ totalXP: 555, currentStreak: 7, league: 'stone', lastActiveDate: '2026-01-01' });

        await dbService.updateUser({ currentStreak: 0 });
        const запись = await dbService.getUser();

        проверить.равно(запись.currentStreak, 0, 'изменение не применилось');
        проверить.равно(запись.totalXP, 555, 'опыт снесён частичным изменением');
        проверить.равно(запись.league, 'stone', 'лига снесена');
        проверить.равно(запись.lastActiveDate, '2026-01-01', 'дата снесена');
    });
});

/*
 * Восстановление серии по журналу занятий.
 *
 * Понадобилось после того, как серия пропала из-за одновременной записи
 * с опытом: счётчик уже не вернуть, а журнал активности цел. Журнал
 * ведётся отдельно и на каждый день хранит опыт и число карточек.
 *
 * Тонкость, ради которой это вообще работает: счётчики карточек ставит
 * только урок. Комната и контроль темы пишут один опыт, без карточек, —
 * значит разминка не выдаёт себя за учебный день.
 */
группа('Серия восстанавливается по журналу занятий', () => {

    /** Пишет в журнал день: дату и что в нём было. */
    const день = async (сдвиг, { xp = 10, reviews = 0, newWords = 0 }) => {
        const дата = dateUtils.addDays(dateUtils.today(), -сдвиг);
        await db.stats.add({ date: дата, xp, reviewsCount: reviews, newWordsCount: newWords, updatedAt: Date.now() });
    };

    тест('считает дни подряд, начиная с сегодня', async () => {
        const { scheduler } = await import('../../js/core/scheduler.js');
        await db.stats.clear();

        for (const сдвиг of [0, 1, 2]) await день(сдвиг, { newWords: 5 });
        await день(4, { newWords: 5 });   // после разрыва — не считается

        проверить.равно(await scheduler.streakFromActivity(), 3);
    });

    тест('пустой сегодняшний день серию не рвёт', async () => {
        // До конца суток серия ещё жива: человек просто не сел заниматься
        const { scheduler } = await import('../../js/core/scheduler.js');
        await db.stats.clear();

        for (const сдвиг of [1, 2]) await день(сдвиг, { reviews: 4 });

        проверить.равно(await scheduler.streakFromActivity(), 2);
    });

    тест('дни только с опытом за учебные не считаются', async () => {
        /*
         * Тренировка в Комнате начисляет опыт, но карточек не показывает
         * и серию не растит. Если бы восстановление считало любой опыт,
         * оно дарило бы дни за разминку.
         */
        const { scheduler } = await import('../../js/core/scheduler.js');
        await db.stats.clear();

        await день(0, { xp: 30, reviews: 0, newWords: 0 });
        await день(1, { xp: 30, reviews: 0, newWords: 0 });

        проверить.равно(await scheduler.streakFromActivity(), 0);
    });

    тест('восстановление ставит и счётчик, и дату', async () => {
        const { scheduler } = await import('../../js/core/scheduler.js');
        await db.stats.clear();
        await db.user.clear();
        await dbService.saveUser({ totalXP: 200, currentStreak: 0, lastActiveDate: null });

        for (const сдвиг of [0, 1, 2, 3]) await день(сдвиг, { newWords: 5 });

        const найдено = await scheduler.streakFromActivity();
        await scheduler.restoreStreak(найдено);

        const запись = await dbService.getUser();
        проверить.равно(запись.currentStreak, 4, 'счётчик не восстановлен');
        проверить.равно(запись.lastActiveDate, dateUtils.today(), 'дата последнего занятия не проставлена');
        проверить.равно(запись.totalXP, 200, 'восстановление снесло опыт');

        // И серия должна считаться живой сразу после восстановления
        проверить.равно(scheduler.getStreakValue(запись), 4, 'восстановленная серия не признаётся живой');
    });
});
