import { группа, тест, проверить } from '../runner.js';
import { declension } from '../../js/core/declension.js';

группа('Склонение прилагательных', () => {

    тест('после определённого артикля', () => {
        // Слабое склонение: артикль уже показал род и падеж,
        // прилагательному остаётся -e или -en
        проверить.равно(declension.form('hell', 'weak', 'm', 'nominativ'), 'helle');
        проверить.равно(declension.form('hell', 'weak', 'm', 'akkusativ'), 'hellen');
        проверить.равно(declension.form('hell', 'weak', 'f', 'nominativ'), 'helle');
        проверить.равно(declension.form('hell', 'weak', 'n', 'nominativ'), 'helle');
        проверить.равно(declension.form('hell', 'weak', 'pl', 'nominativ'), 'hellen');
        проверить.равно(declension.form('hell', 'weak', 'f', 'dativ'), 'hellen');
    });

    тест('после неопределённого артикля', () => {
        // Смешанное: «ein» не показывает род, окончание берёт это на себя
        проверить.равно(declension.form('hell', 'mixed', 'm', 'nominativ'), 'heller');
        проверить.равно(declension.form('hell', 'mixed', 'n', 'nominativ'), 'helles');
        проверить.равно(declension.form('hell', 'mixed', 'f', 'nominativ'), 'helle');
        проверить.равно(declension.form('hell', 'mixed', 'm', 'akkusativ'), 'hellen');
        проверить.равно(declension.form('hell', 'mixed', 'n', 'dativ'), 'hellen');
    });

    тест('без артикля', () => {
        // Сильное: показать род и падеж больше некому
        проверить.равно(declension.form('hell', 'strong', 'm', 'nominativ'), 'heller');
        проверить.равно(declension.form('hell', 'strong', 'n', 'nominativ'), 'helles');
        проверить.равно(declension.form('hell', 'strong', 'm', 'dativ'), 'hellem');
        проверить.равно(declension.form('hell', 'strong', 'f', 'dativ'), 'heller');
        проверить.равно(declension.form('hell', 'strong', 'pl', 'nominativ'), 'helle');
        проверить.равно(declension.form('hell', 'strong', 'pl', 'dativ'), 'hellen');
    });

    тест('дательный падеж почти везде даёт -en', () => {
        // Единственное исключение — сильное склонение, где артикля нет
        for (const gender of declension.GENDERS) {
            проверить.равно(declension.form('hell', 'weak', gender, 'dativ'), 'hellen', `слабое, ${gender}`);
            проверить.равно(declension.form('hell', 'mixed', gender, 'dativ'), 'hellen', `смешанное, ${gender}`);
        }
    });

    тест('hoch теряет c', () => {
        проверить.равно(declension.form('hoch', 'weak', 'm', 'nominativ'), 'hohe');
        проверить.равно(declension.form('hoch', 'strong', 'n', 'nominativ'), 'hohes');
    });

    тест('в -el и -er выпадает e', () => {
        проверить.равно(declension.form('dunkel', 'weak', 'f', 'nominativ'), 'dunkle');
        проверить.равно(declension.form('teuer', 'mixed', 'm', 'nominativ'), 'teurer');
        проверить.равно(declension.form('sauer', 'weak', 'n', 'nominativ'), 'saure');
    });

    тест('в -er после согласной e остаётся', () => {
        // Выпадает только после дифтонга: teuer → teure, но bitter → bittere
        проверить.равно(declension.form('bitter', 'weak', 'f', 'nominativ'), 'bittere');
        проверить.равно(declension.form('lecker', 'weak', 'f', 'nominativ'), 'leckere');
    });

    тест('слова, где -er и -el часть корня, не трогаются', () => {
        проверить.равно(declension.form('leer', 'weak', 'f', 'nominativ'), 'leere');
        проверить.равно(declension.form('schwer', 'weak', 'f', 'nominativ'), 'schwere');
        проверить.равно(declension.form('viel', 'weak', 'pl', 'nominativ'), 'vielen');
    });

    тест('прочие -el теряют e', () => {
        проверить.равно(declension.form('edel', 'weak', 'f', 'nominativ'), 'edle');
        проверить.равно(declension.form('nobel', 'weak', 'f', 'nominativ'), 'noble');
    });

    тест('несклоняемые остаются как есть', () => {
        проверить.равно(declension.form('rosa', 'weak', 'm', 'nominativ'), 'rosa');
        проверить.равно(declension.form('lila', 'strong', 'pl', 'dativ'), 'lila');
    });

    тест('артикли соответствуют падежу и роду', () => {
        проверить.равно(declension.article('weak', 'm', 'akkusativ'), 'den');
        проверить.равно(declension.article('weak', 'f', 'dativ'), 'der');
        проверить.равно(declension.article('mixed', 'm', 'akkusativ'), 'einen');
        проверить.равно(declension.article('mixed', 'pl', 'nominativ'), 'keine', 'у ein нет множественного, берём kein');
        проверить.равно(declension.article('strong', 'm', 'nominativ'), '', 'сильное склонение — без артикля');
    });

    тест('словосочетание собирается целиком', () => {
        проверить.равно(declension.phrase('hell', 'weak', 'm', 'dativ', 'Raum'), 'dem hellen Raum');
        проверить.равно(declension.phrase('hell', 'mixed', 'n', 'nominativ', 'Zimmer'), 'ein helles Zimmer');
        проверить.равно(declension.phrase('hell', 'strong', 'm', 'dativ', 'Kaffee'), 'hellem Kaffee');
    });

    тест('таблица заполнена целиком', () => {
        const t = declension.table('hell');
        for (const type of declension.TYPES) {
            for (const kase of declension.CASES) {
                for (const gender of declension.GENDERS) {
                    проверить.истина(t[type][kase][gender], `пустая клетка: ${type}/${kase}/${gender}`);
                }
            }
        }
    });

    тест('краткая сводка показывает суть правила', () => {
        // Три формы мужского рода: на них видно, что окончание задаётся артиклем
        const s = declension.summary('hell');
        проверить.равно(s.length, 3);
        проверить.равно(s[0].article + ' ' + s[0].form, 'der helle');
        проверить.равно(s[1].article + ' ' + s[1].form, 'ein heller');
        проверить.равно(s[2].form, 'heller');
        проверить.равно(s[2].article, '');
    });

    тест('род определяется по артиклю существительного', () => {
        проверить.равно(declension.GENDER_BY_ARTICLE['der'], 'm');
        проверить.равно(declension.GENDER_BY_ARTICLE['die'], 'f');
        проверить.равно(declension.GENDER_BY_ARTICLE['das'], 'n');
    });

    тест('пустое слово не ломает разбор', () => {
        проверить.равно(declension.form('', 'weak', 'm', 'nominativ'), '');
        проверить.равно(declension.form(null, 'weak', 'm', 'nominativ'), '');
    });

    тест('неизвестный тип или падеж не выдумывает окончание', () => {
        проверить.равно(declension.form('hell', 'нет такого', 'm', 'nominativ'), 'hell');
        проверить.равно(declension.form('hell', 'weak', 'm', 'genitiv'), 'hell', 'Genitiv в приложении не используется');
    });

    тест('во множественном дательном существительное берёт -n', () => {
        проверить.равно(declension.nounForm('Leute', 'pl', 'dativ'), 'Leuten');
        проверить.равно(declension.nounForm('Kind', 'n', 'dativ'), 'Kind', 'единственное число не трогаем');
        проверить.равно(declension.nounForm('Leute', 'pl', 'akkusativ'), 'Leute', 'другой падеж не трогаем');
        проверить.равно(declension.nounForm('Frauen', 'pl', 'dativ'), 'Frauen', 'второе -n не добавляем');
        проверить.равно(declension.nounForm('Autos', 'pl', 'dativ'), 'Autos', 'множественное на -s исключение');
    });

    тест('фраза во множественном дательном грамматична', () => {
        проверить.равно(declension.phrase('hell', 'weak', 'pl', 'dativ', 'Leute'), 'den hellen Leuten');
        проверить.равно(declension.phrase('hell', 'mixed', 'pl', 'dativ', 'Leute'), 'keinen hellen Leuten');
    });
});

группа('Таблица склонения: только окончания', () => {

    /*
     * Полные формы длинного прилагательного в пять колонок на телефоне
     * не помещаются: «interessante» требует 63 точки при клетке в 57, и
     * обрезается ровно окончание — то единственное, ради чего таблицу и
     * открывают. Обрезаны были все тридцать шесть клеток.
     *
     * Поэтому в клетках окончание, а основа стоит строкой сверху.
     */

    тест('окончание отрезается от основы, а не от общей части форм', () => {
        /*
         * Первая попытка брала общую часть всех тридцати шести форм. Для
         * «interessant» ею оказалась «interessante» — все формы с неё
         * начинаются, — и окончания выходили «-», «-n», «-r», «-s»
         * вместо настоящих.
         */
        проверить.равно(declension.ending('interessant', 'interessante'), 'e');
        проверить.равно(declension.ending('interessant', 'interessanten'), 'en');
        проверить.равно(declension.ending('interessant', 'interessanter'), 'er');
        проверить.равно(declension.ending('interessant', 'interessantes'), 'es');
    });

    тест('выпадение «e» учтено', () => {
        // teuer → teur, dunkel → dunkl. Основа короче словарной формы,
        // и окончание считается именно от неё
        проверить.равно(declension.ending('teuer', 'teure'), 'e');
        проверить.равно(declension.ending('teuer', 'teuren'), 'en');
        проверить.равно(declension.ending('dunkel', 'dunkle'), 'e');
        проверить.равно(declension.ending('hoch', 'hohes'), 'es');
    });

    тест('каждая клетка таблицы даёт настоящее окончание', () => {
        // Ни одно окончание не должно оказаться пустым или чужим
        const допустимые = ['e', 'en', 'er', 'es', 'em'];
        const t = declension.table('interessant');
        const чужие = [];

        for (const type of declension.TYPES) {
            for (const kase of declension.CASES) {
                for (const g of declension.GENDERS) {
                    const конец = declension.ending('interessant', t[type][kase][g]);
                    if (!допустимые.includes(конец)) чужие.push(`${type}.${kase}.${g}: «${конец}»`);
                }
            }
        }

        проверить.совпадает(чужие, []);
    });

    тест('чужая форма возвращается целиком', () => {
        // Если форма почему-то не начинается с основы, лучше показать её
        // как есть, чем отрезать наугад
        проверить.равно(declension.ending('hell', 'ganz andere'), 'ganz andere');
    });
});
