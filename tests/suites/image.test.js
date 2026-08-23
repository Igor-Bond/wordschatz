import { группа, тест, проверить } from '../runner.js';
import { imageUtils } from '../../js/core/image.js';

/** Тестовый снимок нужного размера: рисуем и превращаем в файл. */
const снимок = (width, height, alpha = false) => new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!alpha) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, width, height);
    }

    // Что-нибудь контрастное, иначе JPEG сожмёт картинку почти в ноль
    ctx.fillStyle = '#f59e0b';
    for (let i = 0; i < width; i += 20) ctx.fillRect(i, 0, 10, height);

    canvas.toBlob(blob => resolve(new File([blob], 'проба.png', { type: 'image/png' })), 'image/png');
});

группа('Подготовка снимка', () => {

    тест('большое фото уменьшается до предела', async () => {
        // Снимок с телефона — около 3000×4000
        const файл = await снимок(2400, 1800);
        const r = await imageUtils.prepare(файл);

        проверить.равно(Math.max(r.width, r.height), imageUtils.MAX_SIDE);
        проверить.равно(r.height, Math.round(1800 * imageUtils.MAX_SIDE / 2400), 'пропорции должны сохраниться');
    });

    тест('вертикальный снимок тоже уменьшается по большей стороне', async () => {
        const r = await imageUtils.prepare(await снимок(900, 2200));
        проверить.равно(Math.max(r.width, r.height), imageUtils.MAX_SIDE);
        проверить.истина(r.width < r.height, 'ориентация должна сохраниться');
    });

    тест('маленькая картинка не растягивается', async () => {
        const r = await imageUtils.prepare(await снимок(320, 240));
        проверить.равно(r.width, 320);
        проверить.равно(r.height, 240);
    });

    тест('на выходе base64 без префикса', async () => {
        const r = await imageUtils.prepare(await снимок(600, 400));
        проверить.ложь(r.base64.startsWith('data:'), 'inline_data принимает голый base64');
        проверить.истина(/^[A-Za-z0-9+/=]+$/.test(r.base64.slice(0, 200)), 'ожидались только символы base64');
    });

    тест('вес запроса остаётся разумным', async () => {
        // Полноразмерное фото в base64 весит около пяти мегабайт и по
        // мобильной сети не доходит
        const r = await imageUtils.prepare(await снимок(2400, 1800));
        проверить.истина(r.bytes < 900 * 1024, `после уменьшения осталось ${Math.round(r.bytes / 1024)} КБ`);
    });

    тест('заданный предел соблюдается', async () => {
        const r = await imageUtils.prepare(await снимок(2000, 2000), 512);
        проверить.равно(r.width, 512);
        проверить.равно(r.height, 512);
    });

    тест('прозрачный PNG не чернеет', async () => {
        // JPEG прозрачности не знает: без белой подложки текст на
        // прозрачном фоне превратился бы в чёрное на чёрном
        const r = await imageUtils.prepare(await снимок(200, 200, true));

        const проверка = await new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.width; c.height = img.height;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                // Полосы идут через двадцать пикселей шириной в десять,
                // поэтому точка на пятнадцати попадает в промежуток —
                // там в исходнике прозрачность, а в результате должна
                // оказаться белая подложка
                resolve(ctx.getImageData(15, 15, 1, 1).data);
            };
            img.src = `data:image/jpeg;base64,${r.base64}`;
        });

        проверить.истина(проверка[0] > 200 && проверка[1] > 200 && проверка[2] > 200,
            `прозрачный угол стал цветом rgb(${проверка[0]},${проверка[1]},${проверка[2]})`);
    });

    тест('битый файл не притворяется картинкой', async () => {
        const мусор = new File([new Uint8Array([1, 2, 3, 4])], 'мусор.png', { type: 'image/png' });
        let упало = false;
        try {
            await imageUtils.prepare(мусор);
        } catch (e) {
            упало = true;
        }
        проверить.истина(упало, 'подготовка должна отказаться, а не отдать пустой снимок');
    });
});
