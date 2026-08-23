import { t } from '../i18n/i18n.js';

/**
 * Озвучка немецкого (§20 ТЗ).
 *
 * Раньше обе точки озвучки просто ставили utterance.lang = 'de-DE' и
 * надеялись на лучшее. На части Android немецкого голоса нет вовсе: система
 * либо молчит, либо читает немецкие слова русской фонетикой — и то и другое
 * хуже, чем честное «голос не установлен», потому что учит неправильному
 * произношению незаметно для пользователя.
 *
 * Здесь голос выбирается явно, а его отсутствие видно вызывающему коду.
 */

let cached = null;

/** Насколько голос нам подходит. Больше — лучше. */
const rank = (voice) => {
    let score = 0;
    if (voice.lang === 'de-DE') score += 10;          // литературный немецкий
    else if (voice.lang.startsWith('de')) score += 5; // de-AT, de-CH тоже сойдут
    if (voice.localService) score += 3;               // работает офлайн
    if (/deutsch|german/i.test(voice.name)) score += 1;
    return score;
};

export const speech = {

    /** Поддерживает ли браузер синтез речи вообще. */
    isSupported: () => typeof window !== 'undefined' && 'speechSynthesis' in window,

    /**
     * Список голосов.
     *
     * В Chrome первый вызов getVoices() возвращает пустой массив: список
     * подгружается асинхронно и приходит событием voiceschanged. Ждём его,
     * но не дольше секунды — иначе на системах без голосов вообще
     * зависли бы навсегда.
     */
    voices: async () => {
        if (!speech.isSupported()) return [];

        const now = window.speechSynthesis.getVoices();
        if (now.length) return now;

        return await new Promise(resolve => {
            const done = () => {
                window.speechSynthesis.removeEventListener('voiceschanged', done);
                clearTimeout(timer);
                resolve(window.speechSynthesis.getVoices() || []);
            };

            const timer = setTimeout(done, 1000);
            window.speechSynthesis.addEventListener('voiceschanged', done);
        });
    },

    /** Лучший немецкий голос или null. */
    germanVoice: async () => {
        if (cached !== null) return cached;

        const voices = await speech.voices();
        const german = voices.filter(v => (v.lang || '').toLowerCase().startsWith('de'));

        cached = german.length
            ? german.sort((a, b) => rank(b) - rank(a))[0]
            : null;

        return cached;
    },

    /** Есть ли чем читать по-немецки. */
    isAvailable: async () => !!(await speech.germanVoice()),

    /** Название голоса для раздела «Информация». */
    describe: async () => {
        if (!speech.isSupported()) return t('speech.unsupported');

        const voice = await speech.germanVoice();
        return voice ? `${voice.name} (${voice.lang})` : t('speech.missing');
    },

    /**
     * Прочитать текст по-немецки.
     *
     * @returns {Promise<boolean>} false, если читать нечем
     */
    speak: async (text, { onStart = null, onEnd = null } = {}) => {
        if (!speech.isSupported() || !String(text ?? '').trim()) return false;

        const voice = await speech.germanVoice();
        if (!voice) return false;

        // Очередь синтеза любит зависать — сбрасываем перед каждым запуском
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(String(text));
        utterance.voice = voice;
        utterance.lang = voice.lang;

        // Держим ссылку: без неё сборщик мусора может забрать объект
        // до окончания чтения, и оно оборвётся на середине
        window.currentSpeechUtterance = utterance;

        if (onEnd) {
            utterance.onend = onEnd;
            utterance.onerror = onEnd;
        }

        window.speechSynthesis.speak(utterance);
        if (onStart) onStart();

        return true;
    },

    /** Забыть выбранный голос — например, после установки нового. */
    reset: () => { cached = null; }
};
