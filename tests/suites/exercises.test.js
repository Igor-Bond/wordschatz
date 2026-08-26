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

    тест('цвет с прозрачностью тоже снимается', () => {
        /*
         * Кнопки артикля цветные каждая по-своему, и цвет у них записан
         * с прозрачностью: bg-red-900/30. Образец таких не ловил, класс
         * оставался — и перебивал добавленный поверх зелёный, потому что
         * утилиты с прозрачностью Tailwind кладёт в CSS позже обычных.
         *
         * На «DIE» это выглядело так: ответ верный, а кнопка красная.
         */
        const el = кнопка('py-4 bg-red-900/30 border-2 border-red-900/50 text-red-400 hover:bg-red-900/50 rounded-xl text-xl');
        exercises._stripColours(el);

        проверить.ложь(el.classList.contains('bg-red-900/30'), 'фон с прозрачностью снят');
        проверить.ложь(el.classList.contains('border-red-900/50'), 'рамка с прозрачностью снята');
        проверить.ложь(el.classList.contains('hover:bg-red-900/50'), 'цвет под приставкой снят');
        проверить.истина(el.classList.contains('text-xl'), 'размер уцелел');
        проверить.истина(el.classList.contains('rounded-xl'), 'скругление уцелело');
    });

    тест('ни одного цветного класса не остаётся', () => {
        // Любой уцелевший цвет — это возможная победа старого над новым,
        // и какая именно, зависит от порядка правил в собранном CSS
        const el = кнопка('bg-blue-900/30 border-blue-900/50 text-blue-400 hover:bg-blue-900/50 bg-slate-900 text-slate-300 py-4 px-5 text-left');
        exercises._stripColours(el);

        const цветные = [...el.classList].filter(c => /-(?:slate|blue|red|green|amber|purple|teal|pink)-\d/.test(c));
        проверить.совпадает(цветные, [], 'цвета должны сниматься все');
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

    тест('строка ответа не навязывает выравнивание', () => {
        /*
         * Выравнивание должно остаться тем, что было у кнопки: по левому
         * краю у выбора перевода, по центру у артикля. Любое justify-
         * здесь означает, что строка решает за кнопку, — так уже было,
         * и текст в момент ответа прыгал.
         */
        const html = exercises._answerRow('das Haus');
        проверить.ложь(/justify-|text-left|text-center/.test(html), 'выравнивание навязывать нельзя');
        проверить.истина(html.includes('block w-full'), 'текст занимает всю ширину');
    });

    тест('значка на кнопке нет', () => {
        /*
         * Значок пережил три попытки поставить его так, чтобы он не
         * двигал текст, и в четвёртой стал бы перекрывать длинный ответ.
         * Убран: цвет, зачёркивание и яркость говорят всё сами.
         */
        проверить.ложь(exercises._answerRow('das Haus').includes('fa-'), 'значков не рисуем');
    });

    тест('неверный ответ отличается не только цветом', () => {
        // Иначе картинка читается лишь тем, кто различает красный и
        // зелёный, — а это не все
        проверить.истина(
            exercises._answerRow('das Haus', 'line-through opacity-80').includes('line-through'),
            'зачёркивание — признак помимо цвета'
        );
    });
});

группа('Сборка слова из букв', () => {

    /*
     * Задание заведено под конкретную жалобу: в заданиях дня видны два
     * типа — пары и выбор из четырёх. Так и было. У нового слова без
     * рода и примера доступны ровно три типа, и два из них — выбор
     * перевода в обе стороны — для глаза одно и то же.
     *
     * Этому от карточки не нужно ничего, кроме самого слова.
     */

    const пул = (w) => {
        const v = ['translation_de_ru', 'translation_ru_de', 'match_pairs'];
        if (w.gender) v.push('article');
        if (w.example_de) v.push('fill_blanks', 'sentence_builder');
        if (String(w.word).replace(/^(der|die|das)\s+/, '').length > 2) v.push('word_builder');
        return v.filter(m => exercises.STAGES[exercises.getStage(w)].includes(m));
    };

    /** Сколько различимых на вид заданий получит слово. */
    const семейств = (w) => new Set(пул(w).map(m => exercises.MODE_FAMILY[m] || m)).size;

    тест('новое слово без рода и примера получает три разных задания', () => {
        const голое = { word: 'Guten Tag', type: 'phrase', repetitions: 1, mastery: 10 };
        проверить.равно(семейств(голое), 3, пул(голое).join(', '));
    });

    тест('без сборки слова их было бы два', () => {
        // Проверка держит вывод, ради которого задание и добавили
        const голое = { word: 'Guten Tag', type: 'phrase', repetitions: 1, mastery: 10 };
        const без = пул(голое).filter(m => m !== 'word_builder');
        проверить.равно(new Set(без.map(m => exercises.MODE_FAMILY[m] || m)).size, 2);
    });

    тест('оба перевода считаются одним заданием на вид', () => {
        проверить.равно(
            exercises.MODE_FAMILY.translation_de_ru,
            exercises.MODE_FAMILY.translation_ru_de,
            'четыре кнопки в обе стороны — одно и то же'
        );
    });

    тест('артикль в буквы не попадает', () => {
        // Складывать «d-i-e» бессмысленно, на артикль есть своё задание
        exercises.renderWordBuilder({ word: 'die Sprache', translation: 'язык', type: 'noun' });
        проверить.равно(exercises.builderAnswer(), 'Sprache');
    });

    тест('буквы склеиваются без пробелов, слова — с пробелами', () => {
        exercises.renderWordBuilder({ word: 'das Haus', translation: 'дом', type: 'noun' });
        проверить.равно(exercises.builderState.separator, '');
        проверить.равно(exercises.builderAnswer(), 'Haus');

        exercises.renderSentenceBuilder({ word: 'das Haus', translation: 'дом',
                                          example_de: 'Das Haus ist gross.' });
        проверить.равно(exercises.builderState.separator, ' ');
        проверить.равно(exercises.builderAnswer(), 'Das Haus ist gross');
    });

    тест('набор букв совпадает с самим словом', () => {
        exercises.renderWordBuilder({ word: 'die Waschmaschine', translation: 'машина', type: 'noun' });
        const буквы = [...exercises.builderState.words].sort().join('');
        проверить.равно(буквы, 'Waschmaschine'.split('').sort().join(''), 'ни одной лишней или потерянной');
    });

    тест('слишком короткое слово задания не получает', () => {
        const короткое = { word: 'Ei', type: 'noun', repetitions: 1, mastery: 10 };
        проверить.ложь(пул(короткое).includes('word_builder'), 'из двух букв складывать нечего');
    });
});
