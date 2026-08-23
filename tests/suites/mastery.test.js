import { группа, тест, проверить } from '../runner.js';
import { masteryUtils } from '../../js/core/mastery.js';

const слово = (extra = {}) => ({ repetitions: 5, interval: 30, phase: 'review', recent: [], attempts: 0, correct: 0, ...extra });

группа('Освоенность', () => {

    тест('новое слово начинается с нуля', () => {
        проверить.равно(masteryUtils.compute({ repetitions: 0, interval: 0 }), 0);
    });

    тест('в фазе заучивания освоенность не превышает 25', () => {
        проверить.истина(masteryUtils.compute({ repetitions: 10, interval: 0, phase: 'learning' }) <= 25);
    });

    тест('освоенность растёт вместе с интервалом', () => {
        const семь = masteryUtils.compute({ repetitions: 3, interval: 7, phase: 'review' });
        const двадцать = masteryUtils.compute({ repetitions: 5, interval: 21, phase: 'review' });
        проверить.истина(двадцать > семь);
        проверить.вПределах(семь, 50, 60);
        проверить.вПределах(двадцать, 78, 82);
    });

    тест('«Снова» не поднимает освоенность', () => {
        // Раньше каждая оценка прибавляла «оценка × 5», включая провал:
        // слово, забытое десять раз, набирало полсотни процентов
        const w = слово({ recent: [1, 1, 1] });
        const до = masteryUtils.compute(w);
        masteryUtils.registerAnswer(w, false);
        masteryUtils.registerAnswer(w, false);
        проверить.истина(w.mastery < до, `после двух провалов было ${до}, стало ${w.mastery}`);
    });

    тест('ошибки понижают показатель через точность', () => {
        const все = masteryUtils.compute(слово({ recent: [1, 1, 1, 1, 1, 1, 1, 1] }));
        const половина = masteryUtils.compute(слово({ recent: [1, 0, 1, 0, 1, 0, 1, 0] }));
        const никаких = masteryUtils.compute(слово({ recent: [0, 0, 0, 0, 0, 0, 0, 0] }));
        проверить.истина(все > половина && половина > никаких);
    });

    тест('короткая история не штрафует', () => {
        // Новому слову неоткуда взять статистику, и наказывать его не за что
        проверить.равно(masteryUtils.accuracy(слово({ recent: [0, 0] })), null);
        проверить.равно(masteryUtils.compute(слово({ recent: [0, 0] })), masteryUtils.compute(слово()));
    });

    тест('освоено с интервала в три недели', () => {
        проверить.истина(masteryUtils.isLearned({ interval: 21, repetitions: 5 }));
        проверить.ложь(masteryUtils.isLearned({ interval: 20, repetitions: 5 }));
    });

    тест('освоено требует и точности', () => {
        проверить.ложь(masteryUtils.isLearned({ interval: 40, repetitions: 9, recent: [1, 0, 1, 0, 1, 0, 1, 0] }));
        проверить.истина(masteryUtils.isLearned({ interval: 40, repetitions: 9, recent: [1, 1, 1, 1, 1, 1, 1, 1] }));
    });

    тест('слабым считается слово с низкой точностью', () => {
        проверить.истина(masteryUtils.isWeak({ recent: [1, 0, 0, 0] }));
        проверить.ложь(masteryUtils.isWeak({ recent: [1, 1, 1, 1] }));
    });

    тест('ручная пометка делает слово слабым', () => {
        проверить.истина(masteryUtils.isWeak({ isDifficult: 1, recent: [1, 1, 1, 1] }));
    });

    тест('окно ответов не растёт бесконечно', () => {
        const w = слово();
        for (let i = 0; i < 30; i++) masteryUtils.registerAnswer(w, i % 2 === 0);
        проверить.равно(w.recent.length, 8, 'в окне должно остаться восемь последних ответов');
        проверить.равно(w.attempts, 30, 'общий счётчик попыток обрезаться не должен');
        проверить.равно(w.correct, 15);
    });

    тест('освоенность пересчитывается при ответе', () => {
        const w = слово({ recent: [1, 1, 1, 1] });
        masteryUtils.registerAnswer(w, true);
        проверить.равно(w.mastery, masteryUtils.compute(w));
    });
});
