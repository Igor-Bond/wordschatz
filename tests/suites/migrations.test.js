import { группа, тест, проверить } from '../runner.js';
import { migrations, computeMastery, parsePresentString } from '../../js/services/migrations.js';

группа('Миграции базы', () => {

    тест('версия 2 присваивает статус старым словам', () => {
        const word = migrations.toV2({ word: 'der Tisch' });
        проверить.равно(word.status, 'existing');
        проверить.равно(word.mastery, 0);
        проверить.равно(word.cycleId, null);
    });

    тест('версия 2 не трогает уже заполненное', () => {
        const word = migrations.toV2({ word: 'x', status: 'new', mastery: 40, cycleId: 7 });
        проверить.равно(word.status, 'new');
        проверить.равно(word.mastery, 40);
        проверить.равно(word.cycleId, 7);
    });

    тест('версия 2 сохраняет нулевую освоенность, а не подменяет её', () => {
        // typeof, а не проверка на истинность: 0 — законное значение
        const word = migrations.toV2({ word: 'x', mastery: 0 });
        проверить.равно(word.mastery, 0);
    });

    тест('версия 3 берёт метку из даты создания', () => {
        const rec = migrations.toV3({ createdAt: 1000 }, 9999);
        проверить.равно(rec.updatedAt, 1000, 'дата создания честнее, чем «сейчас»');
        проверить.равно(rec.deletedAt, null);
    });

    тест('версия 3 без даты создания ставит текущее время', () => {
        const rec = migrations.toV3({}, 9999);
        проверить.равно(rec.updatedAt, 9999);
    });

    тест('версия 3 не воскрешает удалённое', () => {
        const rec = migrations.toV3({ createdAt: 1, deletedAt: 555 }, 9999);
        проверить.равно(rec.deletedAt, 555);
    });

    тест('версия 4 вытаскивает род из слова', () => {
        проверить.равно(migrations.toV4({ word: 'der Tisch' }).gender, 'der');
        проверить.равно(migrations.toV4({ word: 'die Lampe' }).gender, 'die');
        проверить.равно(migrations.toV4({ word: 'das Fenster' }).gender, 'das');
    });

    тест('версия 4 не выдумывает род там, где его нет', () => {
        проверить.равно(migrations.toV4({ word: 'machen' }).gender, null, 'глагол');
        проверить.равно(migrations.toV4({ word: 'Tisch' }).gender, null, 'без артикля');
        проверить.равно(migrations.toV4({ word: '' }).gender, null, 'пустое');
        проверить.равно(migrations.toV4({}).gender, null, 'слова нет вовсе');
    });

    тест('версия 4 не принимает за артикль первое слово фразы', () => {
        проверить.равно(migrations.toV4({ word: 'Deutsch lernen' }).gender, null);
    });

    тест('версия 4 разбирает спряжение строкой', () => {
        const word = migrations.toV4({ word: 'machen', present: 'ich mache, du machst, er/sie/es macht' });
        проверить.равно(word.conjugation.ich, 'mache');
        проверить.равно(word.conjugation.du, 'machst');
        проверить.равно(word.conjugation.er, 'macht');
    });

    тест('версия 4 отмечает карточку непроверенной', () => {
        проверить.равно(migrations.toV4({ word: 'x' }).verified, 0);
        проверить.равно(migrations.toV4({ word: 'x', verified: 1 }).verified, 1, 'проверенную не сбрасываем');
    });

    тест('версия 5 заводит историю ответов', () => {
        const word = migrations.toV5({ interval: 0, repetitions: 0 }, 500);
        проверить.истина(Array.isArray(word.recent));
        проверить.равно(word.attempts, 0);
        проверить.равно(word.correct, 0);
        проверить.равно(word.updatedAt, 500);
    });

    тест('версия 5 пересчитывает освоенность из интервала', () => {
        // Прежнее значение росло и от ответа «Снова» — доверять ему нельзя
        const word = migrations.toV5({ interval: 30, repetitions: 5, mastery: 100 }, 1);
        проверить.вПределах(word.mastery, 80, 86, "месячный интервал — восемьдесят с небольшим");

        const свежее = migrations.toV5({ interval: 0, repetitions: 1, mastery: 95 }, 1);
        проверить.равно(свежее.mastery, 8, 'слово без интервала не может быть освоенным');
    });

    тест('версия 5 не теряет уже накопленную историю', () => {
        const word = migrations.toV5({ interval: 10, repetitions: 3, recent: [1, 0, 1], attempts: 3, correct: 2 }, 1);
        проверить.равно(word.recent.length, 3);
        проверить.равно(word.attempts, 3);
        проверить.равно(word.correct, 2);
    });

    тест('порядок версий: слово из первой версии доходит до пятой целым', () => {
        // Настоящий путь пользователя, который поставил приложение давно
        let word = { id: 1, word: 'der Tisch', translation: 'стол', type: 'noun',
                     present: 'ich stehe, du stehst', interval: 14, repetitions: 4, createdAt: 100 };

        word = migrations.toV2(word);
        word = migrations.toV3(word, 200);
        word = migrations.toV4(word);
        word = migrations.toV5(word, 300);

        проверить.равно(word.status, 'existing');
        проверить.равно(word.updatedAt, 300, 'последняя миграция обновляет метку');
        проверить.равно(word.deletedAt, null);
        проверить.равно(word.gender, 'der');
        проверить.равно(word.conjugation.ich, 'stehe');
        проверить.равно(word.verified, 0);
        проверить.вПределах(word.mastery, 65, 72, "двухнедельный интервал");
        проверить.равно(word.word, 'der Tisch', 'само слово не пострадало');
        проверить.равно(word.translation, 'стол');
    });
});

группа('Разбор строки спряжения', () => {

    тест('обычная строка', () => {
        const r = parsePresentString('ich gehe, du gehst, er geht, wir gehen, ihr geht');
        проверить.равно(r.ich, 'gehe');
        проверить.равно(r.wir, 'gehen');
        проверить.равно(r.ihr, 'geht');
    });

    тест('sie и es считаются третьим лицом', () => {
        проверить.равно(parsePresentString('sie macht').er, 'macht');
        проверить.равно(parsePresentString('es regnet').er, 'regnet');
    });

    тест('первое совпадение выигрывает', () => {
        проверить.равно(parsePresentString('er geht; sie läuft').er, 'geht');
    });

    тест('точка с запятой тоже разделитель', () => {
        проверить.равно(parsePresentString('ich bin; du bist').du, 'bist');
    });

    тест('разобрать нечего — null, а не пустой объект', () => {
        проверить.равно(parsePresentString(''), null);
        проверить.равно(parsePresentString(null), null);
        проверить.равно(parsePresentString('какая-то ерунда'), null);
    });

    тест('умляуты в формах не мешают', () => {
        проверить.равно(parsePresentString('du fährst, er läuft').du, 'fährst');
    });
});

группа('Освоенность при миграции', () => {

    тест('без интервала растёт только от повторений', () => {
        проверить.равно(computeMastery({ interval: 0, repetitions: 0 }), 0);
        проверить.равно(computeMastery({ interval: 0, repetitions: 2 }), 16);
        проверить.равно(computeMastery({ interval: 0, repetitions: 10 }), 25, 'потолок этапа заучивания');
    });

    тест('шкала растёт вместе с интервалом', () => {
        const день = computeMastery({ interval: 1, repetitions: 2 });
        const неделя = computeMastery({ interval: 7, repetitions: 3 });
        const месяц = computeMastery({ interval: 30, repetitions: 5 });
        const год = computeMastery({ interval: 365, repetitions: 9 });

        проверить.истина(день < неделя, 'день меньше недели');
        проверить.истина(неделя < месяц, 'неделя меньше месяца');
        проверить.истина(месяц < год, 'месяц меньше года');
        проверить.равно(год, 100, 'верхняя граница');
    });

    тест('порог «освоено» приходится на три недели', () => {
        // masteryUtils считает освоенным интервал от 21 дня
        проверить.равно(computeMastery({ interval: 21, repetitions: 5 }), 80);
    });
});
