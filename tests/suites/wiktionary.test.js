import { группа, тест, проверить } from '../runner.js';
import { wiktionary } from '../../js/services/wiktionary.js';

/**
 * Образцы разметки взяты из настоящих статей de.wiktionary.org и обрезаны
 * до нужных разделов. Сеть в тестах не используется намеренно: набор должен
 * давать один и тот же ответ офлайн и не зависеть от правок в статьях.
 */

const TISCH = `{{Deutsch Substantiv Übersicht
|Genus=m
|Nominativ Singular=Tisch
|Nominativ Plural=Tische
|Genitiv Singular=Tischs
|Genitiv Singular*=Tisches
|Dativ Singular=Tisch
|Dativ Singular*=Tische
|Dativ Plural=Tischen
|Akkusativ Singular=Tisch
|Akkusativ Plural=Tische
}}

{{Aussprache}}
:{{IPA}} {{Lautschrift|tɪʃ}}
:{{Hörbeispiele}} {{Audio|De-Tisch.ogg}}

{{Synonyme}}
:[1] [[Tafel]]
:[2] [[Messe]], [[Tafelrunde]]

{{Gegenwörter}}
:[1] [[Bett]], [[Stuhl]]
`;

const ATMEN = `{{Deutsch Verb Übersicht
|Präsens_ich=atme
|Präsens_du=atmest
|Präsens_er, sie, es=atmet
|Präteritum_ich=atmete
|Partizip II=geatmet
|Konjunktiv II_ich=atmete
|Imperativ Singular=atme
|Imperativ Plural=atmet
|Hilfsverb=haben
}}

{{Aussprache}}
:{{IPA}} {{Lautschrift|ˈaːtmən}}

{{Synonyme}}
:[1] [[Luft]] [[holen]]
:[2] [[erfüllen|erfüllt sein]]
`;

const HELL = `{{Deutsch Adjektiv Übersicht
|Positiv=hell
|Komparativ=heller
|Superlativ=hellsten
}}

{{Aussprache}}
:{{IPA}} {{Lautschrift|hɛl}}

{{Gegenwörter}}
:[1] [[trüb]], [[finster]], [[dunkel]]
`;

// Омограф: «der See» (озеро) и «die See» (море) — разные блоки форм
const SEE = `{{Deutsch Substantiv Übersicht
|Genus=m
|Nominativ Singular=See
|Nominativ Plural=Seen
|Dativ Singular=See
|Akkusativ Singular=See
}}

{{Deutsch Substantiv Übersicht
|Genus=f
|Nominativ Singular=See
|Nominativ Plural=Seen
|Dativ Singular=See
|Akkusativ Singular=See
}}
`;

// «das Band» и «das Band» — два блока одного рода с разным множественным
const BAND = `{{Deutsch Substantiv Übersicht
|Genus=m
|Nominativ Singular=Band
|Nominativ Plural=Bände
}}

{{Deutsch Substantiv Übersicht
|Genus=n
|Nominativ Singular=Band
|Nominativ Plural=Bänder
}}

{{Deutsch Substantiv Übersicht
|Genus=n
|Nominativ Singular=Band
|Nominativ Plural=Bande
}}
`;

группа('Разбор статей Wiktionary', () => {

    тест('заголовок статьи без артикля и с заглавной буквы', () => {
        проверить.равно(wiktionary.pageTitle({ word: 'der Tisch', type: 'noun' }), 'Tisch');
        проверить.равно(wiktionary.pageTitle({ word: 'sich freuen', type: 'verb' }), 'freuen');
        проверить.равно(wiktionary.pageTitle({ word: 'warten auf', type: 'verb' }), 'warten');
    });

    тест('существительное: род и формы', () => {
        const e = wiktionary.parseEntry(TISCH, 'noun', { word: 'der Tisch', type: 'noun', gender: 'der' });
        проверить.равно(e.gender, 'der');
        проверить.равно(e.plural[0], 'Tische');
        проверить.содержит(e.dativ, 'Tisch');
        проверить.содержит(e.dativ, 'Tische', 'вариант со звёздочкой должен приниматься тоже');
    });

    тест('глагол: все формы, включая прежде терявшиеся', () => {
        const e = wiktionary.parseEntry(ATMEN, 'verb', { word: 'atmen', type: 'verb' });
        проверить.равно(e.present.du, 'atmest');
        проверить.равно(e.preterite[0], 'atmete');
        проверить.равно(e.participle_ii[0], 'geatmet');
        проверить.равно(e.auxiliary, 'haben');
        проверить.равно(e.imperativeSingular[0], 'atme');
        проверить.равно(e.imperativePlural[0], 'atmet');
        проверить.равно(e.konjunktiv2[0], 'atmete');
    });

    тест('прилагательное: превосходная степень получает «am»', () => {
        const e = wiktionary.parseEntry(HELL, 'adjective', { word: 'hell', type: 'adjective' });
        проверить.равно(e.comparative[0], 'heller');
        проверить.равно(e.superlative[0], 'am hellsten');
    });

    тест('транскрипция', () => {
        проверить.равно(wiktionary.parseEntry(TISCH, 'noun', { word: 'der Tisch', type: 'noun' }).ipa, 'tɪʃ');
        проверить.равно(wiktionary.parseEntry(ATMEN, 'verb', { word: 'atmen', type: 'verb' }).ipa, 'ˈaːtmən');
    });

    тест('синонимы берутся только по первому значению', () => {
        const e = wiktionary.parseEntry(TISCH, 'noun', { word: 'der Tisch', type: 'noun' });
        проверить.совпадает(e.synonyms, ['Tafel']);
        проверить.совпадает(e.antonyms, ['Bett', 'Stuhl']);
    });

    тест('соседние ссылки — одно выражение', () => {
        // «[[Luft]] [[holen]]» должно стать «Luft holen», а не двумя словами
        const e = wiktionary.parseEntry(ATMEN, 'verb', { word: 'atmen', type: 'verb' });
        проверить.совпадает(e.synonyms, ['Luft holen']);
    });

    тест('омограф разбирается по роду карточки', () => {
        const мужской = wiktionary.parseEntry(SEE, 'noun', { word: 'der See', type: 'noun', gender: 'der' });
        const женский = wiktionary.parseEntry(SEE, 'noun', { word: 'die See', type: 'noun', gender: 'die' });
        проверить.равно(мужской.gender, 'der');
        проверить.равно(женский.gender, 'die');
    });

    тест('неоднозначный род ничего не утверждает', () => {
        // Два блока среднего рода с разным множественным: угадать нельзя
        const e = wiktionary.parseEntry(BAND, 'noun', { word: 'das Band', type: 'noun', gender: 'das' });
        проверить.истина(e.ambiguous, 'при двух блоках одного рода разбор должен отказаться');
        проверить.совпадает(wiktionary.compare({ word: 'das Band', type: 'noun', gender: 'das', plural: 'die Bänder' }, e), []);
        проверить.совпадает(wiktionary.fillFrom({ word: 'das Band', type: 'noun', gender: 'das' }, e), {});
    });

    тест('род карточки не совпал ни с одним блоком', () => {
        const e = wiktionary.parseEntry(SEE, 'noun', { word: 'das See', type: 'noun', gender: 'das' });
        проверить.истина(e.ambiguous, 'исправлять род омографа наугад нельзя');
    });
});

группа('Сверка карточки со статьёй', () => {

    const статья = (wikitext, word) => wiktionary.parseEntry(wikitext, word.type, word);

    тест('верная карточка расхождений не даёт', () => {
        const word = { word: 'der Tisch', type: 'noun', gender: 'der', plural: 'die Tische', dativ: 'dem Tisch', akkusativ: 'den Tisch' };
        проверить.совпадает(wiktionary.compare(word, статья(TISCH, word)), []);
    });

    тест('неверный род ловится и правится вместе со словом', () => {
        const word = { word: 'das Tisch', type: 'noun', gender: 'das' };
        const diffs = wiktionary.compare(word, статья(TISCH, word));
        проверить.равно(diffs.length, 1);
        проверить.равно(diffs[0].field, 'gender');
        проверить.равно(diffs[0].fix.gender, 'der');
        проверить.равно(diffs[0].fix.word, 'der Tisch', 'артикль в самом слове тоже должен исправиться');
    });

    тест('форма слабого существительного ловится', () => {
        const word = { word: 'der Tisch', type: 'noun', gender: 'der', dativ: 'dem Tischen' };
        const diffs = wiktionary.compare(word, статья(TISCH, word));
        проверить.равно(diffs[0].field, 'dativ');
        проверить.равно(diffs[0].fix.dativ, 'dem Tisch');
    });

    тест('ошибка в спряжении сильного глагола ловится', () => {
        const word = { word: 'atmen', type: 'verb', conjugation: { ich: 'atme', du: 'atme', er: 'atmet' } };
        const diffs = wiktionary.compare(word, статья(ATMEN, word));
        проверить.равно(diffs[0].field, 'präsens_du');
        проверить.равно(diffs[0].fix.conjugation.du, 'atmest');
        проверить.равно(diffs[0].fix.conjugation.ich, 'atme', 'остальные лица должны сохраниться');
    });

    тест('неверный вспомогательный глагол ловится', () => {
        const word = { word: 'atmen', type: 'verb', auxiliary: 'sein' };
        const diffs = wiktionary.compare(word, статья(ATMEN, word));
        проверить.равно(diffs[0].fix.auxiliary, 'haben');
    });

    тест('пустые поля не считаются ошибкой', () => {
        const word = { word: 'der Tisch', type: 'noun', gender: 'der' };
        проверить.совпадает(wiktionary.compare(word, статья(TISCH, word)), []);
    });

    тест('дозаполнение подставляет артикли к формам', () => {
        const word = { word: 'der Tisch', type: 'noun', gender: 'der' };
        const fill = wiktionary.fillFrom(word, статья(TISCH, word));
        проверить.равно(fill.plural, 'die Tische');
        проверить.равно(fill.dativ, 'dem Tisch');
        проверить.равно(fill.akkusativ, 'den Tisch');
        проверить.равно(fill.ipa, 'tɪʃ');
        проверить.равно(fill.synonym, 'Tafel');
    });

    тест('дозаполнение не трогает заполненное', () => {
        const word = { word: 'der Tisch', type: 'noun', gender: 'der', plural: 'мой вариант', ipa: 'моя транскрипция' };
        const fill = wiktionary.fillFrom(word, статья(TISCH, word));
        проверить.равно(fill.plural, undefined, 'уже заполненное поле переписываться не должно');
        проверить.равно(fill.ipa, undefined);
    });

    тест('артикль женского рода в дательном', () => {
        const word = { word: 'die See', type: 'noun', gender: 'die' };
        const fill = wiktionary.fillFrom(word, статья(SEE, word));
        проверить.равно(fill.dativ, 'der See');
        проверить.равно(fill.akkusativ, 'die See');
    });

    тест('синонимы не сверяются, а только дополняются', () => {
        // Единственно верного синонима не бывает: правка чужого выбора
        // была бы навязыванием
        const word = { word: 'der Tisch', type: 'noun', gender: 'der', synonym: 'моё слово' };
        const diffs = wiktionary.compare(word, статья(TISCH, word));
        проверить.ложь(diffs.some(d => d.field === 'synonym'));
    });

    тест('сводка проверки читается словами', () => {
        проверить.равно(wiktionary.summary(null), null);
        проверить.истина(wiktionary.summary({ fixed: 2, filled: 1, unchecked: 0 }).alarming);
        проверить.ложь(wiktionary.summary({ fixed: 0, filled: 0, unchecked: 0 }).alarming);
    });
});

группа('Сверка перевода', () => {

    const статья = `
{{Übersetzungen}}
*{{ru}}: {{Üt|ru|стол}} {{m}}
*{{uk}}: {{Üt|uk|стіл}} {{m}}
*{{en}}: {{Ü|en|table}}
`;

    тест('переводы вытаскиваются по языку', () => {
        проверить.равно(wiktionary.parseTranslations(статья, 'ru').join(','), 'стол');
        проверить.равно(wiktionary.parseTranslations(статья, 'uk').join(','), 'стіл');
        проверить.равно(wiktionary.parseTranslations(статья, 'en').join(','), 'table');
    });

    тест('несколько переводов в одной строке', () => {
        const текст = "*{{ru}}: ''unvoll.'' {{Üt|ru|говорить}}; ''voll.'' {{Üt|ru|сказать}}";
        const итог = wiktionary.parseTranslations(текст, 'ru');
        проверить.содержит(итог, 'говорить');
        проверить.содержит(итог, 'сказать');
    });

    тест('языка нет в статье — пустой список', () => {
        проверить.равно(wiktionary.parseTranslations(статья, 'pl').length, 0);
        проверить.равно(wiktionary.parseTranslations('', 'ru').length, 0);
    });

    тест('совпадение засчитывается', () => {
        проверить.равно(wiktionary.matchTranslation('стол', ['стол']), 'match');
        проверить.равно(wiktionary.matchTranslation('Стол', ['стол']), 'match', 'регистр не важен');
        проверить.равно(wiktionary.matchTranslation('  стол  ', ['стол']), 'match');
    });

    тест('ё и е — одна буква', () => {
        проверить.равно(wiktionary.matchTranslation('надёжный', ['надежный']), 'match');
    });

    тест('достаточно одного варианта из перечисленных', () => {
        // Модель часто пишет несколько значений через запятую
        проверить.равно(wiktionary.matchTranslation('бежать, бегать', ['бежать']), 'match');
        проверить.равно(wiktionary.matchTranslation('говорить; сказать', ['сказать']), 'match');
    });

    тест('пояснение в скобках не мешает', () => {
        проверить.равно(wiktionary.matchTranslation('стол (мебель)', ['стол']), 'match');
    });

    тест('вложение считается совпадением', () => {
        проверить.равно(wiktionary.matchTranslation('стиральная машина', ['стиральная машина автомат']), 'match');
    });

    тест('чужое значение отмечается как расхождение', () => {
        // Ровно тот случай, ради которого всё затевалось
        проверить.равно(wiktionary.matchTranslation('стул', ['стол']), 'differs');
        проверить.равно(wiktionary.matchTranslation('окно', ['стол', 'столик']), 'differs');
    });

    тест('нечего сравнивать — не обвиняем', () => {
        проверить.равно(wiktionary.matchTranslation('стол', []), 'unknown');
        проверить.равно(wiktionary.matchTranslation('', ['стол']), 'unknown');
        проверить.равно(wiktionary.matchTranslation(null, ['стол']), 'unknown');
    });

    тест('подозрение в переводе не несёт автоисправления', () => {
        const word = { word: 'der Tisch', type: 'noun', gender: 'der', translation: 'стул' };
        const entry = { type: 'noun', gender: 'der', translations: ['стол'] };

        const diffs = wiktionary.compare(word, entry);
        const перевод = diffs.find(d => d.field === 'translation');

        проверить.истина(перевод, 'расхождение найдено');
        проверить.истина(перевод.suspicion, 'помечено как подозрение');
        проверить.ложь(!!перевод.fix, 'исправления нет — менять смысл наугад нельзя');
    });

    тест('верный перевод не попадает в расхождения', () => {
        const word = { word: 'der Tisch', type: 'noun', gender: 'der', translation: 'стол' };
        const entry = { type: 'noun', gender: 'der', translations: ['стол'] };
        проверить.ложь(wiktionary.compare(word, entry).some(d => d.field === 'translation'));
    });
});
