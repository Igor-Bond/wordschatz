/**
 * Высота приложения: следим, чтобы страница совпадала с видимой областью.
 *
 * Приложение занимает ровно экран — тело не прокручивается, нижнее меню
 * прижато к низу через absolute. Держится это на `height: 100dvh`, и в
 * норме единица работает правильно. Но на Android после перезагрузки из
 * самого приложения (кнопка «Обновить» → SKIP_WAITING → location.reload)
 * значение иногда остаётся посчитанным для скрытой панели браузера:
 * страница выходит выше экрана, от меню видна одна кромка, и лечит это
 * только сворачивание — то есть событие resize.
 *
 * Первая попытка чинить это была грубее: высота всегда бралась из
 * window.innerHeight. На iPhone получилось хуже исходного — под меню
 * появилась пустая полоса, потому что на старте innerHeight там ещё не
 * учитывает безопасные зоны, а второго события не приходит.
 *
 * Поэтому здесь измерение, а не замена. Скрытая проба ростом 100dvh
 * сравнивается с настоящей высотой окна: совпало — не вмешиваемся и
 * оставляем dvh работать; разошлось — подставляем измеренное значение.
 * Разъехавшаяся высота чинится сама, а верная не портится.
 */

/**
 * Насколько разрешено расходиться, прежде чем вмешиваться.
 *
 * Небольшая разница между dvh и окном — обычное дело: безопасные зоны,
 * округления, полоса жестов. Вмешательство там приносит вред — на iPhone
 * под меню появлялась пустая полоса, на Android снизу проступала белая.
 * Настоящая поломка, ради которой всё затевалось, выглядит иначе:
 * застрявший dvh отличается на высоту панели браузера, а это заметно
 * больше полусотни точек.
 */
const ДОПУСК = 24;

let проба = null;

function пробнаяВысота() {
    if (!проба) {
        проба = document.createElement('div');
        проба.setAttribute('aria-hidden', 'true');
        проба.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100dvh;visibility:hidden;pointer-events:none';
        document.body.appendChild(проба);
    }
    return проба.getBoundingClientRect().height;
}

export const viewport = {

    apply: () => {
        const окно = window.innerHeight;
        if (!окно || !document.body) return;

        const dvh = пробнаяВысота();

        // dvh справляется сам — не мешаем. Заодно снимаем подстановку,
        // если она осталась с того момента, когда мешал
        if (!dvh || Math.abs(dvh - окно) <= ДОПУСК) {
            if (document.documentElement.style.getPropertyValue('--app-height')) {
                document.documentElement.style.removeProperty('--app-height');
            }
            return;
        }

        // Сравниваем с тем, что реально стоит в переменной, а не с
        // запомненным числом: иначе однажды разъехавшееся значение так и
        // осталось бы — событие пришло, но «высота та же», и выхода нет
        if (document.documentElement.style.getPropertyValue('--app-height') === `${окно}px`) return;

        document.documentElement.style.setProperty('--app-height', `${окно}px`);
    },

    init: () => {
        viewport.apply();

        // На iPhone размеры на момент DOMContentLoaded ещё не окончательные:
        // безопасные зоны применяются позже, а второго события может и не
        // быть. Поэтому перемеряем несколько раз после запуска
        requestAnimationFrame(viewport.apply);
        window.addEventListener('load', viewport.apply);
        setTimeout(viewport.apply, 300);
        setTimeout(viewport.apply, 1000);

        // resize приходит при повороте, смене панели браузера и клавиатуре;
        // orientationchange на части устройств опережает resize и даёт
        // старое значение — поэтому пересчитываем ещё и следующим кадром
        window.addEventListener('resize', viewport.apply);
        window.addEventListener('orientationchange', () => {
            viewport.apply();
            requestAnimationFrame(viewport.apply);
            setTimeout(viewport.apply, 250);
        });

        // Возврат из фонового кэша браузера: разметка та же, размеры новые
        window.addEventListener('pageshow', viewport.apply);

        // Разворачивание свёрнутого приложения — тот самый случай, который
        // раньше приходилось делать руками, чтобы меню встало на место
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') viewport.apply();
        });

        // Экранная клавиатура и панель браузера двигают видимую область,
        // не вызывая resize в части браузеров
        window.visualViewport?.addEventListener('resize', viewport.apply);
    }
};
