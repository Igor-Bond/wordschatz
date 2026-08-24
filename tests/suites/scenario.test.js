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
