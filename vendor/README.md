# vendor/ — локальные копии внешних библиотек

Раньше Tailwind, Dexie и Font Awesome грузились с CDN. Из-за этого приложение
не могло работать офлайн: service worker не кэширует кросс-доменные ответы,
а без Dexie и Tailwind страница просто не запускается.

Все зависимости зафиксированы по версиям и лежат в репозитории.
При обновлении — скачать заново теми же командами и поднять `APP_VERSION` в `sw.js`.

| Файл | Версия | Источник |
|---|---|---|
| `tailwind.min.js` | 3.4.16 | `https://cdn.tailwindcss.com/3.4.16` |
| `dexie.min.js` | 4.0.10 | `https://unpkg.com/dexie@4.0.10/dist/dexie.min.mjs` |
| `fontawesome/css/fontawesome.min.css` | 6.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/fontawesome.min.css` |
| `fontawesome/css/solid.min.css` | 6.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/solid.min.css` |
| `fontawesome/webfonts/fa-solid-900.woff2` | 6.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2` |

## Изменения относительно оригиналов

- **Font Awesome:** подключён только стиль `solid` — в приложении используется
  39 иконок и все они из этого набора (`regular` и `brands` не нужны).
  Из `solid.min.css` убрана ссылка на `fa-solid-900.ttf`, чтобы не тянуть
  лишние 400 КБ и не ловить 404 при прекэшировании.
- **Dexie:** используется ESM-сборка (в источнике `dexie.min.mjs`), переименована
  в `dexie.min.js`: не всякий хостинг отдаёт `.mjs` с правильным Content-Type,
  а при неверном типе импорт модуля падает и приложение не запускается. Она
  импортируется напрямую из `js/services/db.js`. Убрана ссылка на несуществующий sourcemap.

## Технический долг

`tailwind.min.js` — это Play CDN, то есть компилятор Tailwind, работающий
в браузере: 451 КБ и предупреждение в консоли «should not be used in production».
Сейчас это осознанный компромисс: он даёт офлайн без сборки и без риска, что
purge выкинет нужный класс (в коде классы собираются в JS-строках).

## Что осталось до Vite

Код уже переведён на нативные ES-модули, поэтому переход на Vite — небольшой
шаг. Он требует установленного Node (на машине разработки его пока нет):

1. `npm init -y`, затем `npm i -D vite` и `npm i dexie tailwindcss`.
2. `vite.config.js`: `base: './'`, `build.outDir: 'dist'`, копирование
   `manifest.json`, `sw.js`, `_redirects` и `assets/` в сборку.
3. В `js/services/db.js` заменить `'../../vendor/dexie.min.js'` на `'dexie'`.
4. Tailwind перевести на CLI-сборку с `content: ['index.html', 'js/**/*.js']`
   — вместо Play CDN получится примерно 15 КБ CSS. Проверить, что классы,
   собираемые в JS-строках, не выкинуты purge.
5. Font Awesome — либо оставить как есть, либо `npm i @fortawesome/fontawesome-free`.
6. Пути в `sw.js` привязать к именам файлов из сборки: Vite добавляет хеши,
   поэтому список прекэша придётся генерировать (`vite-plugin-pwa` делает это сам).
7. На Netlify указать build command `npm run build` и publish directory `dist`.

После этого папку `vendor/` можно удалить.
