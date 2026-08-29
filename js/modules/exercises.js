/**
 * Задания урока: оболочка над четырьмя частями.
 *
 * Файл занимался четырьмя несвязанными вещами и дорос до 1277 строк —
 * самый крупный модуль проекта. Ход урока с выбором типа задания,
 * отрисовка десяти заданий, сборщик из кусков и проверка ответа с
 * начислением опыта жили в одном объекте, и найти в нём нужное можно
 * было только поиском по имени.
 *
 * Разложено по `exercises/`:
 *
 *   stages.js   какое задание показать этому слову сейчас
 *   render.js   как выглядит каждое из десяти
 *   builder.js  сборка предложения и слова — единственное задание
 *               со своим состоянием между нажатиями
 *   answer.js   что происходит после ответа: подсветка, опыт, сроки
 *
 * Части собираются в один объект: разметка зовёт обработчики по имени
 * (`data-action="exercises.checkChoice"`), и снаружи задания по-прежнему
 * одна сущность. Так же устроен профиль — см. `modules/profile.js`.
 */

import { exercises } from './exercises/shared.js';
import { stages } from './exercises/stages.js';
import { render } from './exercises/render.js';
import { builder } from './exercises/builder.js';
import { answer } from './exercises/answer.js';

Object.assign(exercises, stages, render, builder, answer);

export { exercises };
