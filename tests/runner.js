/**
 * Крошечный движок тестов.
 *
 * Node на машине нет, поэтому набор — обычная страница: открыл в браузере,
 * увидел результат. Ничего, кроме браузера, не требуется.
 *
 * Правило набора: тесты не трогают базу пользователя. Проверяется чистая
 * логика — разбор форм, интервалы, освоенность, дистракторы, разбор статей
 * Wiktionary из зафиксированных образцов и полнота словарей перевода.
 * Всё, что пишет в IndexedDB, проверяется вручную в приложении: подменять
 * рабочую базу тестовой опаснее, чем не покрывать её.
 */

const groups = [];
let current = null;

/** Объявление группы проверок. */
export function группа(name, body) {
    current = { name, tests: [] };
    groups.push(current);
    body();
    current = null;
}

/** Отдельная проверка. Может быть асинхронной. */
export function тест(name, fn) {
    if (!current) throw new Error('тест вне группы: ' + name);
    current.tests.push({ name, fn });
}

const показать = (value) => {
    if (typeof value === 'string') return `«${value}»`;
    if (value === undefined) return 'undefined';
    try { return JSON.stringify(value); } catch (e) { return String(value); }
};

export const проверить = {
    равно(actual, expected, note = '') {
        if (actual !== expected) {
            throw new Error(`${note ? note + ': ' : ''}ожидалось ${показать(expected)}, получено ${показать(actual)}`);
        }
    },

    совпадает(actual, expected, note = '') {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) {
            throw new Error(`${note ? note + ': ' : ''}ожидалось ${b}, получено ${a}`);
        }
    },

    истина(value, note = '') {
        if (!value) throw new Error(`${note || 'ожидалось истинное значение'}, получено ${показать(value)}`);
    },

    ложь(value, note = '') {
        if (value) throw new Error(`${note || 'ожидалось ложное значение'}, получено ${показать(value)}`);
    },

    /** Число в пределах, включая границы. */
    вПределах(value, min, max, note = '') {
        if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
            throw new Error(`${note ? note + ': ' : ''}ожидалось число от ${min} до ${max}, получено ${показать(value)}`);
        }
    },

    содержит(haystack, needle, note = '') {
        const ok = Array.isArray(haystack) ? haystack.includes(needle) : String(haystack).includes(needle);
        if (!ok) throw new Error(`${note ? note + ': ' : ''}${показать(haystack)} не содержит ${показать(needle)}`);
    }
};

/** Запуск всех групп. Возвращает сводку. */
export async function запустить(onProgress = null) {
    const results = [];
    let passed = 0, failed = 0;

    for (const group of groups) {
        const groupResult = { name: group.name, tests: [] };

        for (const { name, fn } of group.tests) {
            const started = performance.now();
            try {
                await fn();
                groupResult.tests.push({ name, ok: true, ms: performance.now() - started });
                passed++;
            } catch (e) {
                groupResult.tests.push({ name, ok: false, error: e.message, ms: performance.now() - started });
                failed++;
            }
            if (onProgress) onProgress(passed + failed);
        }

        results.push(groupResult);
    }

    return { results, passed, failed, total: passed + failed };
}
