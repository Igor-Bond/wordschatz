/**
 * Обработчики через делегирование вместо onclick в разметке.
 *
 * Разметка собирается строками, и содержимое слова подставлялось прямо
 * в код обработчика: onclick="training.playAudio('${word.word}')". Любой
 * апостроф в слове или переводе ломал такую строку — «geht's», «м'ясо»,
 * «don't». Экранировали это шестью разными способами, два из которых
 * не работали: один не трогал апостроф вовсе, другой превращал его в
 * HTML-сущность, которую браузер раскодирует обратно до разбора кода.
 * Кнопка при этом не сообщала об ошибке — она просто не нажималась.
 *
 * Здесь данные и код разведены: значения лежат в data-атрибутах, где
 * апостроф — обычный символ, а обработчик находится по имени.
 *
 *   <button data-action="training.playAudio" data-word="${actions.attr(w)}">
 *
 *   training: { playAudio: (el) => speech.say(el.dataset.word) }
 *
 * Обработчик получает сам элемент и событие. Модуль ищется в window —
 * там же, где его находили inline-обработчики.
 */

export const actions = {

    /**
     * Экранирование значения для подстановки в атрибут.
     *
     * Достаточно четырёх символов: кавычки закрывают атрибут, угловые
     * скобки — тег, амперсанд начинает сущность. Апостроф трогать не нужно
     * и нельзя — значение больше не попадает в код.
     */
    attr: (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;'),

    /** Разбор «модуль.метод» и вызов. */
    _run: (el, event) => {
        const path = el.dataset.action;
        if (!path) return;

        const [moduleName, methodName] = path.split('.');
        const module = window[moduleName];
        const handler = module?.[methodName];

        if (typeof handler !== 'function') {
            console.error(`[Действия] Обработчик не найден: ${path}`);
            return;
        }

        try {
            const result = handler.call(module, el, event);
            if (result?.catch) result.catch(e => console.error(`[Действия] Ошибка в ${path}:`, e));
        } catch (e) {
            console.error(`[Действия] Ошибка в ${path}:`, e);
        }
    },

    init: () => {
        // Один слушатель на весь документ: разметка перерисовывается
        // постоянно, и вешать обработчики на каждый новый узел значило бы
        // помнить о каждом месте отрисовки
        document.addEventListener('click', (event) => {
            const el = event.target.closest('[data-action]');
            if (el) actions._run(el, event);
        });
    }
};
