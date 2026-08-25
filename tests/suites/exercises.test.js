import { группа, тест, проверить } from '../runner.js';

const { exercises } = await import('../../js/modules/exercises.js');

/*
 * Начисление и оформление ответа в заданиях.
 *
 * Оба правила отсюда появились по жалобам, и оба такие, что глазами их
 * проверять дорого, а функцией — дёшево.
 */

группа('Сборка предложения: опыт по числу пересборок', () => {

    /*
     * Пересобирать предложение можно сколько угодно, и это правильно:
     * ошибиться порядком одного слова и тут же исправиться — ровно то,
     * чему задание учит. Но перебором выигрывать нельзя: слов немного,
     * и порядок рано или поздно угадывается без всякого знания.
     *
     * Поэтому опыт убывает.
     */

    тест('с первого раза — полный опыт', () => {
        проверить.равно(exercises.builderXP(0), exercises.XP_CORRECT);
    });

    тест('со второй попытки — половина', () => {
        проверить.равно(exercises.builderXP(1), 2);
    });

    тест('дальше — как за неверный ответ, но не меньше', () => {
        проверить.равно(exercises.builderXP(2), exercises.XP_WRONG);
        проверить.равно(exercises.builderXP(3), exercises.XP_WRONG);
        проверить.равно(exercises.builderXP(20), exercises.XP_WRONG);
    });

    тест('опыт только убывает', () => {
        let прошлый = Infinity;
        for (let n = 0; n <= 10; n++) {
            const текущий = exercises.builderXP(n);
            проверить.истина(текущий <= прошлый, `попытка ${n}: ${текущий} после ${прошлый}`);
            прошлый = текущий;
        }
    });

    тест('перебор не выгоднее честного пропуска', () => {
        // Пропуск даёт XP_WRONG и неверный ответ в историю. Если бы
        // перебор давал больше, пропускать было бы глупо, а признать
        // «не знаю» — полезнее для обучения, чем угадать
        проверить.истина(
            exercises.builderXP(5) <= exercises.XP_WRONG,
            'бесконечный перебор не должен приносить больше пропуска'
        );
    });

    тест('пауза перед следующим заданием даёт прочитать фразу', () => {
        // Было полторы секунды на целое предложение — не хватало
        проверить.истина(exercises.BUILDER_NEXT_DELAY >= 3000, 'не меньше трёх секунд');
    });
});

группа('Кнопки ответа: подсветка не двигает текст', () => {

    const кнопка = (классы) => {
        const el = document.createElement('button');
        el.className = классы;
        return el;
    };

    тест('снимаются только цвета', () => {
        const el = кнопка('w-full py-4 bg-slate-900 border-2 border-slate-700 text-slate-300 font-bold rounded-xl text-left px-5 hover:border-amber-500 text-xl');
        exercises._stripColours(el);

        проверить.ложь(el.classList.contains('bg-slate-900'), 'фон снят');
        проверить.ложь(el.classList.contains('border-slate-700'), 'цвет рамки снят');
        проверить.ложь(el.classList.contains('text-slate-300'), 'цвет текста снят');
        проверить.ложь(el.classList.contains('hover:border-amber-500'), 'подсветка при наведении снята');
    });

    тест('выравнивание и размер остаются', () => {
        // Прежний вариант сносил классы по образцу (bg|border|text)-…
        // и заодно уносил text-left и text-xl: после ответа текст терял
        // и край, и размер
        const el = кнопка('bg-slate-900 border-slate-700 text-slate-300 text-left text-xl border-2 py-4 font-bold rounded-xl');
        exercises._stripColours(el);

        проверить.истина(el.classList.contains('text-left'), 'выравнивание уцелело');
        проверить.истина(el.classList.contains('text-xl'), 'размер уцелел');
        проверить.истина(el.classList.contains('border-2'), 'толщина рамки уцелела');
        проверить.истина(el.classList.contains('py-4'), 'отступы уцелели');
    });

    тест('строка ответа не равняет текст по центру', () => {
        // Из-за justify-center весь текст прыгал с левого края на
        // середину в момент ответа
        const html = exercises._answerRow('das Haus', 'fa-check');
        проверить.ложь(html.includes('justify-center'), 'по центру не равняем');
        проверить.истина(html.includes('justify-between'), 'текст слева, значок справа');
    });

    тест('текст идёт раньше значка', () => {
        const html = exercises._answerRow('das Haus', 'fa-check');
        проверить.истина(
            html.indexOf('das Haus') < html.indexOf('fa-check'),
            'значок слева сдвинул бы текст вправо'
        );
    });

    тест('без значка строка тоже собирается', () => {
        const html = exercises._answerRow('das Haus');
        проверить.истина(html.includes('das Haus'));
        проверить.ложь(html.includes('fa-solid'), 'пустого значка не рисуем');
    });
});
