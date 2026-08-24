import { profile } from './profile/shared.js';
import { stats } from './profile/stats.js';
import { quality } from './profile/quality.js';
import { account } from './profile/account.js';
import { dictionary } from './profile/dictionary.js';
import { backup } from './profile/backup.js';
import { t } from '../i18n/i18n.js';

/**
 * Экран профиля: оболочка и две вкладки.
 *
 * Сам файл занимался пятью несвязанными вещами и дорос до полутора тысяч
 * строк — статистика, словарь, качество карточек, облако и резервная
 * копия жили в одном объекте. Разложены по `profile/`, здесь остались
 * разметка экрана и переключение вкладок.
 *
 * Части собираются в один объект: разметка зовёт обработчики по имени
 * (`data-action="profile.deleteWord"`, `onclick="profile.switchTab(...)"`),
 * и снаружи профиль по-прежнему одна сущность.
 */
const shell = {

    render: async () => {
        document.body.classList.remove('lesson-mode');
        const main = document.getElementById('main-content');
        
        main.innerHTML = `
            <div class="fade-in max-w-lg mx-auto mt-2 pb-10">
                <div class="flex justify-between items-center mb-6 px-1">
                    <h2 class="text-2xl font-bold text-slate-100">${t('profile.title')}</h2>
                    <!--
                        Именно app.openSettings(), а не показ окна руками:
                        раньше кнопка просто снимала «hidden», поля оставались
                        со значениями по умолчанию из разметки, и сохранение
                        затирало выбранные при первом запуске уровень и норму.
                    -->
                    <button onclick="app.openSettings()" aria-label="${t('settings.title')}" class="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                </div>
                
                <div class="flex bg-slate-800 rounded-xl p-1 mb-6 border border-slate-700">
                    <button onclick="profile.switchTab('stats')" id="tab-prof-stats" class="flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all">${t('profile.tabStats')}</button>
                    <button onclick="profile.switchTab('dict')" id="tab-prof-dict" class="flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all">${t('profile.tabDict')}</button>
                </div>

                <div id="prof-mode-stats" class="space-y-4 fade-in">
                    <div class="flex justify-center items-center py-10"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div></div>
                </div>
                <div id="prof-mode-dict" class="space-y-4 hidden fade-in"></div>
            </div>

            <!-- Модальное окно редактирования слова -->
            <div id="edit-word-modal" class="hidden fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 transition-opacity duration-200">
                <div class="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] scale-95 transition-transform duration-200" id="edit-modal-content">
                    <div class="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                        <h3 class="text-lg font-bold text-slate-100">${t('profile.wordCard')}</h3>
                        <button onclick="profile.closeEditModal()" class="text-slate-400 hover:text-white transition-colors"><i class="fa-solid fa-xmark text-xl"></i></button>
                    </div>
                    <!--
                        Поля собираются кодом под часть речи. Раньше здесь были
                        два безымянных поля «Dativ / Rektion / Komp.» и
                        «Plural / Präteritum»: карточка глагола показывает
                        двенадцать полей, а починить в редакторе можно было
                        четыре.
                    -->
                    <div class="p-4 overflow-y-auto space-y-3 flex-1 hide-scrollbar" id="edit-fields">
                        <input type="hidden" id="edit-id">
                    </div>
                    
                    <div class="p-4 border-t border-slate-700 bg-slate-900/50">
                        <button onclick="profile.saveWordEdit()" class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl shadow transition-transform active:scale-95">${t('common.save')}</button>
                    </div>
                </div>
            </div>
        `;

        await profile.renderStats();
        await profile.renderDictionary();
    },

    switchTab: (tab) => {
        const tStats = document.getElementById('tab-prof-stats');
        const tDict = document.getElementById('tab-prof-dict');
        const mStats = document.getElementById('prof-mode-stats');
        const mDict = document.getElementById('prof-mode-dict');

        if (tab === 'stats') {
            tStats.className = "flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all";
            tDict.className = "flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all border border-transparent";
            mStats.classList.remove('hidden');
            mDict.classList.add('hidden');
        } else {
            tDict.className = "flex-1 py-2 text-sm font-bold rounded-lg bg-amber-500 text-slate-900 shadow transition-all";
            tStats.className = "flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all border border-transparent";
            mDict.classList.remove('hidden');
            mStats.classList.add('hidden');
        }
    },

};

Object.assign(profile, stats, quality, account, dictionary, backup, shell);

export { profile };
