/**
 * Проверка ответа, опыт и переход дальше.
 *
 * Сюда приходит нажатие — на вариант или на «Проверить», — и отсюда
 * расходятся три следствия: подсветка на экране, запись опыта и сдвиг
 * расписания повторений. Последнее делается не всегда: свободная
 * тренировка в Комнате и контроль темы сроков не трогают, за это
 * отвечает _movesSchedule.
 */

import { exercises } from './shared.js';
import { announce } from '../../core/announce.js';
import { masteryUtils } from '../../core/mastery.js';
import { srs } from '../../core/srs.js';
import { germanUtils } from '../../core/german.js';
import { t } from '../../i18n/i18n.js';
import { dbService } from '../../services/db.js';
import { lessonStateManager } from '../../core/lessonState.js';
import { training } from '../training.js';

export const answer = {
    /**
     * Снимает с кнопки классы цвета, не трогая остальные.
     *
     * Дважды правилось, и оба раза по жалобе.
     *
     * Сперва было `replace(/(bg|border|text)-\S+/g, ' ')` — сносило
     * заодно `text-left` и `text-xl`, и после ответа текст терял и
     * выравнивание, и размер.
     *
     * Потом образец сузили до «свойство-цвет-оттенок», и он перестал
     * ловить два вида записи: цвет с прозрачностью (`bg-blue-900/30`) и
     * цвет под приставкой (`hover:bg-blue-900/50`). Обе стоят на кнопках
     * артикля — там свой цвет у каждого рода. Старый класс оставался и
     * перебивал новый: DER подсвечивался верно, а DIE, у которой фон
     * `bg-red-900/30`, оставалась красной, даже когда ответ верный.
     * Правильный ответ показывался красным — ровно наоборот смыслу.
     *
     * Кто победит, зависело не от порядка классов на элементе, а от
     * порядка правил в собранном CSS: утилиты с прозрачностью Tailwind
     * кладёт после обычных.
     */
    _stripColours: (el) => {
        const цвет = /^(?:hover:|focus:|active:)?(?:bg|border|text)-[a-z]+-\d{2,3}(?:\/\d{1,3})?$/;

        [...el.classList].forEach(cls => {
            if (цвет.test(cls)) el.classList.remove(cls);
        });
    },

    /**
     * Текст ответа на кнопке — и больше ничего.
     *
     * Значка здесь был. Он пережил три попытки поставить его так, чтобы
     * не двигал текст: слева — текст прыгал к середине; справа в потоке —
     * сдвигал трёхбуквенное «DER»; вне потока — встал намертво, но
     * длинный ответ поехал прямо под него. Четвёртой попыткой было бы
     * поле под значок, разное для выключки по левому краю и по центру.
     *
     * Значок убран вовсе. Он ничего не добавлял: верный ответ и так
     * зелёный, неверный красный и перечёркнутый, остальные погашены до
     * сорока процентов. Признак не через цвет тоже остаётся — верный
     * отличается от неверного зачёркиванием, а от прочих яркостью, — так
     * что и без цвета картина читается.
     *
     * Функция при этом нужна: у неверного ответа текст перечёркнут, а
     * вешать класс на саму кнопку нельзя, иначе перечёркивание получит и
     * то, что добавится к ней позже.
     */
    _answerRow: (text, textClass = '') => `<span class="block w-full ${textClass}">${text}</span>`,

    /**
     * Запись ошибки в разбор — по текущему слову очереди.
     *
     * Было выписано четырьмя одинаковыми кусками, и в двух из них слово
     * бралось без проверки: `exercises.queue[exercises.currentIndex].id`.
     * Пустая очередь роняла задание целиком. В обычном ходе урока она не
     * пустеет, но задание уходит дальше по таймеру, а его никто не
     * отменяет — отложенный вызов вполне может застать очередь уже
     * пройденной.
     *
     * Разбор ошибок вещь полезная, но не настолько, чтобы падать из-за
     * неё посреди урока.
     */
    _logMistake: (mode, value) => {
        const word = exercises.queue?.[exercises.currentIndex];
        if (!word?.id || !dbService?.logMistake) return;

        dbService.logMistake(word.id, mode, value);
    },

    /**
     * Ответ выбором из вариантов.
     *
     * Значения приходят из data-атрибутов нажатой кнопки: data-value —
     * что выбрали, data-correct — что верно, data-mode — тип задания.
     * Раньше они стояли прямо в onclick, а чтобы подсветить верный
     * вариант, атрибут разбирался обратно регулярным выражением
     * /checkChoice\(this,\s*'([^']+)'/ — оно останавливалось на первом
     * апострофе и на слове вроде «geht's» находило обрезок.
     */
    checkChoice: (btn) => {
        const selected = btn.dataset.value ?? '';
        const correct = btn.dataset.correct ?? '';
        const exType = btn.dataset.mode || 'choice';

        const btns = document.getElementById('ex-buttons').children;
        for (let b of btns) {
            b.disabled = true;

            const btnValue = b.dataset.value ?? null;
            const originalText = b.innerText.trim();
            exercises._stripColours(b);


            if (btnValue === correct) {
                // Без scale-105: увеличение раздвигает кнопку от середины,
                // и текст на левом краю уезжает ещё на несколько точек.
                // Зелёный фон со свечением и так виден, а читать ответ
                // удобнее с неподвижного места
                b.classList.add('bg-green-600', 'border-green-400', 'text-white', 'shadow-[0_0_15px_rgba(22,163,74,0.5)]', 'z-10');
                b.innerHTML = exercises._answerRow(originalText);
            } else if (btnValue === selected && selected !== correct) {
                // ЛОГИРОВАНИЕ ОШИБКИ
                exercises._logMistake(exType, selected);

                b.classList.add('bg-red-600', 'border-red-400', 'text-white');
                b.innerHTML = exercises._answerRow(originalText, 'line-through opacity-80');
            } else {
                b.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-500', 'opacity-40', 'scale-95');
                b.innerHTML = exercises._answerRow(originalText);
            }
        }

        exercises.awardXP(selected === correct);

        if (selected === correct) {
            setTimeout(exercises.next, 1200);
        } else {
            setTimeout(exercises.next, 2500);
        }
    },

    /**
     * Слова, чьё расписание двигает ответ в упражнении.
     *
     * Заполняет урок перед шагом упражнений: туда попадают те слова, для
     * которых упражнение — единственное извлечение за урок. Новые слова
     * сюда не входят, их уже оценили карточкой.
     */
    schedulingIds: null,

    /**
     * Двигать ли расписание слова по ответу в упражнении.
     *
     * Прежде расписание умела двигать только самооценка на карточке —
     * «Снова / Трудно / Хорошо / Легко». Это перевёрнуто: самооценка
     * ненадёжна, человек систематически переоценивает своё знание, когда
     * ответ только что был перед глазами. Ответ в упражнении объективен
     * и предсказывает лучше — а не влиял ни на что.
     *
     * Свободная тренировка и экзамен расписание не трогают: там слово
     * спрашивают вне очереди, и сдвигать от этого сроки нельзя.
     */
    _movesSchedule: (word) => !exercises.exam
        && !exercises.isRoomMode
        && !!exercises.schedulingIds?.has(word?.id),

    /**
     * Начисление опыта за задание.
     *
     * Раньше XP давали только карточки и экзамен — половина урока
     * (все девять типов упражнений) не вознаграждалась вовсе.
     *
     * @param {boolean} isCorrect засчитать ответ верным в истории слова
     * @param {object} [options]
     * @param {number} [options.xp] начислить столько вместо обычного
     * @param {boolean} [options.announceCorrect] что сказать чтецу, если
     *        это расходится с записью в историю. Расходятся они в одном
     *        месте: собранное не с первого раза предложение объявляется
     *        верным, а в историю идёт неверным — см. checkBuilder
     */
    awardXP: async (isCorrect, { xp = null, announceCorrect = isCorrect } = {}) => {
        const word = exercises.queue?.[exercises.currentIndex];

        /*
         * Результат ответа — вслух.
         *
         * Через эту точку проходят все десять типов заданий, поэтому
         * объявление стоит здесь, а не в каждом отклике. Зелёная рамка
         * ничего не сообщает тому, кто её не видит, а задание уходит
         * дальше через полторы секунды.
         */
        announce.say(announceCorrect
            ? t('exercises.announceCorrect')
            : t('exercises.announceWrong', { answer: word?.word ?? '' }));

        const gained = xp ?? (isCorrect ? exercises.XP_CORRECT : exercises.XP_WRONG);

        // За экзамен опыт начисляется по итогу, а не по каждому ответу
        if (exercises.exam) {
            try {
                exercises.exam.onAnswer(word, isCorrect, exercises._currentMode);
            } catch (e) {
                console.error('Экзамен не смог учесть ответ:', e);
            }
        } else {
            try {
                await dbService.addXP(gained);
            } catch (e) {
                console.error('Не удалось начислить XP:', e);
            }
        }

        // Ответы в упражнениях — самый частый сигнал о том, знает человек
        // слово или нет, но раньше они не влияли ни на что, кроме XP
        if (word?.id) {
            try {
                // Состояние читаем из базы, а не из очереди: на экзамене одно
                // слово спрашивают дважды разными заданиями, и обе копии в
                // очереди помнят историю на момент её сборки. Второй ответ
                // затирал бы первый вместо того, чтобы к нему прибавиться
                const stored = (await dbService.getWordById(word.id)) || word;
                masteryUtils.registerAnswer(stored, isCorrect);

                const поля = {
                    recent: stored.recent,
                    attempts: stored.attempts,
                    correct: stored.correct,
                    mastery: stored.mastery,

                    // Чтобы в следующий раз спросить иначе — см. pickByStage
                    lastMode: exercises._currentMode || stored.lastMode || null
                };

                if (exercises._movesSchedule(word)) {
                    srs.applyTo(stored, isCorrect ? 3 : 1);
                    Object.assign(поля, {
                        interval: stored.interval,
                        ease: stored.ease,
                        phase: stored.phase,
                        stepIndex: stored.stepIndex,
                        nextReview: stored.nextReview,
                        repetitions: stored.repetitions,
                        status: stored.status
                    });
                }

                await dbService.updateWord(word.id, поля);
                Object.assign(word, поля);
            } catch (e) {
                console.error('Не удалось сохранить результат ответа:', e);
            }
        }

        // В свободной тренировке и на экзамене счётчиков урока нет
        if (!exercises.exam && !exercises.isRoomMode && typeof training !== 'undefined' && training.state?.data) {
            training.state.data.xpEarned = (training.state.data.xpEarned || 0) + gained;
        }
    },

    /**
     * Ответ вводом. Правильный ответ приходит в data-correct кнопки:
     * в onclick он ломался на апострофе — «Wie geht's» и подобных.
     */
    checkInput: (btn) => {
        const correct = btn.dataset.correct ?? '';
        const exType = btn.dataset.mode || 'input';

        const input = document.getElementById('ex-input');
        const feedback = document.getElementById('ex-feedback');

        const selected = input.value.trim();

        // У некоторых форм допустимо несколько написаний («hat gemacht»
        // и «haben gemacht»), поэтому сверяемся со списком, а не со строкой
        const accepted = exercises.acceptedAnswers?.length ? exercises.acceptedAnswers : [correct];
        const isCorrect = germanUtils.matchesAnswer(selected, accepted);
        exercises.acceptedAnswers = null;

        input.disabled = true;
        btn.disabled = true;
        feedback.classList.remove('hidden');

        exercises.awardXP(isCorrect);

        if (isCorrect) {
            input.classList.remove('bg-slate-900', 'border-slate-600');
            input.classList.add('bg-green-900/40', 'border-green-500', 'text-green-400');
            
            feedback.className = "mt-4 font-bold text-lg p-3 rounded-xl bg-green-600 border border-green-400 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]";
            feedback.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Richtig!`;
            setTimeout(exercises.next, 1500);
        } else {
            // ЛОГИРОВАНИЕ ОШИБКИ
            exercises._logMistake(exType, selected);

            input.classList.remove('bg-slate-900', 'border-slate-600');
            input.classList.add('bg-red-900/40', 'border-red-500', 'text-red-400', 'line-through');
            
            feedback.className = "mt-4 font-bold text-lg p-3 rounded-xl bg-red-600 border border-red-400 text-white";
            feedback.innerHTML = `
                <div class="flex items-center justify-center mb-1"><i class="fa-solid fa-xmark mr-2"></i> Falsch!</div>
                <div class="text-red-100 text-sm font-normal pt-2 border-t border-red-400/50">
                    ${t('exercises.correctIs')}: <b class="text-white text-base tracking-wide">${correct}</b>
                </div>`;
            setTimeout(exercises.next, 3000);
        }
    },

    next: async () => {
        exercises.currentIndex++;
        
        if (!exercises.isRoomMode && typeof training !== 'undefined' && training.state && training.state.data) {
            await lessonStateManager.updateState('practice', exercises.currentIndex, training.state.data);
        }

        if (exercises.currentIndex < exercises.queue.length) {
            exercises.renderCurrent();
        } else {
            exercises.onFinish();
        }
    }
};
