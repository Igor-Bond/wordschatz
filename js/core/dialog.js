import { t } from '../i18n/i18n.js';

/**
 * Диалоги в оформлении приложения вместо системных alert и confirm.
 *
 * Системные окна выпадали из стиля, на мобильном показывали адрес сайта,
 * блокировали поток и не умели ничего, кроме «ОК» и «Отмена» — из-за чего
 * выбор при импорте копии приходилось объяснять текстом «ОК — заменить,
 * Отмена — добавить».
 *
 * Возвращают Promise, поэтому вызовы остаются такими же читаемыми:
 *   if (await dialog.confirm(...)) { ... }
 */

let активный = null;

export const dialog = {

    /** Сообщение с одной кнопкой. */
    alert: (message, options = {}) => dialog._show({
        message,
        title: options.title,
        buttons: [{ value: true, label: options.okLabel || t('common.ok'), primary: true }]
    }),

    /** Вопрос с подтверждением и отменой. */
    confirm: (message, options = {}) => dialog._show({
        message,
        title: options.title,
        danger: options.danger,
        buttons: [
            { value: false, label: options.cancelLabel || t('common.cancel') },
            { value: true, label: options.okLabel || t('common.ok'), primary: true, danger: options.danger }
        ]
    }),

    /**
     * Выбор из нескольких вариантов.
     * @param {Array} choices [{ value, label, hint, primary, danger }]
     */
    choose: (message, choices, options = {}) => dialog._show({
        message,
        title: options.title,
        stacked: true,
        buttons: [
            ...choices,
            { value: null, label: options.cancelLabel || t('common.cancel') }
        ]
    }),

    /** Открыт ли сейчас диалог — например, чтобы не открыть второй поверх. */
    get isOpen() {
        return activeState() !== null;
    },

    /**
     * Окно с готовой разметкой вместо текста.
     *
     * Нужно там, где содержимое — таблица, а не сообщение: склонение
     * прилагательного текстом в одну колонку нечитаемо. Разметку собирает
     * вызывающий и сам отвечает за экранирование того, что в неё попало.
     */
    custom: (html, options = {}) => dialog._show({
        html,
        title: options.title,
        tall: options.tall,
        buttons: [{ value: true, label: options.okLabel || t('common.close'), primary: true }]
    }),

    _show: ({ message, html, title, buttons, danger, stacked, tall }) => new Promise(resolve => {
        // Второй диалог поверх первого — закрываем предыдущий без ответа
        if (активный) активный.close(null);

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 opacity-0 transition-opacity duration-150';

        const btnClass = (b) => {
            if (b.danger) return 'bg-red-600 hover:bg-red-500 text-white';
            if (b.primary) return 'bg-amber-500 hover:bg-amber-400 text-slate-900';
            return 'bg-slate-900 border border-slate-600 text-slate-300 hover:border-slate-500';
        };

        /*
         * Высокое окно — для карточки слова.
         *
         * Обычный потолок в 55vh рассчитан на сообщение в три строки, и
         * карточка в нём выглядела огрызком: сама она занимает больше,
         * начиналась на четверти экрана, а внутри ещё и прокручивалась.
         * Содержимому, которое человек пришёл рассматривать, отдаём почти
         * весь экран.
         */
        const потолок = tall ? 'max-h-[78vh]' : 'max-h-[55vh]';
        const ширина = tall ? 'max-w-md' : 'max-w-sm';

        overlay.innerHTML = `
            <div class="bg-slate-800 rounded-2xl border ${danger ? 'border-red-500/40' : 'border-slate-700'} shadow-2xl w-full ${ширина} overflow-hidden translate-y-4 sm:translate-y-0 scale-100 sm:scale-95 transition-transform duration-150"
                 role="dialog" aria-modal="true">
                ${title ? `<div class="px-5 pt-5 pb-1"><h3 class="text-lg font-bold text-slate-100">${dialog._esc(title)}</h3></div>` : ''}
                <div class="px-5 ${title ? 'pt-1' : 'pt-5'} pb-5 ${потолок} overflow-y-auto">
                    ${html
                        ? `<div class="text-sm text-slate-300">${html}</div>`
                        : `<p class="text-sm text-slate-300 whitespace-pre-line leading-relaxed">${dialog._esc(message)}</p>`}
                </div>
                <div class="p-4 pb-[max(env(safe-area-inset-bottom),16px)] bg-slate-900/50 border-t border-slate-700 ${stacked ? 'space-y-2' : 'flex gap-2'}">
                    ${buttons.map((b, i) => `
                        <button data-index="${i}"
                            class="${stacked ? 'w-full' : 'flex-1'} py-3 rounded-xl font-bold text-sm active:scale-95 transition-all ${btnClass(b)}">
                            ${dialog._esc(b.label)}
                            ${b.hint ? `<span class="block text-[10px] font-normal opacity-70 mt-0.5">${dialog._esc(b.hint)}</span>` : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            overlay.firstElementChild.classList.remove('translate-y-4', 'sm:scale-95');
        });

        const close = (value) => {
            if (активный !== state) return;
            активный = null;
            document.removeEventListener('keydown', onKey);

            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.remove(), 150);
            resolve(value);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); close(buttons[0].value ?? null); }
            if (e.key === 'Enter') {
                e.preventDefault();
                const primary = buttons.find(b => b.primary) || buttons[buttons.length - 1];
                close(primary.value);
            }
        };

        overlay.querySelectorAll('button[data-index]').forEach(btn => {
            btn.addEventListener('click', () => close(buttons[Number(btn.dataset.index)].value));
        });

        // Клик по затемнению — отмена, как и в системном диалоге
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(buttons[0].value ?? null);
        });

        document.addEventListener('keydown', onKey);

        const state = { close };
        активный = state;

        // Фокус на главной кнопке, чтобы работал Enter и было видно с клавиатуры
        setTimeout(() => {
            const primaryIndex = buttons.findIndex(b => b.primary);
            overlay.querySelector(`button[data-index="${primaryIndex >= 0 ? primaryIndex : 0}"]`)?.focus();
        }, 60);
    }),

    _esc: (str) => String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
};

function activeState() {
    return активный;
}
