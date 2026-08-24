import { группа, тест, проверить } from '../runner.js';
import { auth } from '../../js/services/auth.js';

группа('Вход: оценка перехода по адресу', () => {

    /*
     * Вход переходом уводит на домен Firebase и возвращает обратно, а
     * Safari разделяет хранилище по доменам — вернувшись, SDK может не
     * найти своего состояния, и вход молча не завершается.
     *
     * Раньше по этой оценке переход запрещался. Оказалось хуже отказа:
     * во встроенном приложении на iPhone всплывающее окно не открывается
     * никогда, и запрет на переход означал, что вход не сработает вовсе.
     * Теперь оценка только подсказывает, кого предупредить заранее.
     */

    const iPhoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
    const iPhoneChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0 Mobile/15E148 Safari/604.1';
    const macSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    const androidChrome = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
    const windowsChrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    const windowsEdge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0';
    const androidFirefox = 'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0';

    тест('на iPhone переход не сработает ни в каком браузере', () => {
        проверить.истина(auth._redirectLikelyFails(iPhoneSafari, false), 'Safari');
        проверить.истина(auth._redirectLikelyFails(iPhoneChrome, false), 'Chrome на iOS — тот же движок');
    });

    тест('Safari на компьютере тоже под вопросом', () => {
        проверить.истина(auth._redirectLikelyFails(macSafari, false));
    });

    тест('iPad распознаётся по сенсорному экрану', () => {
        // Свежие iPad представляются настольным Safari, и отличить их
        // можно только по числу точек касания
        проверить.истина(auth._redirectLikelyFails(macSafari, true));
    });

    тест('где переход работает — там и не предупреждаем', () => {
        проверить.ложь(auth._redirectLikelyFails(androidChrome, false), 'Chrome на Android');
        проверить.ложь(auth._redirectLikelyFails(windowsChrome, false), 'Chrome на Windows');
        проверить.ложь(auth._redirectLikelyFails(windowsEdge, false), 'Edge');
        проверить.ложь(auth._redirectLikelyFails(androidFirefox, false), 'Firefox на Android');
    });

    тест('«Safari» в строке Chrome не сбивает с толку', () => {
        // Все браузеры на движке Blink пишут Safari в опознавательной
        // строке — проверка на одно это слово запретила бы переход везде
        проверить.ложь(auth._redirectLikelyFails(androidChrome, false));
    });
});

группа('Пометка о переходе на вход', () => {

    тест('пометка забирается один раз', () => {
        localStorage.setItem(auth.REDIRECT_KEY, '1');
        проверить.истина(auth.takeRedirectFlag(), 'первый раз — была');
        проверить.ложь(auth.takeRedirectFlag(), 'второй раз — уже нет');
    });

    тест('без пометки ничего не утверждаем', () => {
        localStorage.removeItem(auth.REDIRECT_KEY);
        проверить.ложь(auth.takeRedirectFlag());
    });
});
