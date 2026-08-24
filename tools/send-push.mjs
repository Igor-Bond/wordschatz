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
 * Что нужно в секретах репозитория:
 *   VAPID_PRIVATE_KEY        — закрытая половина пары (публичная в js/core/push.js)
 *   VAPID_SUBJECT            — mailto:… или адрес сайта, требование протокола
 *   FIREBASE_SERVICE_ACCOUNT — JSON учётной записи службы, целиком
 *
 * Ничего из этого в репозиторий не попадает.
 */

import webpush from 'web-push';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

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
требуется(SERVICE_ACCOUNT, 'FIREBASE_SERVICE_ACCOUNT');

webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);

initializeApp({ credential: cert(JSON.parse(SERVICE_ACCOUNT)) });
const db = getFirestore();

/**
 * Подписки лежат подколлекцией у каждого пользователя:
 * users/{uid}/pushSubscriptions/{id}. Групповой запрос собирает их все
 * за один раз, не перебирая пользователей.
 */
const snapshot = await db.collectionGroup('pushSubscriptions').get();

if (snapshot.empty) {
    console.log('Подписок нет — отправлять некому.');
    process.exit(0);
}

const payload = JSON.stringify({ title: TITLE, body: BODY, url: URL_TO_OPEN });

let отправлено = 0;
let убрано = 0;

for (const документ of snapshot.docs) {
    const данные = документ.data();
    if (!данные?.endpoint || !данные?.keys) {
        console.warn(`Пропущена неполная подписка ${документ.ref.path}`);
        continue;
    }

    try {
        await webpush.sendNotification(
            { endpoint: данные.endpoint, keys: данные.keys },
            payload,
            { TTL: 12 * 60 * 60 }   // сутки не ждём: напоминание протухает
        );
        отправлено++;
    } catch (ошибка) {
        // 404 и 410 означают, что подписки больше нет: приложение удалили,
        // данные браузера почистили. Такую запись надо убрать, иначе она
        // будет отравлять каждый запуск до конца времён
        if (ошибка.statusCode === 404 || ошибка.statusCode === 410) {
            await документ.ref.delete();
            убрано++;
            continue;
        }

        console.error(`Не удалось отправить на ${документ.ref.path}: ${ошибка.statusCode} ${ошибка.body || ошибка.message}`);
    }
}

console.log(`Отправлено: ${отправлено}. Убрано протухших: ${убрано}. Всего подписок: ${snapshot.size}.`);
