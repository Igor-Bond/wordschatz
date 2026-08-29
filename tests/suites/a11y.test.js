import { группа, тест, проверить } from '../runner.js';

/*
 * Доступность: то, что проверяется без живого чтеца.
 *
 * Заявлять доступность и не проверять её — худший из вариантов: человек
 * с чтецом поверит заявлению и упрётся. Здесь проверяется ровно то, что
 * поддаётся проверке из браузера, и ничего сверх.
 *
 * Что поймали эти правила, когда писались: ни одна из двадцати трёх
 * подписей в приложении не была связана со своим полем — чтец объявлял
 * двенадцать полей карточки подряд как «текстовое поле», и какое из них
 * Präteritum, узнать было неоткуда. Ещё три кнопки не имели имени вовсе
 * (очистка чата, отправка, значок лиги), а модальные окна не запирали
 * фокус: Tab уходил из окна на страницу за ним.
 *
 * Чего эти проверки не заменяют: живого VoiceOver и TalkBack. Порядок
 * чтения, внятность формулировок и поведение жестов ими не проверить.
 */

const { dialog } = await import('../../js/core/dialog.js');

/** Разбирает строку разметки в дерево, по которому можно спрашивать. */
function разобрать(html) {
    const корень = document.createElement('div');
    корень.innerHTML = html;
    return корень;
}

группа('Доступность: подписи связаны с полями', () => {

    тест('в index.html у каждой подписи есть своё поле', async () => {
        /*
         * <label> без for — это просто текст рядом. Глазами связь видна,
         * чтецу — нет: он объявит «текстовое поле» и замолчит.
         */
        const html = await (await fetch('../index.html')).text();
        const дерево = new DOMParser().parseFromString(html, 'text/html');

        const беспризорные = [...дерево.querySelectorAll('label')]
            .filter(l => !l.querySelector('input, select, textarea'))
            .filter(l => {
                const цель = l.getAttribute('for');
                return !цель || !дерево.getElementById(цель);
            })
            .map(l => l.textContent.replace(/\s+/g, ' ').trim() || l.getAttribute('data-i18n') || '(без текста)');

        проверить.совпадает(беспризорные, [], 'подписи без своего поля');
    });

    тест('в index.html у каждой кнопки есть имя', async () => {
        // Кнопка со значком и без текста читается чтецом как «кнопка».
        // Таких в приложении было три, и все три — часто нажимаемые
        const html = await (await fetch('../index.html')).text();
        const дерево = new DOMParser().parseFromString(html, 'text/html');

        const безымянные = [...дерево.querySelectorAll('button')]
            .filter(b => {
                const текст = b.textContent.replace(/\s+/g, ' ').trim();
                const метка = (b.getAttribute('aria-label') || '').trim();
                const ключ = (b.getAttribute('data-i18n-aria') || '').trim();
                return !текст && !метка && !ключ && !b.getAttribute('title');
            })
            .map(b => b.id || b.getAttribute('onclick') || b.className.slice(0, 40));

        проверить.совпадает(безымянные, [], 'кнопки без доступного имени');
    });

    тест('поле ввода ответа в заданиях подписано', async () => {
        /*
         * Отрисовщики отдают строку разметки, и её можно разобрать так
         * же, как страницу.
         *
         * Подпись бывает двух видов, и обе годятся: <label for> там, где
         * подпись стоит вплотную к полю, и aria-labelledby на видимый
         * вопрос там, где вопрос уже написан заголовком. Второе лучше
         * дублирования: заведёшь отдельный aria-label — он разойдётся с
         * видимым текстом при первой же правке.
         *
         * Проверка нашла, что «написать по-немецки» не подписано вовсе:
         * при беглой правке я связал подписи только у двух заданий из
         * четырёх, а решил, что у всех.
         */
        const { exercises } = await import('../../js/modules/exercises.js');
        const слово = {
            id: 1, word: 'der Tisch', translation: 'стол', type: 'noun',
            example_de: 'Der Tisch steht am Fenster.', example_ru: 'Стол стоит у окна.'
        };

        const задания = [
            ['написать по-немецки', exercises.renderProductionQuiz(слово)],
            ['форма глагола', exercises.renderVerbQuiz({ ...слово, type: 'verb', word: 'nehmen', preterite: 'nahm', perfect: 'genommen' })],
            ['аудирование', exercises.renderListeningQuiz(слово)],
            ['пропущенное слово', await exercises.renderFillBlanksQuiz(слово)]
        ];

        for (const [имя, разметка] of задания) {
            if (!разметка) continue;   // задание вправе отказаться от слова

            const дерево = разобрать(разметка);
            const поле = дерево.querySelector('#ex-input');
            if (!поле) continue;

            const по_label = !!дерево.querySelector('label[for="ex-input"]');
            const указано = поле.getAttribute('aria-labelledby');
            const по_labelledby = !!указано && !!дерево.querySelector('#' + указано);

            проверить.истина(по_label || по_labelledby, `${имя}: поле ответа без подписи`);
        }
    });
});

группа('Доступность: запор фокуса в окнах', () => {

    /** Отдельная площадка, чтобы не трогать страницу проверок. */
    function площадка(вложенно) {
        const корень = document.createElement('div');
        корень.innerHTML = `
            <div class="снаружи"><button>вне окна</button></div>
            <div class="ещё-снаружи"><a href="#">ссылка вне</a></div>
        `;
        const окно = document.createElement('div');
        окно.innerHTML = '<button class="первая">раз</button><button class="вторая">два</button>';

        if (вложенно) {
            const обёртка = document.createElement('div');
            обёртка.innerHTML = '<button>сосед обёртки</button>';
            обёртка.appendChild(окно);
            корень.appendChild(обёртка);
        } else {
            корень.appendChild(окно);
        }

        document.body.appendChild(корень);
        return { корень, окно, убрать: () => корень.remove() };
    }

    тест('соседи гаснут, само окно — нет', () => {
        const { корень, окно, убрать } = площадка(false);
        const освободить = dialog.trapFocus(окно);

        проверить.ложь(окно.hasAttribute('inert'), 'окно не должно быть погашено');
        проверить.истина(корень.querySelector('.снаружи').hasAttribute('inert'), 'сосед должен быть погашен');

        освободить();
        убрать();
    });

    тест('вложенное окно не гасит само себя', () => {
        /*
         * Окна настроек и правки слова лежат внутри разметки экрана, а не
         * в <body>. Если гасить «всё, кроме окна» только на верхнем
         * уровне, погаснет предок окна — а inert наследуется, и окно
         * потухнет вместе с ним. Ошибка была допущена и поймана здесь.
         */
        const { окно, убрать } = площадка(true);
        const освободить = dialog.trapFocus(окно);

        const внутриПогашенного = (() => {
            let p = окно.parentElement;
            while (p) { if (p.hasAttribute('inert')) return true; p = p.parentElement; }
            return false;
        })();

        проверить.ложь(окно.hasAttribute('inert'), 'окно погашено само');
        проверить.ложь(внутриПогашенного, 'окно внутри погашенного предка');

        освободить();
        убрать();
    });

    тест('освобождение снимает всё, что погасило', () => {
        const до = document.querySelectorAll('[inert]').length;
        const { окно, убрать } = площадка(true);

        const освободить = dialog.trapFocus(окно);
        проверить.истина(document.querySelectorAll('[inert]').length > до, 'ничего не погасло');

        освободить();
        проверить.равно(document.querySelectorAll('[inert]').length, до, 'погашенное осталось погашенным');

        убрать();
    });

    тест('Tab на последней кнопке заворачивает на первую', () => {
        const { окно, убрать } = площадка(false);
        const освободить = dialog.trapFocus(окно);

        const первая = окно.querySelector('.первая');
        const вторая = окно.querySelector('.вторая');

        вторая.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        проверить.равно(document.activeElement, первая, 'Tab не вернулся на первую');

        первая.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
        проверить.равно(document.activeElement, вторая, 'Shift+Tab не ушёл на последнюю');

        освободить();
        убрать();
    });

    тест('фокус возвращается туда, откуда открыли', () => {
        // Без возврата фокус после закрытия падает на <body>, и
        // следующий Tab начинает обход страницы с самого начала
        const якорь = document.createElement('button');
        якорь.textContent = 'открыть';
        document.body.appendChild(якорь);
        якорь.focus();

        const { окно, убрать } = площадка(false);
        const освободить = dialog.trapFocus(окно);
        окно.querySelector('.первая').focus();

        освободить();
        проверить.равно(document.activeElement, якорь, 'фокус не вернулся');

        убрать();
        якорь.remove();
    });
});
