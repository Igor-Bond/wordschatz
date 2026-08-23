# vendor/ — локальные копии внешних библиотек

Раньше Tailwind, Dexie и Font Awesome грузились с CDN. Из-за этого приложение
не могло работать офлайн: service worker не кэширует кросс-доменные ответы,
а без Dexie и Tailwind страница просто не запускается.

Все зависимости зафиксированы по версиям и лежат в репозитории.
При обновлении — скачать заново теми же командами и поднять `APP_VERSION` в `sw.js`.

| Файл | Версия | Источник |
|---|---|---|
| `dexie.min.js` | 4.0.10 | `https://unpkg.com/dexie@4.0.10/dist/dexie.min.mjs` |
| `fontawesome/css/fontawesome.min.css` | 6.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/fontawesome.min.css` |
| `fontawesome/css/solid.min.css` | 6.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/solid.min.css` |
| `fontawesome/webfonts/fa-solid-900.woff2` | 6.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2` |
| `firebase/*` | 11.x | модульный SDK, импорты переписаны на относительные |

## Изменения относительно оригиналов

- **Font Awesome:** подключён только стиль `solid` — в приложении используется
  39 иконок и все они из этого набора (`regular` и `brands` не нужны).
  Из `solid.min.css` убрана ссылка на `fa-solid-900.ttf`, чтобы не тянуть
  лишние 400 КБ и не ловить 404 при прекэшировании.
- **Dexie:** используется ESM-сборка (в источнике `dexie.min.mjs`), переименована
  в `dexie.min.js`: не всякий хостинг отдаёт `.mjs` с правильным Content-Type,
  а при неверном типе импорт модуля падает и приложение не запускается. Она
  импортируется напрямую из `js/services/db.js`. Убрана ссылка на несуществующий sourcemap.
- **Firebase:** в модульном SDK импорты ведут на `https://www.gstatic.com/...`,
  из-за чего офлайн ломался. Переписаны на относительные.

## Tailwind здесь больше нет

Раньше в этой папке лежал `tailwind.min.js` — Play CDN, то есть компилятор
Tailwind весом 441 КБ, работавший в браузере при каждом запуске приложения.
Он заменён сборкой заранее: `css/tailwind.css`, около 37 КБ.

Собирается автономным исполняемым файлом Tailwind, Node не нужен:
`tools/build-css.ps1`. Подробности и порядок действий — в `docs/DEPLOY.md`.

Классы, которые в коде собираются подстановкой (`text-${accent}` и подобные),
перечислены в `safelist` в `tailwind.config.js` — сканер их не находит.
