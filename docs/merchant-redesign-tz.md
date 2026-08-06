# ТЗ: перенос нового дизайна мерчант-панели в прод (activation-system)

**Дата аудита:** 2026-08-05 (2 прохода)
**Статус:** черновик для согласования. **На проде изменений дизайна нет.** Единственное реально выполненное действие — удаление 2 неиспользуемых файлов (см. раздел 6).
**Источник дизайна:** `/home/admin1/posa-new-ui-ejs` (демо, хардкод-данные, Express+EJS — тот же стек)
**Целевой проект:** этот репозиторий (`activation-system`), Prisma + PostgreSQL, реальные пользователи и деньги.

Демо и прод сверены построчно: контроллеры, роуты, сессии, шаблоны, статика, Prisma-схема. Решения по открытым вопросам из первого прохода — приняты и зафиксированы в разделе 5. Ниже — карта соответствия, технические ловушки (часть — уже существующие в проде баги, найденные в процессе аудита, не связанные с редизайном), пошаговый план и чек-лист QA.

⚠️ **Важно:** в рабочей копии репозитория уже есть большой объём несвязанных незакоммиченных изменений (чужой активный WIP — контроллеры admin/client, миграции Prisma и т.д.). Я их не трогал и не буду — при внедрении этого ТЗ нужно быть аккуратным, чтобы не закоммитить чужой WIP вместе со стилевыми правками.

---

## 0. Главное правило и его точные границы

Требование: **не менять ничего, кроме оформления**; вход в мерчант-панель → продажа → чек → печать (офлайн) / SMS (онлайн) должны работать как сегодня.

- **Можно:** HTML-разметка, CSS, новые статические файлы (css/js/images), замена `merchant-navbar.ejs` на новый sidebar + мобильный bottom-nav.
- **Можно (решено, см. 5.1):** новая страница `GET /merchant/login`, которая переиспользует существующий `POST /auth/login` без дублирования логики аутентификации — требует одной маленькой точечной правки `authController.handleLogin` (см. 5.1.3).
- **Нельзя:** менять Prisma-запросы, генерацию PDF/QR, отправку SMS, способ ответа `confirmCheckout` (`res.send()` с сырым HTML — остаётся `res.send`, не переводим на `res.render`/redirect), роуты/URL (кроме одного нового `GET /merchant/login`), серверную валидацию.
- **Решено — не делаем (см. 5.2):** миддлвар/правки роутов ради живого бейджа корзины на всех экранах. Бейдж будет живым только там, где данные уже и так передаются (`/merchant/sell`, `/merchant/checkout`) — без единой правки контроллеров/роутов.
- **Решено — не делаем (см. 5.3):** картинки товара на корзине/истории/success. Картинки — только в каталоге (`/merchant/sell`), там, где Prisma и так их отдаёт.

---

## 1. Карта соответствия demo ↔ prod

| Что | Demo (`posa-new-ui-ejs`) | Prod (`activation-system`) | Комментарий |
|---|---|---|---|
| Layout-обёртка (sidebar+topbar+bottom-nav) | `views/layouts/merchant.ejs` | нет аналога — создать | Прод рендерит самостоятельные HTML-документы, которые дополнительно оборачиваются в общий `layouts/main.ejs` (см. 3.1) |
| Сайдбар | `views/partials/merchant/sidebar.ejs` | `views/partials/merchant-navbar.ejs` (топ-навбар) | Полная замена |
| Топбар (моб.) / bottom-nav (моб.) | `.../merchant/topbar.ejs`, `.../merchant/bottom-nav.ejs` | — | Новые файлы |
| Дашборд + История | `views/pages/merchant-sales.ejs` | `views/pages/merchant-sales.ejs` — тот же файл, рендерится и на `/merchant/dashboard`, и на `/merchant/sales` | Редактируем один файл |
| Продажа (каталог) | `views/pages/merchant-sell.ejs` | `views/pages/merchant-sell.ejs` | — |
| Чек (корзина) | `views/pages/merchant-checkout.ejs` | `views/pages/checkout.ejs` | ⚠️ имя файла в проде другое |
| Экран успеха продажи | `views/pages/merchant-checkout-success.ejs` (через redirect+render) | файла нет — `res.send()` сырого HTML прямо в `controllers/merchant/saleController.js` (2 инлайн-шаблона: OFFLINE/ONLINE) | ⚠️ другая архитектура, см. 3.2 |
| Логин мерчанта | `views/pages/merchant-login.ejs`, своя сессия `req.session.merchant`, свой POST | **новый** `views/pages/merchant-login.ejs`, но POST идёт на существующий `/auth/login` | См. 5.1 — решено делать отдельную страницу |
| CSS | `public/css/merchant.css` | создать новый файл; `public/css/admin.css` не трогаем (см. 3.1 — он всё равно неактивен) | |
| Шрифт | Google Fonts Inter | нигде не подключён на мерчант-страницах | новая внешняя зависимость, см. 3.6 |
| Логотип Namo | `/icons/icon-512.png` | `/images/icon-512.png` (файл идентичен, MD5 совпадает) | ⚠️ путь другой |
| Корзина в сессии | `req.session.merchantCart` | `req.session.cart` | ⚠️ имя ключа прода менять нельзя |
| Пользователь в сессии | `req.session.merchant = {username, displayName}` | `req.session.user = {id, username, role, vendorId, kassaId}` | ⚠️ нет `displayName`/`legalInfo` |
| Товары | `data/merchantMockData.js`, `product.image` — строка | Prisma `Product.images: [{url, isPrimary}]` | ⚠️ структура другая, см. 3.4 |

---

## 2. Роуты и вьюхи мерчанта в проде (сверено с кодом)

```
GET  /merchant/dashboard        dashboardController.showMerchantDashboard → pages/merchant-sales
GET  /merchant/sales            saleController.showMerchantSales          → pages/merchant-sales (тот же файл)
GET  /merchant/sell             cartController.showProductsForSale        → pages/merchant-sell
POST /merchant/add-to-cart      cartController.addToCart                  → redirect /merchant/checkout
GET  /merchant/checkout         cartController.showCart                   → pages/checkout
POST /merchant/update-cart      cartController.updateCart                 → no-op, redirect /merchant/checkout (не используется UI)
GET  /merchant/cart/remove/:id  cartController.removeFromCart             → redirect /merchant/checkout
POST /merchant/checkout/confirm saleController.confirmCheckout            → res.send() сырой HTML (OFFLINE/ONLINE)
GET/POST /merchant/activate     publicController.handleVoucherActivation  → публичный роут, вне мерчант-UX, не трогаем

Общая аутентификация (НЕ в /merchant, ⚠️ префикс /auth, не /login):
GET  /auth/login    authController.showLoginForm  → pages/login (без редиректа, если уже залогинен)
POST /auth/login    loginLimiter + authController.handleLogin → редирект по роли, ошибка → res.render('pages/login', {error})
GET/POST /auth/logout
```

`routes/merchantRoutes.js` монтируется как `app.use('/merchant', merchantRoutes)`. Мидлвары (`ensureMerchant`) применяются **по каждому роуту отдельно**, не через `router.use(...)` — это уже устоявшийся паттерн в файле (например, `/activate` — публичный, без `ensureMerchant`). Новый `GET /merchant/login` вписывается в этот же паттерн: добавляется как публичный роут без `ensureMerchant`.

---

## 3. Критичные технические находки («сложные моменты»)

### 3.1 Двойной HTML-документ: Bootstrap и Tailwind загружены одновременно — уже существующий баг

`index.js`: `app.set('layout', 'layouts/main')` — глобальный layout для всех `res.render()`, включая мерчант-страницы. Но `merchant-sales.ejs` / `merchant-sell.ejs` / `checkout.ejs` — сами по себе полноценные HTML-документы. Значит при рендере они вкладываются внутрь ещё одного HTML-документа (`layouts/main.ejs`, у которого свой `<head>` c Bootstrap 5.3 CDN).

Проверено эмпирически (реальный merge через jsdom — тот же движок парсинга HTML, что в Chrome/Node):

- Bootstrap 5.3 CSS реально загружен и активен на каждой мерчант-странице сегодня.
- `<title>` у мерчант-страниц не работает: во вкладке браузера всегда «Панель управления», а не «История продаж» и т.д. Существующий баг, к редизайну отношения не имеет.
- `public/css/admin.css` **никогда не компилируется** — там сырые директивы `@tailwind base/components/utilities` и `@layer`, а сборочный шаг (`npm run build:wallet`) собирает **только** `public/css/client.css`. Браузер эти директивы просто игнорирует как невалидный CSS — `admin.css` сегодня не даёт вообще никакого эффекта. Вся текущая стилизация — только через инлайн Tailwind-классы, обрабатываемые Play CDN в браузере.
- Bootstrap 5.3 «reboot» (сброс стилей) задаёт свои правила прямо на элементы `html`/`body` (margin, box-sizing, `background-color`/`color`/`font-family` через CSS-переменные `--bs-*`). Это ровно те же селекторы (`body {...}`), что использует новый `merchant.css`. Конфликта по факту не будет по той же причине, по которой сегодня работает Tailwind поверх Bootstrap: `<link>` нового `merchant.css` физически окажется **после** Bootstrap в DOM (foster parenting, см. ниже), и при равной специфичности выигрывает «последний» источник. Ожидаемо безопасно, но **обязательно проверить визуально** — это первое, что стоит посмотреть глазами после переноса.
- `<script>`/`<link>` из «внутреннего» `<head>` физически оказываются в теле документа (foster parenting), но это не мешает им работать — браузер выполняет `<script>` и применяет `<link rel=stylesheet>` независимо от места в DOM.

**Вывод для нового дизайна:**

- `public/css/merchant.css` не должен использовать `@tailwind`/`@layer` — обычный CSS (как в демо). Тогда он реально заработает.
- Все новые кастомные классы обязаны сохранять префикс `m-` (`m-btn`, `m-card`, `m-sidebar`, …) — Bootstrap реально содержит `.card`, `.btn`, `.table`, `.badge`, `.nav-link` и т.д. с реальными стилями.
- **Дополнительная рекомендация из этого прохода:** на мерчант-страницах убрать `<link rel="stylesheet" href="/css/admin.css">` из `<head>` — он всё равно ничего не делает (см. выше), это просто лишний сетевой запрос. Безопасное чисто косметическое удаление, в рамках «только стиль».
- Отдельно от этой задачи (опционально, на будущее): передавать `{ layout: false }` в `res.render()` для мерчант-страниц убрало бы двойной документ полностью. Не делается в рамках текущей задачи.

### 3.2 Экран успеха продажи — не страница, а прямой HTML-ответ с логикой печати

`saleController.confirmCheckout` не делает redirect и не рендерит EJS. Коротко: атомарная транзакция БД (ваучер → `sold`, `Sale`, `VoucherTransaction`, балансы merchant/vendor/kassa) → для OFFLINE генерация PDF+QR и сохранение в `/receipts/` → для ONLINE поиск/создание клиента и отправка SMS → **`res.send()`** с одним из двух HTML-литералов (OFFLINE содержит `<script>` с авто-печатью через скрытый `<iframe>`).

**Для прода:** оставить `res.send()` как есть по механике, поменять только визуальную часть внутри этих строк (см. план, п.4.5).

### 3.3 Проверка Prisma-схемы — денежные поля не Decimal, обращения к полям корректны

Специально проверил `prisma/schema.prisma`, чтобы не потерять данные при переносе:

- `Product.price`, `Sale.price`, `VoucherTransaction.{price,merchantDebt,kassaDebt,vendorDebt}`, `Merchant.balance` — все объявлены как `Float`, не `Decimal`. Значит `.toLocaleString('ru-RU')` в шаблонах работает как есть, без доп. коэрсии — переносить 1:1 из демо безопасно.
- `ProductImage.isPrimary` (Boolean) — поле реально существует, паттерн `product.images[0]?.url` в `merchant-sell.ejs` рабочий.
- `Product.status` — простая строка (`'on'`/`'off'`), паттерн `where: {status: 'on'}` в `cartController` корректен.
- `Voucher.status` — enum `VoucherStatus` со значением по умолчанию `active`, паттерн `where: {status: 'active'}` корректен.

Ничего менять не нужно — привожу здесь как подтверждение, что скрытых сюрпризов с типами данных в новой вёрстке не будет.

### 3.4 Товары — структура изображений отличается

Демо: `product.image` — строка. Прод: `product.images[0]?.url`, fallback `/images/product-placeholder.svg` — паттерн уже есть в текущем `merchant-sell.ejs`, просто переносим его в новую карточку без изменений.

### 3.5 Путь к логотипу отличается

Демо: `/icons/icon-512.png`. Прод: `/images/icon-512.png` (файл идентичен, сверено по MD5). Не забыть путь при переносе.

### 3.6 Google Fonts (Inter) — новая внешняя сетевая зависимость

CSP/helmet не настроен — блокировки не будет. При плохом интернете шрифт не подгрузится — сработает системный fallback-стек, не поломка.

### 3.7 CSS `:has()` — точка отказа на старых браузерах/POS-терминалах

`.m-radio-card:has(input:checked)` требует Chrome 105+/Safari 16.4+/Firefox 121+. На старых Android WebView POS-терминалов подсветка молча не сработает (радио продолжит работать нативно). **Рекомендация:** дублировать через JS (`change`-слушатель уже есть в checkout-скрипте) — добавлять/убирать класс `.is-selected` вручную.

### 3.8 Имя пользователя в сайдбаре — нет `displayName`

`req.session.user` — только `{id, username, role, vendorId, kassaId}`. Сайдбар/топбар используют `user.username` (как уже делает текущий `merchant-navbar.ejs`), не выдуманный `displayName`.

### 3.9 Имя файла вьюхи чека отличается

Демо: `merchant-checkout.ejs`. Прод: `checkout.ejs`. Редактируем существующий `views/pages/checkout.ejs`.

### 3.10 Убран световой эффект у кнопок

Цветной `box-shadow`-«глоу» у `.m-btn--primary` убран в демо (`public/css/merchant.css`) — переносить уже без него.

### 3.11 (новое) Токен чека — известное поведение, не баг редизайна

`cartController.showCart` перегенерирует `req.session.checkoutToken` при **каждом** `GET /merchant/checkout`. Если мерчант откроет чек в двух вкладках, «выживет» только последняя — старая форма при сабмите получит `409 «уже обработано»`. Это существующее поведение, редизайн его не трогает и не должен «чинить» — на всякий случай отмечаю, чтобы при QA это не приняли за новый баг.

### 3.12 (новое) Дефолтный способ продажи — офлайн или онлайн?

Сегодня в проде `checkout.ejs` по умолчанию выбран **`OFFLINE`** (`checked` стоит на офлайн-радио). По вашей отдельной правке в демо дефолт был сознательно переключён на **`ONLINE`** (с открытым полем телефона) — но это было отдельное решение по демо, не часть исходного «переноса стиля».

⚠️ **Нужно явно решить** (см. раздел 6, вопрос 1): при переносе в прод сохраняем текущий дефолт прода (OFFLINE), или переносим и это изменение поведения (ONLINE по умолчанию)? Это не вопрос стиля — это реальное поведение по умолчанию для персонала на кассе, стоит уточнить осознанно, а не перенести случайно вместе с CSS.

---

## 4. Дополнительные риски, найденные во втором проходе аудита

1. **ID-коллизии в JS.** `merchant-sell.ejs` использует `#productSearch`, `#productGrid`, `#productSearchEmpty` для поиска по каталогу (сегодня — инлайн-скрипт в самом файле, при переносе становится `public/js/merchant-sell.js`). Нужно убедиться, что новая вёрстка использует **те же ID**, иначе поиск молча перестанет работать (JS не найдёт элементы, ошибок в консоли тоже может не быть при `?.`-защите — тихий баг). Добавить в QA-чек-лист.
2. **`admin.css` используется не только мерчант-страницами** — это общий файл, подключённый также у admin/vendor/kassa (или их собственных страниц). Удаляем `<link>` на него **только** со страниц мерчанта (`merchant-sales.ejs`, `merchant-sell.ejs`, `checkout.ejs`, 2 success-шаблона), сам файл `public/css/admin.css` не трогаем и не удаляем — им могут (хоть и безрезультатно сегодня) пользоваться другие роли, менять их зону ответственности не нужно.
3. **`window.__APP_ROLE__`.** `merchant-navbar.ejs` сегодня выставляет `window.__APP_ROLE__ = 'Merchant'` инлайн-скриптом и снимает регистрацию service worker (это защита от «залипания» PWA service worker клиентского кошелька на служебных страницах). **Это нужно перенести в новый sidebar/layout as is** — если забыть, потенциально возможна ситуация, когда старый закешированный service worker кошелька перехватывает запросы на мерчант-страницах у пользователя, который до этого заходил в клиентский кошелёк с того же браузера. Мелкая, но реальная деталь, легко потерять при переписывании навбара с нуля.
4. **Мидлвар `checkSubdomain`.** В `index.js` подключён `middleware/checkSubdomain.js` до роутов — не проверял его логику подробно (вне зоны «стиль»), но раз он трогает `req`/маршрутизацию на уровне домена, стоит убедиться, что новый `GET /merchant/login` роут не требует специального поддомена, которого не будет у обычных мерчант-роутов. **Рекомендация:** явно проверить при разработке (открыть `/merchant/login` с тем же доменом/портом, что и остальные `/merchant/*` — раз они работают, новый публичный роут в том же неймспейсе должен вести себя так же).
5. **Повторно проверил орфан-файлы** (`git log`, `git status`, полнотекстовый поиск по репозиторию) — `views/pages/dashboard-merchant.ejs` и `views/pages/checkout-success.ejs` не менялись с 2026-03-26 (один коммит «restructure project to root level»), нигде не референсятся, uncommitted-изменений не было. **Удалил оба файла** (см. раздел 6) — это единственное реальное изменение в проде, сделанное в рамках этого аудита.

---

## 5. Решения по открытым вопросам предыдущего прохода

### 5.1 Логин-страница — решено: отдельная страница только для мерчанта

Делаем **новый** `GET /merchant/login`, отрисовывающий новый `views/pages/merchant-login.ejs` в новом брендинге. Общий `views/pages/login.ejs` и роут `/auth/login` **не трогаем** — их по-прежнему используют admin/vendor/kassa без изменений.

Чтобы не дублировать security-критичную логику (bcrypt, rate-limit, remember-me, refresh-токены, редирект по роли), новая страница **не заводит свой `POST`-хендлер** — форма отправляется на существующий `POST /auth/login` (`loginLimiter` + `authController.handleLogin`), с теми же именами полей: `username`, `password`, `rememberMe`.

Это даёт бесплатно: тот же rate-limit (20 попыток/15 минут по IP — не завязан на страницу-источник), тот же bcrypt/remember-me/refresh-flow, тот же редирект по роли (`role === 'merchant'` → `/merchant/dashboard`, уже реализовано в `handleLogin`).

**5.1.1 Новый роут (публичный, без `ensureMerchant`):**
```js
// routes/merchantRoutes.js
router.get('/login', (req, res) => res.render('pages/merchant-login', { error: null }));
```
Без проверки «уже залогинен» — сознательно копирует поведение существующего `authController.showLoginForm`, который тоже не редиректит залогиненных (единообразие, не новое поведение).

**5.1.2 Форма — те же имена полей + скрытый маркер варианта:**
```html
<form method="POST" action="/auth/login">
  <input type="hidden" name="loginVariant" value="merchant" />
  <input type="text" name="username" required />
  <input type="password" name="password" required />
  <input type="checkbox" name="rememberMe" value="1" />
  ...
</form>
```

**5.1.3 Единственная необходимая правка контроллера — рендер ошибки на «правильной» странице.**

Проблема: `handleLogin` при неверных данных всегда делает `res.render('pages/login', { error })` — если так и оставить, ошибка входа с новой мерчант-страницы **визуально откатит пользователя на старый дизайн** (жёсткий, заметный баг UX, если не поправить). Решение — минимальная точечная правка (не бизнес-логика, только выбор шаблона):

```js
// controllers/authController.js — было:
if (!user || !(await bcrypt.compare(password, user.password))) {
  return res.render('pages/login', { error: 'Invalid credentials' });
}
// станет:
if (!user || !(await bcrypt.compare(password, user.password))) {
  const view = req.body.loginVariant === 'merchant' ? 'pages/merchant-login' : 'pages/login';
  return res.render(view, { error: 'Invalid credentials' });
}
```
Больше нигде `handleLogin` трогать не нужно — успешный вход и так уже уводит на `/merchant/dashboard` по роли.

**5.1.4 Логаут** — оставить как есть, `/auth/logout` (общий), просто указать эту ссылку в новом сайдбаре/топбаре мерчанта.

### 5.2 Бейдж корзины в сайдбаре — решено: без правок роутов

Живой счётчик показываем **только** там, где данные и так уже передаются в текущих контроллерах, ничего в `routes/`/`controllers/` не меняем:

- `/merchant/sell` — `cartController.showProductsForSale` уже передаёт `cart: req.session.cart` → считаем количество прямо в шаблоне (`(cart||[]).reduce((s,i)=>s+i.quantity,0)`), передаём в `include` сайдбара как `cartCount`.
- `/merchant/checkout` — `cartController.showCart` уже передаёт `totalQuantity` → передаём его напрямую как `cartCount`.
- `/merchant/dashboard` и `/merchant/sales` — эти данные контроллеры сегодня не передают, и мы их не добавляем → на этих двух экранах бейдж **не отображается** (не «0», а просто отсутствует — sidebar использует `locals.cartCount`, безопасно для undefined).

Пример подключения partial (без изменений в контроллерах, только в самих `.ejs`):
```ejs
<%- include('../partials/merchant/sidebar', { active, user, cartCount: (cart||[]).reduce((s,i)=>s+i.quantity,0) }) %>   <%# merchant-sell.ejs %>
<%- include('../partials/merchant/sidebar', { active, user, cartCount: totalQuantity }) %>                              <%# checkout.ejs %>
<%- include('../partials/merchant/sidebar', { active, user }) %>                                                        <%# merchant-sales.ejs — без cartCount %>
```

Это сознательное, зафиксированное ограничение: **бейдж будет мигать/пропадать при переходах между разделами** — это ожидаемое поведение выбранного решения, не баг, не стоит его чинить позже без нового запроса.

### 5.3 Картинки товара на корзине/истории/success — решено: без картинок

Показываем миниатюры только на `/merchant/sell` (данные уже есть через `product.images[0]?.url`, см. 3.4). На корзине (`checkout.ejs`), истории (`merchant-sales.ejs`) и на 2 success-шаблонах — только текст, как сегодня. Контроллеры (`cartController.addToCart`, `saleController.confirmCheckout`) не трогаем вообще.

### 5.4–5.5 Мёртвые файлы — решено: удалены

Повторно проверено (git log, git status, полнотекстовый grep по всему репозиторию) — `views/pages/dashboard-merchant.ejs` и `views/pages/checkout-success.ejs` не используются ни одним роутом/контроллером, не менялись 5 месяцев, нет незакоммиченных правок. **Файлы удалены** (`rm`, изменение не закоммичено — лежит в рабочей копии как обычное `D` в `git status`, как и весь остальной текущий незакоммиченный WIP в репозитории; коммит не делал, это отдельное действие на ваше усмотрение).

---

## 6. Оставшийся открытый вопрос

1. **Дефолтный способ продажи на чеке** (см. 3.12): при переносе в прод — оставляем текущий дефолт прода (`OFFLINE` выбран по умолчанию), или переносим более позднее изменение из демо (`ONLINE` выбран по умолчанию, поле телефона сразу открыто)? Это меняет поведение персонала на кассе по умолчанию — не чисто визуальный вопрос, нужно ваше решение.

Все остальные вопросы предыдущего прохода закрыты и отражены в разделе 5.

---

## 7. Пошаговый план внедрения (после ответа на раздел 6)

1. Статические файлы: `public/css/merchant.css` (без `@tailwind`/`@layer`), `public/js/merchant-sell.js`, `public/js/merchant-checkout.js`, `views/partials/merchant/{sidebar,topbar,bottom-nav}.ejs` (порт из демо: `user.displayName`→`user.username`, `/icons/`→`/images/`, добавить `window.__APP_ROLE__='Merchant'` + отписку service worker из текущего `merchant-navbar.ejs`, см. 4.3).
2. `views/pages/merchant-sales.ejs` — новая вёрстка, сохранить все `<% %>`-вычисления и имена полей `sales[]` как есть; убрать `<link href="/css/admin.css">` (см. 4.2), добавить `merchant.css`.
3. `views/pages/merchant-sell.ejs` — новая вёрстка, сохранить `product.images[0]?.url` fallback, `activeVoucherCount`, форму `POST /merchant/add-to-cart`; сохранить ID `#productSearch`/`#productGrid`/`#productSearchEmpty` (см. 4.1) для работы `merchant-sell.js`.
4. `views/pages/checkout.ejs` — новая вёрстка, сохранить `checkoutToken` hidden input, `paymentConfirmed` (`required`), `saleType` со значениями `"OFFLINE"`/`"ONLINE"` (дефолт — по ответу на раздел 6), `name="customerPhone"`.
5. `controllers/merchant/saleController.js` — только отредактировать 2 HTML-литерала в `confirmCheckout` (визуал), не трогая бизнес-логику.
6. **Новое:** `views/pages/merchant-login.ejs` + роут `GET /merchant/login` в `routes/merchantRoutes.js` + точечная правка `authController.handleLogin` (см. 5.1.3).
7. `views/pages/login.ejs` — не трогать.

---

## 8. QA-чек-лист (обязательно пройти вручную после переноса, до деплоя в прод)

**Полный флоу — офлайн:**

- [ ] `/merchant/login` открывается, форма реально логинит через `/auth/login` (rate-limit, remember-me работают как раньше)
- [ ] Неверный логин/пароль на `/merchant/login` → ошибка показывается **на новой мерчант-странице**, не откатывается на старый дизайн (см. 5.1.3)
- [ ] Успешный вход → редирект на `/merchant/dashboard`, без 500
- [ ] Сайдбар/bottom-nav — `username`, активный пункт, ссылка «Выйти» → `/auth/logout`
- [ ] `/merchant/sales` — цифры совпадают с тем, что было до редизайна на том же аккаунте
- [ ] `/merchant/sell` — товары/остатки совпадают с продом, поиск по ID/названию реально фильтрует (см. 4.1 — ID-коллизии), товар без остатка не даёт добавить в корзину
- [ ] Бейдж корзины появляется на `/sell` и `/checkout` после добавления товара, **отсутствует** на `/dashboard`/`/sales` — это ожидаемо (5.2), не баг
- [ ] Чек: способ по умолчанию соответствует принятому решению (раздел 6), чекбокс «Оплата получена» обязателен
- [ ] Подтверждение (офлайн) → PDF генерируется в `/receipts/`, авто-печать (`iframe.print()`) срабатывает, в консоли нет JS-ошибок
- [ ] Повторная отправка формы (двойной клик/обновление) отклоняется («уже обработано») — см. 3.11, это не новый баг
- [ ] Продажа появляется в `/merchant/sales`, долг/сумма обновились

**Полный флоу — онлайн:**

- [ ] Поле телефона обязательно при выборе «Онлайн», валидация формата и на фронте, и на прямом POST
- [ ] SMS реально отправляется, клиент создаётся/находится по телефону
- [ ] Success-страница для онлайн показывает телефон, **не** пытается печатать PDF

**Кросс-браузер/устройства/побочные эффекты:**

- [ ] Десктоп 1280+ / мобильный 375px — сайдбар/bottom-nav не наезжают на контент, safe-area на iOS корректны
- [ ] Логин и остальные роли (admin/vendor/kassa) — визуально/функционально не изменились (общий `/auth/login`/`login.ejs` не тронуты)
- [ ] Открыть клиентский кошелёк в том же браузере до и после захода в мерчант-панель — service worker кошелька не должен «прилипать» к мерчант-страницам (см. 4.3, `window.__APP_ROLE__`)
- [ ] Визуально сверить фон/шрифт `<body>` на мерчант-страницах — убедиться, что Bootstrap reboot не «пробивает» новый `merchant.css` (см. 3.1, ожидается, что не пробивает, но не проверено вживую)

---

## 9. Что сознательно НЕ переносим 1:1 из демо

| Демо | Прод (решено) | Причина |
|---|---|---|
| `req.session.merchant` / свой POST для логина | Новая страница + существующий `POST /auth/login` | Не дублировать security-логику |
| `GET /merchant/checkout/success` (redirect+render) | `res.send()` как сейчас, новый визуал внутри строки | Менять флоу запрещено |
| Картинки на корзине/истории/success | Только на `/merchant/sell` | Решено в 5.3 |
| `req.session.merchantCart`/`merchantProducts` | `req.session.cart`, живые Prisma-данные | Нельзя менять контуры сессии |
| Живой бейдж корзины на всех 4 экранах | Только на `/sell` и `/checkout` | Решено в 5.2, без правок роутов |

---

Готов приступить к пошаговому внедрению (раздел 7) сразу после ответа на раздел 6. На проде реализовано только удаление 2 неиспользуемых файлов (раздел 5.4–5.5) — сами правки дизайна не применялись.
