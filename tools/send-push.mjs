/**
 * Отправка напоминаний. Запускается расписанием GitHub Actions.
 *
 * Зачем это вообще: разбудить закрытое приложение веб не умеет —
 * `setTimeout` живёт со вкладкой, а расписание уведомлений в браузере
 * убрано. Нужен кто-то снаружи, кто раз в сутки пошлёт сообщение.
 * Своего сервера у проекта нет и не будет, поэтому в этой роли выступает
 * расписание GitHub Actions: для публичного репозитория оно бесплатно.
 *
 * Node здесь есть — он на машине сборщика, а не на машине автора.
 *
 * Откуда берутся подписки — два пути, и первый заведомо проще:
 *
 *   PUSH_SUBSCRIPTIONS — подписки прямо в секрете, одной строкой JSON.
 *       Кнопка «Скопировать подписку» в профиле кладёт нужное в буфер,
 *       остаётся вставить. Ничего больше настраивать не надо.
 *
 *   FIREBASE_SERVICE_ACCOUNT — если подписок много и хочется, чтобы
 *       новые устройства подхватывались сами. Тогда отправитель читает
 *       их из Firestore, куда приложение и так пишет.
 *
 * Что нужно в секретах репозитория в любом случае:
 *   VAPID_PRIVATE_KEY — закрытая половина пары (публичная в js/core/push.js)
 *   VAPID_SUBJECT     — mailto:… или адрес сайта, требование протокола
 *
 * Ничего из этого в репозиторий не попадает.
 */

import webpush from 'web-push';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';

const ИЗ_СЕКРЕТА = process.env.PUSH_SUBSCRIPTIONS;
const УЧЁТКА = process.env.FIREBASE_SERVICE_ACCOUNT;

const TITLE = process.env.PUSH_TITLE || 'WortSchatz';
const BODY = process.env.PUSH_BODY || 'Пора позаниматься немецким';
const URL_TO_OPEN = process.env.PUSH_URL || 'https://igor-bond.github.io/wordschatz/';

function требуется(значение, имя) {
    if (!значение) {
        console.error(`Нет обязательного значения ${имя}. Проверьте секреты репозитория.`);
        process.exit(1);
    }
    return значение;
}

требуется(PUBLIC_KEY, 'VAPID_PUBLIC_KEY');
требуется(PRIVATE_KEY, 'VAPID_PRIVATE_KEY');

if (!ИЗ_СЕКРЕТА && !УЧЁТКА) {
    console.error('Нет ни PUSH_SUBSCRIPTIONS, ни FIREBASE_SERVICE_ACCOUNT — отправлять некуда.');
    console.error('Простой путь: нажмите «Скопировать подписку» в профиле и вставьте в секрет PUSH_SUBSCRIPTIONS.');
    process.exit(1);
}

webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);

/**
 * Подписки из секрета.
 *
 * Принимаем и одну подписку объектом, и несколько массивом: человек
 * вставляет то, что дала кнопка, и не должен помнить про скобки.
 */
function изСекрета(текст) {
    let данные;
    try {
        данные = JSON.parse(текст);
    } catch (e) {
        console.error('PUSH_SUBSCRIPTIONS не разбирается как JSON:', e.message);
        process.exit(1);
    }

    const список = Array.isArray(данные) ? данные : [данные];
    return список.map((подписка, i) => ({ подписка, откуда: `секрет[${i}]`, убрать: null }));
}

/** Подписки из Firestore — путь для нескольких устройств. */
async function изОблака(учётка) {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    initializeApp({ credential: cert(JSON.parse(учётка)) });
    const db = getFirestore();

    // Групповой запрос собирает подписки всех пользователей за раз,
    // не перебирая их по одному
    const snapshot = await db.collectionGroup('pushSubscriptions').get();

    return snapshot.docs.map(документ => ({
        подписка: документ.data(),
        откуда: документ.ref.path,
        убрать: () => документ.ref.delete()
    }));
}

const записи = ИЗ_СЕКРЕТА ? изСекрета(ИЗ_СЕКРЕТА) : await изОблака(УЧЁТКА);
console.log(`Источник: ${ИЗ_СЕКРЕТА ? 'секрет PUSH_SUBSCRIPTIONS' : 'Firestore'}. Подписок: ${записи.length}.`);

if (!записи.length) {
    console.log('Подписок нет — отправлять некому.');
    process.exit(0);
}

const payload = JSON.stringify({ title: TITLE, body: BODY, url: URL_TO_OPEN });

let отправлено = 0;
let убрано = 0;
let протухших = 0;

for (const { подписка, откуда, убрать } of записи) {
    if (!подписка?.endpoint || !подписка?.keys) {
        console.warn(`Пропущена неполная подписка ${откуда}`);
        continue;
    }

    try {
        await webpush.sendNotification(
            { endpoint: подписка.endpoint, keys: подписка.keys },
            payload,
            { TTL: 12 * 60 * 60 }   // сутки не ждём: напоминание протухает
        );
        отправлено++;
    } catch (ошибка) {
        // 404 и 410 означают, что подписки больше нет: приложение удалили,
        // данные браузера почистили. Из облака такую запись убираем, из
        // секрета убрать нечем — говорим прямо, чтобы человек знал
        if (ошибка.statusCode === 404 || ошибка.statusCode === 410) {
            протухших++;
            if (убрать) { await убрать(); убрано++; }
            else console.warn(`Подписка ${откуда} больше не действует — скопируйте её заново из профиля.`);
            continue;
        }

        console.error(`Не удалось отправить на ${откуда}: ${ошибка.statusCode} ${ошибка.body || ошибка.message}`);
    }
}

console.log(`Отправлено: ${отправлено}. Протухших: ${протухших}, из них убрано: ${убрано}.`);

// Ни одной доставки — это не успех, и в журнале это должно быть видно
if (отправлено === 0) process.exit(1);
