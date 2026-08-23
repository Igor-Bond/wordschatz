import { группа, тест, проверить } from '../runner.js';
import { germanUtils } from '../../js/core/german.js';

группа('Немецкая грамматика', () => {

    тест('артикль вытаскивается из слова', () => {
        проверить.равно(germanUtils.getGender({ word: 'der Tisch' }), 'der');
        проверить.равно(germanUtils.getGender({ word: 'die Lampe' }), 'die');
        проверить.равно(germanUtils.getGender({ word: 'das Fenster' }), 'das');
    });

    тест('поле gender главнее разбора слова', () => {
        проверить.равно(germanUtils.getGender({ word: 'Tisch', gender: 'der' }), 'der');
    });

    тест('слово без артикля не получает выдуманный род', () => {
        // Раньше подставлялся «der», и задание на артикли учило неправильному
        проверить.равно(germanUtils.getGender({ word: 'Tisch' }), null);
        проверить.ложь(germanUtils.hasKnownArticle({ word: 'Tisch', type: 'noun' }));
    });

    тест('Perfekt подаётся третьим лицом', () => {
        проверить.равно(germanUtils.perfektForm({ participle_ii: 'gemacht', auxiliary: 'haben' }).primary, 'hat gemacht');
        проверить.равно(germanUtils.perfektForm({ participle_ii: 'gegangen', auxiliary: 'sein' }).primary, 'ist gegangen');
    });

    тест('Perfekt с инфинитивом тоже принимается', () => {
        const forms = germanUtils.perfektForm({ participle_ii: 'gemacht', auxiliary: 'haben' });
        проверить.содержит(forms.accepted, 'haben gemacht');
    });

    тест('Perfekt без причастия не выдумывается', () => {
        проверить.равно(germanUtils.perfektForm({ auxiliary: 'haben' }), null);
    });

    тест('Rektion разбирается с предлогом и без', () => {
        проверить.совпадает(germanUtils.parseRektion('warten auf + Akkusativ'), { preposition: 'auf', kase: 'Akkusativ' });
        проверить.совпадает(germanUtils.parseRektion('helfen + Dativ'), { preposition: null, kase: 'Dativ' });
    });

    тест('ответ сверяется без учёта регистра и пробелов', () => {
        проверить.истина(germanUtils.matchesAnswer('  Hat Gemacht ', ['hat gemacht']));
        проверить.ложь(germanUtils.matchesAnswer('haben gemacht', ['hat gemacht']));
    });

    тест('спряжение читается из объекта', () => {
        const c = germanUtils.getConjugation({ conjugation: { ich: 'nehme', du: 'nimmst' } });
        проверить.равно(c.du, 'nimmst');
    });

    тест('старая строка спряжения разбирается', () => {
        // Карточки до смены схемы хранили спряжение строкой
        const c = germanUtils.getConjugation({ present: 'ich gehe, du gehst, er/sie/es geht, wir gehen, ihr geht, sie gehen' });
        проверить.равно(c.ich, 'gehe');
        проверить.равно(c.er, 'geht');
        проверить.равно(c.sie, 'gehen', 'вежливое sie не должно теряться под третьим лицом');
    });

    тест('полнота: заполненное существительное', () => {
        const word = { type: 'noun', word: 'der Tisch', gender: 'der', translation: 'стол', plural: 'die Tische', dativ: 'dem Tisch', akkusativ: 'den Tisch', ipa: 'tɪʃ', example_de: 'a', example_ru: 'b' };
        проверить.совпадает(germanUtils.missingFields(word), []);
        проверить.равно(germanUtils.completeness(word), 100);
    });

    тест('полнота: глагол без повелительного наклонения', () => {
        const word = { type: 'verb', word: 'atmen', translation: 'дышать', conjugation: { ich: 1, du: 1, er: 1, wir: 1, ihr: 1, sie: 1 }, preterite: 'atmete', participle_ii: 'geatmet', auxiliary: 'haben', ipa: 'x', example_de: 'a', example_ru: 'b' };
        проверить.совпадает(germanUtils.missingFields(word), ['imperative_singular', 'konjunktiv2']);
    });

    тест('синонимы и Rektion в полноту не входят', () => {
        // Их просили заполнять только при наличии: выдуманный синоним
        // хуже отсутствующего
        const word = { type: 'verb', word: 'atmen', translation: 'x', conjugation: { ich:1,du:1,er:1,wir:1,ihr:1,sie:1 }, preterite: 'a', participle_ii: 'b', auxiliary: 'haben', imperative_singular: 'c', imperative_plural: 'd', konjunktiv2: 'e', ipa: 'f', example_de: 'g', example_ru: 'h' };
        проверить.совпадает(germanUtils.missingFields(word), []);
    });

    тест('транскрипция не требуется от фраз', () => {
        // Статьи под фразу обычно нет, а разбор взял бы заголовком первое слово
        проверить.ложь(germanUtils.missingFields({ type: 'phrase', word: 'guten Tag', translation: 'x', example_de: 'a', example_ru: 'b' }).includes('ipa'));
    });
});
