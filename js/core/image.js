/**
 * Подготовка снимка к отправке в ИИ (§10 ТЗ).
 *
 * Токенов уменьшение почти не экономит: Gemini режет изображение на плитки
 * размером в треть меньшей стороны, поэтому снимок на 12 мегапикселей стоит
 * столько же, сколько картинка 1024×768 — около тысячи токенов.
 *
 * Экономит оно другое: объём запроса. Фотография с телефона весит 3–5 МБ,
 * в base64 разбухает ещё на треть, и по мобильной сети такой запрос просто
 * не доходит. После уменьшения остаётся около двухсот килобайт.
 */

/** Дальше этой стороны текст на фото читается не лучше, а весит вчетверо больше. */
const MAX_SIDE = 1280;

/** Качество JPEG: ниже начинают плыть засечки букв. */
const QUALITY = 0.82;

export const imageUtils = {

    MAX_SIDE,

    /**
     * Файл → base64 без префикса data:, готовый для inline_data.
     *
     * @param {File|Blob} file снимок из <input type="file">
     * @param {number} maxSide наибольшая сторона результата
     * @returns {Promise<{base64: string, width: number, height: number, bytes: number}>}
     */
    prepare: async (file, maxSide = MAX_SIDE) => {
        const bitmap = await imageUtils._decode(file);

        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        // Белая подложка: у PNG со снимка экрана прозрачные места иначе
        // станут чёрными, и текст на них пропадёт
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);

        if (bitmap.close) bitmap.close();

        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

        return {
            base64,
            width,
            height,
            // base64 кодирует три байта четырьмя символами
            bytes: Math.round(base64.length * 3 / 4)
        };
    },

    /**
     * Декодирование с запасным путём.
     * createImageBitmap быстрее и не держит DOM, но есть не везде.
     */
    _decode: async (file) => {
        if (typeof createImageBitmap === 'function') {
            try {
                return await createImageBitmap(file);
            } catch (e) {
                console.warn('[Фото] createImageBitmap не справился, читаю через Image:', e);
            }
        }

        const url = URL.createObjectURL(file);
        try {
            return await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
                img.src = url;
            });
        } finally {
            URL.revokeObjectURL(url);
        }
    }
};
