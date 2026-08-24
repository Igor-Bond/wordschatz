import { profile } from './shared.js';
import { dialog } from '../../core/dialog.js';
import { config } from '../../config.js';
import { t } from '../../i18n/i18n.js';
import { dbService } from '../../services/db.js';

/** Резервная копия: выгрузка и восстановление (§29 ТЗ). */

export const backup = {

    /**
     * Полная резервная копия: словарь вместе с прогрессом SRS, темами,
     * планами, XP, лигой и стриком. API-ключ в копию не входит.
     */
    exportData: async () => {
        const backup = await dbService.exportAll();

        if (backup.words.length === 0) return await dialog.alert(t('profile.exportEmpty'));

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `wortschatz_backup_${dateUtils.today()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importData: (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (dbService.isFullBackup(data)) {
                    await profile.importFullBackup(data);
                } else if (Array.isArray(data)) {
                    // Копии старого формата — просто список слов
                    await profile.importLegacyWords(data);
                } else {
                    throw new Error(t('profile.unknownFormat'));
                }

                profile.renderDictionary();
                profile.renderStats();
            } catch (err) {
                console.error('Импорт не удался:', err);
                await dialog.alert(t('profile.importFailed') + '\n\n' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    importFullBackup: async (data) => {
        const when = data.exportedAt ? data.exportedAt.slice(0, 10) : t('profile.unknownDate');
        // Раньше выбор объяснялся текстом «ОК — заменить, Отмена — добавить»:
        // системный confirm умеет только две кнопки без подписей.
        const choice = await dialog.choose(
            t('profile.importSummary', {
                date: when,
                words: data.words.length,
                cycles: data.cycles?.length || 0
            }),
            [
                { value: 'merge', label: t('profile.importMerge'), hint: t('profile.importMergeHint'), primary: true },
                { value: 'replace', label: t('profile.importReplace'), hint: t('profile.importReplaceHint'), danger: true }
            ],
            { title: t('profile.import') }
        );

        if (choice === null) return;   // отменили

        if (choice === 'replace') {
            const result = await dbService.restoreFromBackup(data);

            // Профиль из копии поднимаем в localStorage, ключ остаётся местный
            if (data.profile) {
                const map = { name: 'name', level: 'level', dailyGoal: 'daily_goal',
                              interests: 'interests', model: 'model', uiLang: 'ui_lang' };
                for (const [field, key] of Object.entries(map)) {
                    if (data.profile[field] !== undefined && data.profile[field] !== null) {
                        localStorage.setItem(`ws_${key}`, data.profile[field]);
                    }
                }
            }

            await dialog.alert(t('profile.restored', {
                words: result.words,
                cycles: result.cycles,
                dayPlans: result.dayPlans
            }));
            location.reload();
            return;
        }

        // Слияние: чужие темы и планы не переносим, слова остаются вне тем
        const words = data.words.map(({ id, cycleId, ...w }) => ({ ...w, cycleId: null }));
        const { count } = await dbService.saveMultipleWords(words);
        await dialog.alert(t('profile.mergedFromBackup', { count }));
    },

    importLegacyWords: async (words) => {
        const { count } = await dbService.saveMultipleWords(words);
        await dialog.alert(t('profile.importedLegacy', { count }));
    }
};
