import { группа, тест, проверить } from '../runner.js';
import { i18n, t, plural } from '../../js/i18n/i18n.js';
import { ru } from '../../js/i18n/ru.js';

/** Плоский список ключей словаря. Формы множественного числа — один ключ. */
const ключи = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) && !('one' in v || 'other' in v)
        ? ключи(v, prefix + k + '.')
        : [prefix + k]);

/** Файлы приложения, в которых ищем обращения к словарю. */
const ИСХОДНИКИ = [
    'js/app.js', 'js/main.js', 'js/config.js',
    'js/core/dates.js', 'js/core/dialog.js', 'js/core/german.js', 'js/core/install.js',
    'js/core/lessonState.js', 'js/core/mastery.js', 'js/core/quiz.js',
    'js/core/scheduler.js', 'js/core/speech.js', 'js/core/srs.js',
    'js/services/ai.js', 'js/services/auth.js', 'js/services/db.js', 'js/services/sync.js',
    'js/services/wiktionary.js',
    'js/modules/chat.js', 'js/modules/control.js', 'js/modules/cycle.js', 'js/modules/dashboard.js',
    'js/modules/exercises.js', 'js/modules/onboarding.js', 'js/modules/profile.js',
    'js/modules/room.js', 'js/modules/scanner.js', 'js/modules/training.js'
];

группа('Строки интерфейса', () => {

    /*
     * Языков было три, осталcя один. Проверки на полноту переводов и
     * совпадение подстановок между словарями ушли вместе с ними — им
     * больше нечего сравнивать. Осталось то, что от числа языков не
     * зависит и ломается тише всего: ключ, которого нет.
     */

    тест('все ключи из кода существуют в словаре', async () => {
        // Пропущенный ключ показывается пользователю как
        // «profile.status.mismatch» и замечается только глазами — ровно
        // то, что уже случалось
        const набор = new Set(ключи(ru));
        const пропущенные = [];

        for (const путь of ИСХОДНИКИ) {
            const код = await (await fetch('../' + путь)).text();

            // t('ключ') и plural('ключ', ...) с постоянной строкой.
            // Закрывающая скобка или запятая сразу после строки отсекает
            // ключи, собираемые подстановкой: t('fields.' + name) проверить
            // нельзя, его значение известно только во время работы
            for (const m of код.matchAll(/\b(?:t|plural)\(\s*'([a-zA-Z][\w.]*)'\s*[,)]/g)) {
                if (!набор.has(m[1])) пропущенные.push(`${путь}: ${m[1]}`);
            }
        }

        проверить.совпадает(пропущенные, [], 'в коде используются несуществующие ключи');
    });

    тест('ключи из разметки тоже существуют', async () => {
        // data-i18n подставляется в index.html при запуске, и промах там
        // виден не в консоли, а прямо на кнопке
        const набор = new Set(ключи(ru));
        const разметка = await (await fetch('../index.html')).text();
        const пропущенные = [];

        for (const m of разметка.matchAll(/data-i18n(?:-html|-placeholder|-content|-aria)?="([\w.]+)"/g)) {
            if (!набор.has(m[1])) пропущенные.push(m[1]);
        }

        проверить.совпадает(пропущенные, [], 'в разметке используются несуществующие ключи');
    });

    тест('подстановка значений', () => {
        проверить.содержит(t('training.wordOf', { current: 3, total: 10 }), '3');
        проверить.содержит(t('training.wordOf', { current: 3, total: 10 }), '10');
    });

    тест('формы множественного числа', () => {
        проверить.содержит(plural('common.word', 1), 'слово');
        проверить.содержит(plural('common.word', 3), 'слова');
        проверить.содержит(plural('common.word', 7), 'слов');
    });

    тест('неизвестный ключ возвращается сам собой', () => {
        // Не пустая строка и не падение: на экране должно быть видно,
        // чего не хватает
        проверить.равно(t('нет.такого.ключа'), 'нет.такого.ключа');
    });

    тест('ключ с формами числа через t() не отдаётся строкой', () => {
        // common.word — объект из четырёх форм. Отдать его как строку
        // значит показать пользователю [object Object]
        проверить.равно(t('common.word'), 'common.word');
    });

    тест('язык один и он русский', () => {
        проверить.равно(i18n.language, 'ru');
        проверить.равно(i18n.aiLanguage().name, 'Russian');
    });
});
