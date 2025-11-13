# План внедрения Apple Wallet в PWA

Документ основан на актуальном состоянии репозитория `/home/admin1/posa/activation-system` (проверено Codex). Ниже описаны простыми словами шаги, которые нужны, чтобы кнопка «Добавить в Apple Wallet» корректно работала только на iOS, скачивала `.pkpass`, и чтобы сканирование офлайн-QR сразу добавляло тот же пасс.

---

## 1. Что уже есть

- PWA интерфейс хранится в `views/partials/client/voucher-modal.ejs`, логика — в `public/js/client-app.js` и `public/js/client-scan.js`.
- Кнопка Apple уже отрисовывается, но всегда видима и просто делает `window.location.href = /wallet/pass/:id` (реального контроллера нет).
- API ваучеров (`controllers/client/api/voucherController.js`) возвращает данные без `passUrl`.
- QR-сканер после `claimVoucher` показывает модалку, но не вызывает загрузку `.pkpass`.
- Сервер не создает и не раздает `.pkpass` (нет сертификатов и сервиса passkit).
- Service Worker (`public/sw.js`) перехватывает все запросы и может закешировать будущий `.pkpass`, что нежелательно.

---

## 2. Файлы, которые нужно поправить

| Область | Файлы |
| --- | --- |
| UI и скрипты клиента | `views/partials/client/voucher-modal.ejs`, `public/js/client-app.js`, `public/js/client-scan.js`, `public/js/wallet-api.js`, `public/js/sw-update.js` (если нужна синхронизация), новый файл `public/js/platform.js`, новый helper `public/js/wallet-pass.js` |
| API и роутинг | `routes/clientRoutes.js`, новый `controllers/client/passController.js`, обновление `controllers/client/api/voucherController.js` |
| Генерация `.pkpass` | `services/passkitService.js` (новый), `package.json` (добавить библиотеку), `resources/passkit/**` (иконки, шаблон) |
| Service worker / оффлайн | `public/sw.js` |
| Конфигурация | `.env` и документация по переменным |
| Документация | добавить раздел в `docs/PWA/wallet-client-pwa.md` или текущий файл |

---

## 3. Пошаговые доработки

### 3.1 Определение платформы и показ кнопки
1. Создать `public/js/platform.js` с функциями `isIOS()` и `isStandaloneIOS()` (проверяем `navigator.userAgent` и `navigator.standalone`).
2. Импортировать helper в `public/js/client-app.js` и `public/js/client-scan.js`.
3. В `views/partials/client/voucher-modal.ejs` изначально скрыть кнопку Apple (`class="hidden"`, `data-platform="ios"`).
4. В `bootstrap()` (client-app) при старте:
   - Если `isIOS()` → убрать класс `hidden`.
   - Если не iOS → удалить элемент, чтобы Android не видел кнопку.

### 3.2 Загрузка `.pkpass` из PWA
1. Создать `public/js/wallet-pass.js` с функцией `downloadAppleWalletPass(voucherId, passUrl?)`, которая:
   - Берет `passUrl` из данных ваучера или строит `/wallet/pass/${voucherId}`;
   - Добавляет `?ts=${Date.now()}` ради обхода кеша;
   - Создает временную ссылку `a`, ставит `target="_blank"`, `rel="noopener"`, клик → удаляет.
2. В `populateModal(detail)` (`public/js/client-app.js`) заменить редирект на вызов `downloadAppleWalletPass(detail.id, detail.passUrl)` и логировать событие с `device: 'ios'`.
3. Если `passUrl` отсутствует (сервер не вернул), показывать пользователю сообщение об ошибке вместо кнопки.

### 3.3 Автодобавление после скана QR
1. В `public/js/client-scan.js` после успешного `claimVoucher`:
   - Оставить текущую модалку/кеширование.
   - Если `isIOS()` → вызвать `downloadAppleWalletPass(detail.id, detail.passUrl)` через `setTimeout(..., 150)` чтобы диалог успел открыться.
2. Добавить простой флаг, чтобы не запускать повторно, пока предыдущая загрузка не завершилась (иначе пользователь получит несколько окон).

### 3.4 API ваучеров и выдача `passUrl`
1. В `controllers/client/api/voucherController.js`:
   - В `buildDetail()` построить `const passUrl = new URL(\`/wallet/pass/${raw.voucher.id}\`, origin).toString();`.
   - Возвращать `passUrl` вместе с остальными полями.
   - Следить, чтобы `list`, `show`, `claim` использовали `buildDetail`, чтобы фронт всегда имел URL.
2. `wallet-api.js` оставляем без изменений, но теперь ответы будут с новым полем.

### 3.5 Маршрут скачивания `.pkpass`
1. Создать `controllers/client/passController.js`:
   - Проверить `req.session.client`.
   - Найти `OnlineVoucher` по `clientId` и `voucherId`.
   - Вызвать сервис `generateVoucherPass({ voucher, client })`.
   - Вернуть `Content-Type: application/vnd.apple.pkpass` + `Content-Disposition: attachment; filename="voucher-XXXX.pkpass"` + `Cache-Control: no-store`.
   - Логировать событие в `VoucherWalletLog` (`pkpassId = 'voucher.apple_wallet'`, `deviceInfo = 'ios'`).
2. Подключить маршрут в `routes/clientRoutes.js`: `router.get('/wallet/pass/:voucherId', isClientAuthenticated, passController.downloadApplePass);`.

### 3.6 Сервис генерации `.pkpass`
1. Добавить зависимость, например `npm install @walletpass/passkit`.
2. Создать `services/passkitService.js`:
   - Хранить пути к сертификатам/ключам в `.env` (`APPLE_WALLET_CERT_PATH`, `APPLE_WWDR_CERT_PATH`, `APPLE_WALLET_CERT_PASSWORD`, `APPLE_WALLET_TEAM_ID`, `APPLE_WALLET_PASS_TYPE_ID`, `APPLE_WALLET_ORG_NAME`).
   - Загружать шаблон пасса (`resources/passkit/pass.json`) и иконки (logo/icon background). Можно кэшировать их в памяти.
   - Заполнять `primaryFields` (название продукта), `secondaryFields` (код ваучера), `backFields` (условия, дата выдачи).
   - Подписывать и возвращать `Buffer`.
3. Создать README с описанием, где держать сертификаты и как обновлять.

### 3.7 Service Worker и оффлайн
1. В `public/sw.js` внутри обработчика `fetch` добавить:
   ```js
   if (request.url.includes('/wallet/pass/')) {
     event.respondWith(fetch(request));
     return;
   }
   ```
   Это гарантирует, что `.pkpass` не кешируется и не попадает в оффлайн-очередь.

### 3.8 Переменные окружения и документация
1. В `.env.example` и проектной документации указать новые ключи:
   ```env
   APPLE_WALLET_CERT_PATH=/path/to/certificates/pass-signing.p12
   APPLE_WALLET_CERT_PASSWORD=••••
   APPLE_WWDR_CERT_PATH=/path/to/AppleWWDRCA.pem
   APPLE_WALLET_TEAM_ID=ABCDE12345
   APPLE_WALLET_PASS_TYPE_ID=pass.com.company.wallet
   APPLE_WALLET_ORG_NAME=Namo
   ```
2. Обновить `docs/PWA/wallet-client-pwa.md` или текущий документ, чтобы описать процесс установки сертификатов и тестирования.

---

## 4. Тестовый чек-лист

1. `npm run build:wallet` → `npm start`.
2. iOS Safari / Capacitor:
   - Авторизоваться, открыть любой ваучер — кнопка Apple видна и инициирует загрузку `.pkpass`.
   - Проверить, что `.pkpass` открывается встроенным просмотрщиком Wallet.
3. Android (Bubblewrap/TWA):
   - Кнопки Apple нет, Google кнопка работает по-старому.
4. Страница «Сканер» на iOS:
   - Отсканировать QR с оффлайн-чека → ваучер появляется в списке, модалка открывается, тут же всплывает окно Wallet.
   - Повторное сканирование того же ваучера показывает ошибку «уже привязан».
5. Проверка логов:
   - `VoucherWalletLog` получает запись с `pkpassId = 'voucher.apple_wallet'`.
   - Запросы `/wallet/pass/:id` возвращают 200 только для владельца ваучера.

---

## 5. Следующие шаги

1. Подготовить и загрузить Apple сертификаты, прописать пути в `.env`.
2. Реализовать сервис `passkitService` и контроллер скачивания.
3. Обновить фронтенд (platform helper, модалки, сканер).
4. Обновить Service Worker и документацию.
5. Протестировать на реальном iOS устройстве (Safari и установленный Capacitor билд).
6. После стабилизации подумать о зеркальном сценарии для Google Wallet и об уведомлениях Push (будущие спринты).

---

Если нужен более детальный туториал по генерации сертификатов или загрузке их в проект — сообщите, добавим отдельный раздел.
