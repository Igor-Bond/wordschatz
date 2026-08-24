import { группа, тест, проверить } from '../runner.js';
import { frequency } from '../../js/core/frequency.js';

/*
 * Список подключается по требованию, поэтому один раз грузим его здесь.
 * Проверки идут по настоящим данным: подставной список ничего не сказал
 * бы о том, попадают ли наши карточки в него вообще.
 */
await frequency.load();

группа('Частотность: приведение к начальной форме', () => {

    тест('артикль отбрасывается', () => {
        проверить.равно(frequency.normalise('der Tisch'), 'tisch');
        проверить.равно(frequency.normalise('die Tür'), 'tür');
        проверить.равно(frequency.normalise('das Fenster'), 'fenster');
    });

    тест('возвратное «sich» не мешает', () => {
        проверить.равно(frequency.normalise('sich freuen'), 'freuen');
    });

    тест('в составной записи берём первое слово', () => {
        // «warten auf + Akk.» — значение несёт глагол, а не предлог
        проверить.равно(frequency.normalise('warten auf + Akk.'), 'warten');
    });

    тест('знаки препинания снимаются', () => {
        проверить.равно(frequency.normalise('  Tisch,  '), 'tisch');
        проверить.равно(frequency.normalise('geht’s'), 'gehts');
    });

    тест('пустое не ломает разбор', () => {
        проверить.равно(frequency.normalise(''), '');
        проверить.равно(frequency.normalise(null), '');
    });
});

группа('Частотность: место в списке', () => {

    тест('список загружен и не пуст', () => {
        проверить.истина(frequency.ready);
        проверить.истина(frequency.rank('und') > 0, 'служебные слова в самом верху');
    });

    тест('ходовые слова в первой тысяче', () => {
        for (const w of ['die Tür', 'der Tisch', 'laufen', 'das Fenster']) {
            const место = frequency.rank(w);
            проверить.истина(место !== null && место <= 1000, `${w}: ${место}`);
        }
    });

    тест('бытовая техника заметно ниже', () => {
        // Ровно та разница, ради которой всё затевалось: и «дверь», и
        // «стиральная машина» одинаково уверенно приходят от модели
        проверить.истина(frequency.rank('die Waschmaschine') > 5000);
        проверить.истина(frequency.rank('die Tür') < frequency.rank('die Waschmaschine'));
    });

    тест('составных терминов в списке нет — это тоже ответ', () => {
        проверить.равно(frequency.rank('Mikroelektronik'), null);
        проверить.равно(frequency.band('Mikroelektronik'), 'unknown');
    });

    тест('регистр не важен', () => {
        проверить.равно(frequency.rank('TISCH'), frequency.rank('tisch'));
    });
});

группа('Частотность: полосы', () => {

    тест('границы полос', () => {
        проверить.равно(frequency.band('die Tür'), 'core', 'до тысячи');
        проверить.равно(frequency.band('die Waschmaschine'), 'rare', 'ниже пяти тысяч');
        проверить.равно(frequency.band('нетакогослова'), 'unknown');
    });

    тест('у каждого слова ровно одна полоса', () => {
        for (const w of ['und', 'der Tisch', 'gemütlich', 'die Waschmaschine', 'абракадабра']) {
            проверить.содержит(['core', 'common', 'rare', 'unknown'], frequency.band(w), w);
        }
    });
});

группа('Частотность: сортировка и сводка', () => {

    const набор = [
        { word: 'die Waschmaschine' },
        { word: 'die Tür' },
        { word: 'Mikroelektronik' },
        { word: 'laufen' }
    ];

    тест('частые впереди, неизвестные в конце', () => {
        const итог = frequency.sort(набор).map(w => w.word);
        проверить.равно(итог[итог.length - 1], 'Mikroelektronik', 'неизвестное последним');
        проверить.истина(итог.indexOf('die Tür') < итог.indexOf('die Waschmaschine'));
    });

    тест('исходный список не меняется', () => {
        const было = набор.map(w => w.word).join(',');
        frequency.sort(набор);
        проверить.равно(набор.map(w => w.word).join(','), было);
    });

    тест('сводка считает по полосам и даёт полезное число', () => {
        const с = frequency.summarise(набор);
        проверить.равно(с.всего, 4);
        проверить.равно(с.core + с.common + с.rare + с.unknown, 4, 'каждое слово учтено один раз');
        проверить.равно(с.полезных, с.core + с.common);
        проверить.равно(с.unknown, 1);
    });

    тест('пустой набор не ломает сводку', () => {
        const с = frequency.summarise([]);
        проверить.равно(с.всего, 0);
        проверить.равно(с.полезных, 0);
    });
});
