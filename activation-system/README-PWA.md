# PWA поддержка клиента

Этот файл описывает, как проверить и сопровождать PWA-надстройку для клиентского кошелька.

## Что изменилось
- Добавлены артефакты PWA (`manifest.json`, `sw.js`, `offline.html`) в корневой каталог `public/`.
- В `index.js` настроена раздача `/wallet/**` и alias-маршруты для иконок, не перемещая исходные PNG.
- В общий макет `views/layouts/main.ejs` внедрены манифест, theme-color и регистрация service worker.

## Как проверить локально
1. Запустите проект (`npm start` или `docker-compose up backend`).
2. Откройте `http://localhost:4000/wallet`.
3. В Chrome DevTools → Application → Service Workers убедитесь, что зарегистрирован `/sw.js`.
4. Проверьте установку (Chrome: меню ⋮ → Установить приложение) — значок должен появиться.
5. Переключите вкладку Network в режим Offline и обновите страницу `/wallet`; должен либо загрузиться кеш приложения, либо отобразиться страница `offline.html`.

## Проверка Lighthouse
1. В Chrome DevTools → Lighthouse выберите категорию **Progressive Web App**.
2. Запустите аудит для `http://localhost:4000/wallet` (или `https://wallet.namo.uz/wallet` в проде).
3. Ожидаемые пункты: *Installable* ✅, *PWA Optimized* ✅.

## Особенности Docker
- Dockerfile уже копирует `public/`, поэтому дополнительные шаги не требуются.
- При использовании `docker-compose` при изменении `public/sw.js` перезапустите контейнер, чтобы Nginx/Express увидели обновлённый SW.
- В браузере после релиза принудительно обновляйте сервис-воркер (DevTools → Application → Update on reload) или попросите пользователей обновить вкладку.

## Откат изменений
- Удалите строки регистрации сервис-воркера и манифеста из `views/layouts/main.ejs`.
- Удалите маршруты `/wallet` и `/wallet/icons/*` из `index.js`.
