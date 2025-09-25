# PWA Wallet Redesign (2025)

## 1. Цель и контекст
- Обновить клиентскую PWA (wallet.namo.uz) до современного responsive-уровня с визуалом, близким к Apple Wallet, сохраняя совместимость с текущими backend API и данными.
- Синхронизировать дизайн и UX с существующими решениями для админа и мерчанта, используя общий Tailwind-конфиг и частичные EJS-компоненты.
- Сконцентрироваться на производительности, оффлайн-доступе, доступности и полном покрытии актуальных бизнес-требований клиентов.

## 2. Текущее состояние клиента (wallet.namo.uz)
- Авторизация по номеру телефона с OTP (маршруты `/wallet`, `/client-register`, `/client-verify`). При отсутствии клиента создается запись в БД автоматически.
- Дашборд `/client/dashboard` показывает список OnlineVoucher с названием продукта, статусом, датой назначения и быстрыми действиями (просмотр, QR, переход в профиль и сканер).
- Отдельные страницы профиля (`/client/profile`), сканера (`/client/qr-scanner`) и логина поддерживают Tailwind CDN без единых токенов.
- PWA-составляющие формально присутствуют (`manifest.json`, пустой `sw.js`), но не обеспечивают кеширование, оффлайн и push.

## 3. Цели обновления
- Визуально привести интерфейс к Apple Wallet стилистике: градиентные карточки, стек-эффект, крупная типографика, четкие состояния ACTIVE/PENDING/USED/EXPIRED.
- Реализовать единый адаптивный макет для телефонов, планшетов и десктопов с поддержкой темной темы.
- Обеспечить оффлайн-доступ к последней синхронизации ваучеров, включая QR/штрихкоды и минимальные инструкции.
- Встроить плавные анимации, loading skeleton, обработку ошибок, push-инфраструктуру и аналитику взаимодействий.
- Поднять показатели Lighthouse (Performance >= 90, PWA >= 95, Accessibility >= 95).

## 4. Требования к функционалу

### 4.1. Глобальный каркас
- Single-shell PWA с header (время, уведомления, профиль), контентной зоной и нижней навигацией (Wallet, Scan, Profile). На десктопе bottom-nav трансформируется в левую панель.
- Tailwind theme переиспользует токены админки: цвета slate/indigo, spacing, скругления. Добавляются токены apple-blue, apple-gray, apple-green.
- Поддержка светлой/темной темы за счет CSS custom properties и Tailwind dark-модификаторов.

### 4.2. Дашборд / Wallet Home
- Карточки ваучеров отображаются каруселью (swipe) и списком. Каждая карточка показывает productName, value, статус, assignedAt, брендовые цвета.
- Верхняя панель: счетчики активных, ожидающих, использованных ваучеров, сумма экономии (рассчитывается на фронте).
- Действия: `Показать QR`, `Инструкции`, `Поделиться`, `Добавить в Wallet`.

### 4.3. Деталка ваучера
- Полноэкранный sheet/modal с большим QR (SVG/Canvas), штрихкодом Code128, статусом, product info и terms.
- Offline-ready: QR и terms кешируются в IndexedDB, отображается отметка последней синхронизации.
- Кнопки: `Добавить в Apple Wallet` (.pkpass), `Добавить в Google Wallet`, `Скопировать код`, `Поделиться`.

### 4.4. Сканер QR (`/wallet/scan`)
- Live-камера на базе `getUserMedia`, выбор камеры, фонарик, fallback ручного ввода.
- История последних пяти сканов хранится локально (IndexedDB).
- При успешном скане клиентских ваучеров открывается деталка; сторонние токены обрабатываются согласно бизнес-логике.

### 4.5. Аутентификация и онбординг
- Экран логина в стилистике Apple Wallet: карточка ввода номера, подсказки, WebOTP.
- Страница OTP поддерживает автоподстановку, таймер и повторную отправку.
- Fast-lane: после успешной OTP клиент сразу видит ваучеры; при отсутствии клиента запись создается.
- Сессия в secure cookies, при необходимости дублирование в localStorage для offline.

### 4.6. Профиль / Настройки
- Карточка с телефоном, датой первой покупки, переключателями уведомлений, выбором языка (RU/UZ/EN) и ссылками поддержки.
- Список устройств/сессий (при наличии данных) и кнопки logout, очистка кеша PWA.

### 4.7. Уведомления и коммуникация
- Badge уведомлений в header, inbox листером с группировкой по событиям.
- Web Push подписка через `/api/client/push-subscription`, хранение в БД.

### 4.8. PWA слой
- Service Worker реализует cache-first для статики, stale-while-revalidate для API, background sync для логов и подписок.
- Manifest расширяется adaptive icons, shortcuts (Scan, My Vouchers, Support), категория finance.
- IndexedDB кеш для ваучеров, QR и истории сканов.

### 4.9. Аналитика и логирование
- События: `wallet.open`, `voucher.view`, `voucher.qr_show`, `scan.success`, `scan.fail`, `profile.update`.
- Отправка на `/api/logs/frontend` с clientId, user-agent, timestamp.

### 4.10. Безопасность и приватность
- Маскирование телефона, хранение персональных данных в зашифрованных сессиях.
- Проверка Web Integrity (при возможности) как расширение.
- Строгая CSP и SRI для подключаемых скриптов.

## 5. API и данные
- Используются Prisma модели `OnlineVoucher`, `Voucher`, `Product`, `VoucherWalletLog`.
- Добавить REST endpoints:
  - `GET /api/client/vouchers` (список с состояниями, QR payload, terms, brandColor).
  - `GET /api/client/voucher/:id` (детальная карточка, события активации).
  - `POST /api/client/voucher/:id/log` (просмотры, добавление в wallet).
  - `POST /api/client/push-subscription` (подписка push).
- DTO расширяется полями `qrPayload`, `barcodePayload`, `terms`, `brandColor`, `lastSyncAt`.
- Контроллеры защищены `isClientAuthenticated`, валидируют принадлежность ваучеров клиенту.

## 6. UX-гайды и визуал
- Tailwind config объединяет admin/merchant токены, добавляет переменные для Apple-style цветов и градиентов.
- Карточки ваучеров используют Heroicons, shadow-xl, backdrop-filter для стек-эффекта.
- Анимации: CSS transitions 200ms, keyframes для появления карточек, skeleton loaders.
- Темная тема реализуется через CSS классы `dark` и prefers-color-scheme.

## 7. Нефункциональные требования
- TTI <= 1.5s на 4G; bundle JS <= 200KB gzip.
- Lighthouse: Performance >= 90, Accessibility >= 95, Best Practices >= 95, SEO >= 95, PWA >= 95.
- Работоспособность на iOS Safari 16+, Chrome 121+, Firefox 122+, Android WebView.
- Юнит- и e2e-тесты покрывают критические сценарии (логин, просмотр ваучера, оффлайн, сканер).
- QA на устройствах: iPhone 13, Samsung A52, Pixel 7, iPad mini.

## 8. Пошаговый план реализации

### Шаг 1. Подготовка окружения
1. Убедиться, что репозиторий синхронизирован: `git pull origin main`.
2. Установить зависимости и обновить lock-файл: `npm install` в каталоге `activation-system`.
3. Включить Tailwind CLI (если отсутствует) и добавить его в devDependencies.
4. Настроить `.env.sample` и `.env` для локального тестирования push/OTP.

### Шаг 2. Инвентаризация клиентского фронтенда
1. Проанализировать текущие EJS шаблоны `views/pages/client-*` и CSS в `public/css`.
2. Составить матрицу компонентов, которые следует вынести в `views/partials/client` (navbar, bottom-nav, карточка ваучера, модал, skeleton).
3. Задокументировать существующие Tailwind классы и выявить дублирование стиля.

### Шаг 3. Общий UI-кит и Tailwind конфигурация
1. Вынести Tailwind конфигурацию в файл `tailwind.config.cjs`, подключив общий preset админки (если уже есть) или создав новый общий preset.
2. Определить цветовые токены: `appleBlue`, `appleGray`, `appleGreen`, `walletBackground`, `walletCard`.
3. Настроить dark-mode через `class`, добавить mixins для gradients и blur.
4. Сгенерировать финальный CSS: `npx tailwindcss -i ./public/css/wallet-input.css -o ./public/css/wallet.css --watch`.

### Шаг 4. Рефакторинг шаблонов
1. Создать структуру `views/partials/client/{layout,navbar,bottom-nav,wallet-card,modal,skeleton}.ejs`.
2. Обновить `views/pages/client-dashboard.ejs` для использования layout partial и новых компонентов.
3. Переписать `client-profile.ejs`, `client-qr-scanner.ejs`, `client-login.ejs`, `client-register.ejs`, `client-verify.ejs` с использованием единого layout и CSS.
4. Убедиться, что логика отображения сохраняет текущие данные (phone, vouchers, statuses).

### Шаг 5. Логика ваучеров и API
1. Создать контроллер `controllers/client/api/voucherController.js` с методами `getVouchers`, `getVoucher`, `logVoucherEvent`.
2. Дополнить `routes/clientRoutes.js` REST-маршрутами `/api/client/vouchers`, `/api/client/voucher/:id`, `/api/client/voucher/:id/log`, `/api/client/push-subscription`.
3. Добавить Prisma запросы с `include` product, terms, brandColor, QR payload (генерируется на лету или из stored fields).
4. Написать unit-тесты для новых контроллеров (Jest) и моков Prisma.

### Шаг 6. Service Worker и оффлайн хранилище
1. Реализовать `public/sw.js` с Workbox или кастомной логикой: precache shell, cache-first для `/css` и `/js`, stale-while-revalidate для `/api/client/*`.
2. Добавить background sync queue для отправки логов ваучеров и push подписок.
3. Настроить IndexedDB (через `idb-keyval`) для сохранения списка ваучеров, QR данных и истории сканов.
4. Реализовать в браузерном коде модуль `public/js/walletOfflineStore.js`, который синхронизирует данные при запуске и при отсутствии сети показывает кеш.

### Шаг 7. QR и модальные окна
1. Реализовать компонент модала (pure JS) для отображения детальной карточки ваучера.
2. Использовать `qrcode` или `qr-code-styling` для генерации QR, `JsBarcode` для Code128.
3. Обновить фронтенд-скрипт, чтобы при клике `Показать` подгружать данные из API, кешировать в IndexedDB и открывать модал.
4. Добавить возможность `Добавить в Apple Wallet` (линк на `/wallet/pass/:id`) и `Добавить в Google Wallet` (deep-link на web wallet страницу).

### Шаг 8. Сканер QR
1. Переписать `client-qr-scanner.ejs` с использованием нового layout и Tailwind.
2. В `public/js/qrScanner.js` реализовать выбор камеры, фонарик (если поддерживается), fallback ручного ввода токена.
3. Сохранять результаты последних сканов в IndexedDB и отображать список под превью камеры.

### Шаг 9. Аутентификация и онбординг
1. Обновить `authController` (client) для отправки fast-lane ответа, который включает данные о наличии ваучеров.
2. В шаблонах логина и OTP реализовать маску телефона, обработку ошибок и визуальные состояния (loading, disabled buttons).
3. Добавить поддержку WebOTP API и Autofill hints (`autocomplete="one-time-code"`).
4. После успешной OTP делать программный переход на `/client/dashboard` с предзагрузкой ваучеров (prefetch API).

### Шаг 10. Профиль и настройки
1. Обновить `client-profile.ejs` с новыми компонентами и настройками (уведомления, язык, поддержка).
2. Реализовать переключение языков через выбор локали (подготовить i18n словарь).
3. Добавить действия очистки кеша PWA и logout с подтверждением.

### Шаг 11. Уведомления и аналитика
1. Настроить регистрацию service worker и push подписки в `public/js/app.js`.
2. Создать API `POST /api/client/push-subscription` и таблицу в БД (если отсутствует) для хранения подписок.
3. Реализовать отправку аналитических событий на `/api/logs/frontend` при ключевых действиях.
4. Отрисовать UI badge уведомлений и список последних push внутри профиля.

### Шаг 12. Тестирование и контроль качества
1. Написать Jest-тесты для контроллеров и вспомогательных модулей.
2. Добавить Cypress e2e сценарии: логин, просмотр ваучера, оффлайн режим, сканер, профиль.
3. Запустить Lighthouse через `lighthouse http://localhost:PORT/wallet --view` и добиться целевых показателей.
4. Провести ручное QA на списке устройств, сравнить с макетами, проверить dark mode.

### Шаг 13. Документация и релиз
1. Обновить README клиента краткой инструкцией по запуску PWA.
2. Зафиксировать изменения в `docs/TECH_SPEC_RELEASE.md` и `docs/ROADMAP_RELEASE.md` (если требуется).
3. Подготовить release-notes, описать откат (выключение service worker, возврат к старым шаблонам).
4. После деплоя проверить, что старые клиенты получают обновленный сервис-воркер (использовать `skipWaiting` и `clients.claim`).

## 9. Acceptance критерии
- UI соответствует макетам (pixel perfect +/-4px) и поддерживает светлую/темную темы.
- Пользователь с новым номером, получившим ваучер, после OTP видит свои ваучеры без дополнительных действий.
- PWA режим обеспечивает оффлайн-доступ к кешированному списку ваучеров и QR.
- Service Worker проходит Lighthouse PWA аудит без ошибок; IndexedDB хранит данные согласно требованиям.
- Логи `VoucherWalletLog` создаются при каждом открытии карточки и добавлении в Wallet, push подписки сохраняются.
- Документация в `docs/pwa-wallet-spec.md` и связанных файлах актуальна.

---
_Обновлено: 2025-XX-XX (уточнить дату при релизе)._
