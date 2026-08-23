import { группа, тест, проверить } from '../runner.js';
import { i18n, t, plural } from '../../js/i18n/i18n.js';
import { ru } from '../../js/i18n/ru.js';
import { uk } from '../../js/i18n/uk.js';
import { en } from '../../js/i18n/en.js';

/** Плоский список ключей словаря. Формы множественного числа — один ключ. */
const ключи = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) && !('one' in v || 'other' in v)
        ? ключи(v, prefix + k + '.')
        : [prefix + k]);

/** Файлы приложения, в которых ищем обращения к переводу. */
const ИСХОДНИКИ = [
    'js/app.js', 'js/main.js', 'js/config.js',
    'js/core/dates.js', 'js/core/dialog.js', 'js/core/german.js', 'js/core/install.js',
    'js/core/lessonState.js', 'js/core/mastery.js', 'js/core/quiz.js', 'js/core/reminder.js',
    'js/core/scheduler.js', 'js/core/speech.js', 'js/core/srs.js',
    'js/services/ai.js', 'js/services/auth.js', 'js/services/db.js', 'js/services/sync.js',
    'js/services/wiktionary.js',
    'js/modules/chat.js', 'js/modules/control.js', 'js/modules/cycle.js', 'js/modules/dashboard.js',
    'js/modules/exercises.js', 'js/modules/onboarding.js', 'js/modules/profile.js',
    'js/modules/room.js', 'js/modules/scanner.js', 'js/modules/training.js'
];

группа('Локализация', () => {

    тест('украинский словарь не отстаёт от русского', () => {
        const нет = ключи(ru).filter(k => !ключи(uk).includes(k));
        проверить.совпадает(нет, [], 'ключи есть в ru, но нет в uk');
    });

    тест('английский словарь не отстаёт от русского', () => {
        const нет = ключи(ru).filter(k => !ключи(en).includes(k));
        проверить.совпадает(нет, [], 'ключи есть в ru, но нет в en');
    });

    тест('в переводах нет лишних ключей', () => {
        const базовые = ключи(ru);
        проверить.совпадает(ключи(uk).filter(k => !базовые.includes(k)), [], 'лишние ключи в uk');
        проверить.совпадает(ключи(en).filter(k => !базовые.includes(k)), [], 'лишние ключи в en');
    });

    тест('все ключи из кода существуют в словаре', async () => {
        // Пропущенный ключ показывается пользователю как «profile.status.mismatch»
        // и замечается только глазами — ровно то, что уже случалось
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

    тест('подстановки в переводах совпадают между языками', () => {
        // «{count}» в русском и «{number}» в английском — молчаливая
        // подстановка пустоты вместо числа
        // У форм множественного числа сравниваем набор имён, а не их
        // количество: в русском форм четыре, в английском две, и {count}
        // в каждой из них — это одна и та же подстановка
        const плейсхолдеры = (dict, key) => {
            const value = key.split('.').reduce((acc, part) => acc?.[part], dict);
            const text = typeof value === 'object' ? Object.values(value).join(' ') : String(value ?? '');
            return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort();
        };

        const расхождения = [];
        for (const key of ключи(ru)) {
            const базовые = плейсхолдеры(ru, key);
            for (const [имя, dict] of [['uk', uk], ['en', en]]) {
                const свои = плейсхолдеры(dict, key);
                if (JSON.stringify(базовые) !== JSON.stringify(свои)) {
                    расхождения.push(`${key} (${имя}): ${базовые.join(',')} против ${свои.join(',')}`);
                }
            }
        }

        проверить.совпадает(расхождения, []);
    });

    тест('перевод подставляет значения', () => {
        i18n.setLanguage('ru');
        проверить.содержит(t('training.wordOf', { current: 3, total: 10 }), '3');
        проверить.содержит(t('training.wordOf', { current: 3, total: 10 }), '10');
    });

    тест('формы множественного числа', () => {
        i18n.setLanguage('ru');
        проверить.содержит(plural('common.word', 1), 'слово');
        проверить.содержит(plural('common.word', 3), 'слова');
        проверить.содержит(plural('common.word', 7), 'слов');
    });

    тест('переключение языка меняет строки', () => {
        i18n.setLanguage('en');
        const английский = t('common.save');
        i18n.setLanguage('ru');
        const русский = t('common.save');
        проверить.истина(английский !== русский, 'строки на разных языках совпали');
    });
});
