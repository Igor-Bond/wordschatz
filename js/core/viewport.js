/**
 * Высота видимой области в переменной --app-height.
 *
 * Приложение занимает ровно экран: тело не прокручивается, нижнее меню
 * прижато к низу через absolute. Держалось это на 100dvh, и на Android
 * после перезагрузки из самого приложения (кнопка «Обновить» → SKIP_WAITING
 * → location.reload) высота иногда оставалась посчитанной для скрытой
 * панели браузера. Страница выходила выше экрана, от меню была видна одна
 * кромка, и лечилось это только сворачиванием приложения — то есть
 * событием resize, которое пересчитывало значение.
 *
 * Здесь то же самое делается явно: значение ставится при запуске и
 * обновляется на каждом событии, после которого высота могла измениться.
 * Застрять оно не может — в худшем случае будет пересчитано лишний раз.
 *
 * Берётся window.innerHeight, а не visualViewport.height: второй
 * уменьшается при появлении экранной клавиатуры, и меню прыгало бы вверх
 * поверх неё при каждом вводе ответа.
 */

export const viewport = {

    apply: () => {
        const высота = window.innerHeight;
        if (!высота) return;

        // Сравниваем с тем, что реально стоит в переменной, а не с
        // запомненным числом: иначе однажды разъехавшееся значение так и
        // осталось бы — событие пришло, но «высота та же», и выхода нет
        const текущая = document.documentElement.style.getPropertyValue('--app-height');
        if (текущая === `${высота}px`) return;

        document.documentElement.style.setProperty('--app-height', `${высота}px`);
    },

    init: () => {
        viewport.apply();

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
    }
};
