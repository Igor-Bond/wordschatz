# vendor/ — локальные копии внешних библиотек

Раньше Tailwind, Dexie и Font Awesome грузились с CDN. Из-за этого приложение
не могло работать офлайн: service worker не кэширует кросс-доменные ответы,
а без Dexie и Tailwind страница просто не запускается.

Все зависимости зафиксированы по версиям и лежат в репозитории.
При обновлении — скачать заново теми же командами и поднять `APP_VERSION` в `sw.js`.

| Файл | Версия | Источник |
|---|---|---|
| `tailwind.min.js` | 3.4.16 | `https://cdn.tailwindcss.com/3.4.16` |
| `dexie.min.js` | 4.0.10 | `https://unpkg.com/dexie@4.0.10/dist/dexie.min.js` |
| `fontawesome/css/fontawesome.min.css` | 6.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/fontawesome.min.css` |
| `fontawesome/css/solid.min.css` | 6.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/solid.min.css` |
| `fontawesome/webfonts/fa-solid-900.woff2` | 6.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2` |

## Изменения относительно оригиналов

- **Font Awesome:** подключён только стиль `solid` — в приложении используется
  39 иконок и все они из этого набора (`regular` и `brands` не нужны).
  Из `solid.min.css` убрана ссылка на `fa-solid-900.ttf`, чтобы не тянуть
  лишние 400 КБ и не ловить 404 при прекэшировании.

## Технический долг

`tailwind.min.js` — это Play CDN, то есть компилятор Tailwind, работающий
в браузере: 451 КБ и предупреждение в консоли «should not be used in production».
Сейчас это осознанный компромисс: он даёт офлайн без сборки и без риска, что
purge выкинет нужный класс (в коде классы собираются в JS-строках).

Заменить на нормальную сборку Tailwind (~15 КБ CSS) имеет смысл вместе с
переходом на Vite и ES-модули.
