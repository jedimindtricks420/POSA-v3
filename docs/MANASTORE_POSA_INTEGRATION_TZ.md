# ТЗ: интеграция ManaStore в POSA

**Дата:** 2026-07-17  
**Обновлено (1):** 2026-07-17 — сверено с реальной документацией `docs.manastore.com`. Разделы 5–11, 15, 18, 24 скорректированы: исходные допущения по формату API (SKU/price/referenceId, единый статус, ключ в ответе createOrder) не совпадали с реальным контрактом ManaStore. Добавлен раздел 26 с фактической спецификацией API и раздел 27 с планом ввода в эксплуатацию.  
**Обновлено (2):** 2026-07-17 — добавлены требования по обязательному отображению модуля в меню админки (раздел 13.1, зеркально Rokky) и по рабочему переключению staging/prod (раздел 6.1, раздел 7). Сверено с реальной структурой `views/partials/admin-navbar.ejs` и `admin-rokky-dashboard.ejs`.  
**Обновлено (3):** 2026-07-17 — добавлен раздел 13.2: точные правки дропдауна «Тип товаров» в формах вендора (`admin-add-vendor.ejs`, `admin-edit-vendor.ejs`), лейбла в списке вендоров, поля SKU в `edit-product.ejs`, ссылки в финансовом дашборде и — критично — включение `manastoreOrder` в обе выборки истории клиента (`storeController.js`, `store/activate.ejs`), без чего ключ ManaStore не отображался бы клиенту повторно. Сверено построчно с реальным кодом Rokky.  
**Обновлено (4):** 2026-07-17 — проведено теоретическое сквозное тестирование по всем ролям системы (раздел 13.3: `admin`, `financial_mgr`, `content_mgr`, `support_agent`, `vendor`/`vendor_user`, `merchant`, `kassa_*`, клиент). Найден и добавлен критичный пробел (раздел 13.2h): `services/voucherActivationService.js:59` разрешал бы вендор-пользователю ManaStore обойти всю интеграцию через `/vendor/activate`, выдав клиенту фиктивный ключ. Также добавлено сохранение `manastoreVariantId` в `productController.js` (раздел 13.2d) — поле в форме без этого не сохранялось бы.  
**Обновлено (5):** 2026-07-17 — весь модуль реализован, миграция накатана и код развёрнут в работающем контейнере `activation-system` (по подтверждению пользователя), протестирован **живым** staging-ключом ManaStore. Найдены и исправлены реальные баги, не видные по документации: (а) `POST /orders` и `GET /orders/{order}` оборачивают объект заказа в `{data: {...}}`, а `getProduct` — тоже (раздел 26.8, пп. 1-2); (б) `variant.price`/`variant.face_value` — объекты с полем `decimal`-строкой, а не числа (раздел 26.8, п.3); (в) `VoucherActivation.createdAt`/`Sale.createdAt` не существуют (`activatedAt`/`date`) — унаследовано из паттерна Rokky, исправлено только в ManaStore-контроллере (раздел 12). Полный E2E прогон (OTP-логин демо-клиентом → активация реального ваучера → реальный вызов ManaStore API → идемпотентность при повторной активации) выполнен успешно на staging.  
**Цель:** создать в POSA новый модуль провайдера ManaStore по аналогии с текущей интеграцией Rokky/DrWeb — с полной видимостью в админке и безопасным переключением между тестовым и боевым контуром ManaStore.

---

## 1. Цель задачи

Реализовать в системе **POSA** нового поставщика цифровых товаров — **ManaStore** — так, чтобы:

- администратор мог вести каталог SKU ManaStore в админке POSA;
- локальные товары POSA можно было привязывать к SKU ManaStore;
- при активации ваучера POSA вызывался API ManaStore;
- результат заказа, ключи и ошибки сохранялись в базе;
- в админке были доступны логи API, история активаций и финансовая сводка.

---

## 2. Бизнес-результат

После внедрения администратор должен иметь возможность:

1. создать/загрузить SKU ManaStore;
2. привязать SKU к товару POSA;
3. активировать ваучер через стандартный flow магазина;
4. автоматически получать ключ/код из ManaStore;
5. просматривать историю активаций, статусы заказов и API-логи.

---

## 3. Scope

### Входит в задачу
- backend-интеграция с API ManaStore;
- новые модели Prisma;
- админ-модуль ManaStore;
- интеграция в `storeController`;
- env-конфигурация;
- API-логирование;
- обработка ошибок и повторных запросов;
- минимальные тесты и smoke-проверки.

### Не входит
- общий рефакторинг POSA;
- полная переделка старых Rokky/DrWeb модулей;
- webhook-интеграция, если она не нужна по docs;
- массовый импорт каталога, если его нет в API ManaStore.

---

## 4. Архитектурная база POSA, которую нужно повторить

Новый модуль должен строиться по образцу Rokky:

- `routes/adminRoutes.js`
- `controllers/admin/rokkyController.js`
- `services/rokkyService.js`
- `controllers/storeController.js`
- `prisma/schema.prisma`
- `views/pages/admin-rokky-*.ejs`

Для ManaStore должен быть реализован такой же набор сущностей и слоёв.

---

## 5. Изменения в модели данных

### 5.1. Новый тип вендора

В `VendorProductType` добавить:

```prisma
enum VendorProductType {
  ROKKY
  DRWEB
  MANUAL
  VOUCHER
  MANASTORE
}
```

### 5.2. Product

> **Правка:** у ManaStore нет строкового SKU — товар идентифицируется числовым `product_variant_id` (см. раздел 26.3). Поле переименовано и типизировано под реальный контракт.

В модель `Product` добавить поле:

```prisma
manastoreVariantId Int? // product_variant_id из каталога ManaStore (GET /products)
```

### 5.3. Новые таблицы

#### ManaStoreOrder

> **Правка:** ManaStore возвращает не один `status`, а пару `fulfillment_status` / `payment_status` (раздел 26.4). Внутренний нормализованный `status` оставлен для совместимости с общим flow активации, но сырые поля сохраняются отдельно для диагностики. Ключей может быть несколько (по числу позиций/кодов в заказе) — добавлено поле `codes` для полного набора.

> Поле `environment` (раздел 6.1) фиксирует, в каком контуре реально создан заказ — обязательно для обеих таблиц ниже, иначе тестовый и боевой заказ неотличимы в БД.

```prisma
model ManaStoreOrder {
  id                Int      @id @default(autoincrement())
  voucherId         Int      @unique
  environment       String   // staging | production — контур, в котором создан заказ
  manaOrderId       String   // ulid заказа ManaStore, используется в путях /orders/{order}
  manaOrderNumber   String?  // order_number — человекочитаемый номер для саппорта/логов
  variantId         Int
  fulfillmentStatus String?  // pending, processing, partially_fulfilled, completed, refunded
  paymentStatus     String?  // pending, completed
  status            String   // внутренний нормализованный: PENDING, COMPLETED, FAILED, REFUNDED
  key               String?  // первый/основной код — для совместимости с общим flow
  codes             String?  @db.Text // JSON: полный список {code, serial_number, pin_code, expiration_date}
  rawContent        String?  @db.Text
  errorMessage      String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  voucher Voucher @relation(fields: [voucherId], references: [id])
}
```

#### ManaStoreApiLog

> **Правка:** `referenceId` из ТЗ не применим — ManaStore не принимает partner reference id при создании заказа (раздел 26.3). Поле оставлено nullable для совместимости с общей структурой логов, но реально заполняться не будет при createOrder; можно использовать для `voucherId` как внутренней метки.

```prisma
model ManaStoreApiLog {
  id           Int      @id @default(autoincrement())
  method       String
  environment  String   // staging | production — контур, из которого выполнен вызов
  variantId    String?
  referenceId  String?  // внутренний voucherId POSA (ManaStore такое поле не принимает)
  requestData  String?  @db.Text
  responseData String?  @db.Text
  statusCode   Int?
  success      Boolean
  errorMessage String?  @db.Text
  duration     Int?
  createdAt    DateTime @default(now())
}
```

#### ManaStoreSku

> **Правка:** добавлены `variantId` (реальный идентификатор для API), `productId` (родительский товар — нужен для каталога) и `faceValue` (поле `variant.face_value` из каталога ManaStore). `sku` оставлен как опциональный внутренний алиас для админки — нативного SKU-кода ManaStore не выдаёт.

```prisma
model ManaStoreSku {
  id          Int      @id @default(autoincrement())
  variantId   Int      @unique // product_variant_id из ManaStore
  productId   Int?     // id родительского товара ManaStore (для каталога/синка)
  sku         String?  // опциональный внутренний код/алиас для админки
  name        String
  description String?
  category    String?
  costPrice   Float?   // закупочная — ManaStore её не отдаёт, вводится вручную
  retailPrice Float?
  faceValue   Float?   // face_value из каталога ManaStore, если отличается от price
  currency    String?
  meta        String?  @db.Text // сырой JSON товара/варианта из каталога
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 5.4. Voucher

В `Voucher` добавить связь:

```prisma
manastoreOrder ManaStoreOrder?
```

---

## 6. ENV-конфигурация

> **Правка:** авторизация ManaStore — только Bearer-токен (Account Settings → API Key), никакого partner code / username+password / отдельного secret. Убраны `MANASTORE_API_SECRET`, `MANASTORE_USERNAME`, `MANASTORE_PASSWORD`, `MANASTORE_PARTNER_ID` — в реальном API им нечего передавать.

> **Требование пользователя:** переключение staging/prod должно реально работать, а не быть просто заметкой в доке. Ниже — конкретная схема: **раздельные наборы credentials на каждый контур** плюс один явный переключатель `MANASTORE_ENV`. Это исключает ситуацию «указали staging URL, а ключ и wallet_id — от прода» (или наоборот), которая при реальном списании денег особенно опасна.

Добавить переменные окружения:

```env
# Переключатель контура: staging | production. По умолчанию — staging (безопасный дефолт).
MANASTORE_ENV=staging

# Staging (тестовый контур)
MANASTORE_API_URL_STAGING=https://api-staging.manastore.com/api/v1
MANASTORE_API_KEY_STAGING=
MANASTORE_WALLET_ID_STAGING=

# Production (боевой контур)
MANASTORE_API_URL_PRODUCTION=https://api.manastore.com/api/v1
MANASTORE_API_KEY_PRODUCTION=
MANASTORE_WALLET_ID_PRODUCTION=

MANASTORE_TIMEOUT_MS=30000
MANASTORE_MOCK=false
MANASTORE_WEBHOOK_SECRET=         # ⚠ не подтверждено доками ManaStore — уточнить у поддержки, есть ли подпись webhook (см. 26.6)
```

### Требования
- использовать только реально нужные поля по docs ManaStore (см. раздел 26);
- не логировать секреты (Bearer-токены обоих контуров, `MANASTORE_WEBHOOK_SECRET`);
- `MANASTORE_MOCK` должен включаться только явно:

```js
const MOCK_MODE = process.env.MANASTORE_MOCK === 'true';
```

### 6.1. Механизм переключения staging/prod

В кодовой базе POSA уже есть прецедент переключения поведения через env (`NODE_ENV === 'production'` в `index.js`/`authTokens.js`) — новый механизм следует тому же принципу: **явный env-флаг, читаемый при старте процесса, без скрытого рантайм-состояния в БД.**

**Почему не одно-кликовый тумблер в админке:** ManaStore списывает реальные деньги с `wallet_id` при каждом `createOrder`. Если бы переключение staging↔prod было доступно живым тумблером в UI, случайный клик администратора во время отладки мог бы моментально начать тратить боевой кошелёк или наоборот — потерять тестовый заказ в проде. Поэтому переключение — осознанное действие с правкой `.env` и рестартом процесса, а не клик в интерфейсе.

**Как это должно работать:**
1. `manastoreService.js` при инициализации читает `MANASTORE_ENV` и выбирает соответствующий блок credentials (`*_STAGING` или `*_PRODUCTION`);
2. если для выбранного `MANASTORE_ENV` отсутствует API-ключ или `wallet_id` — сервис должен **упасть при старте** с понятной ошибкой (`ManaStore: missing credentials for environment "production"`), а не тихо продолжить работу с пустыми значениями;
3. каждая запись в `ManaStoreApiLog` и `ManaStoreOrder` должна содержать поле `environment` (`staging`/`production`) — чтобы тестовые и боевые заказы никогда нельзя было перепутать при разборе логов (см. раздел 5.3, обновлённые модели ниже);
4. в дашборде ManaStore (раздел 12) должен быть заметный, некликабельный бейдж текущего контура (например жёлтый «STAGING» / красный «PRODUCTION»), читаемый напрямую из `process.env.MANASTORE_ENV`, а не из БД — чтобы бейдж не мог разойтись с тем, что реально использует процесс;
5. дополнительная защита: если `MANASTORE_ENV=production`, а `NODE_ENV !== 'production'` (боевые ключи по ошибке оказались в dev-окружении) — при старте логировать явное предупреждение.

**Переключение на практике:** сменить `MANASTORE_ENV` в `.env` (credentials обоих контуров уже присутствуют одновременно) → перезапустить процесс. Никакого редеплоя кода не требуется — это чисто конфигурационное действие.

---

## 7. Новый сервис интеграции

Создать файл:

```txt
services/manastoreService.js
```

> **Правка:** `createOrder` в реальном API не принимает ни `sku`, ни `price`, ни `referenceId` (раздел 26.3) — только `wallet_id` + `items[].product_variant_id` + `quantity`. Цена/себестоимость для маржи берутся из локального `ManaStoreSku`, а не из ответа заказа. `getOrderContent` — не опциональный fallback, а обязательный второй вызов почти всегда: `createOrder` **никогда** не возвращает ключ в своём ответе (раздел 26.3, 26.5). `listProducts` — не опционально, каталог реально доступен и должен использоваться для синка (раздел 15).

### Обязательные методы

#### `createOrder(variantId, quantity = 1)`
Создаёт заказ в ManaStore (`POST /orders`, тело `{ wallet_id, items: [{ product_variant_id, quantity }] }`).

**Должен возвращать:**

```js
{
  manaOrderId: string,       // ulid заказа
  manaOrderNumber: string,   // order_number
  fulfillmentStatus: string, // pending | processing | partially_fulfilled | completed | refunded
  paymentStatus: string,     // pending | completed
  status: 'COMPLETED' | 'PENDING' | 'FAILED', // нормализованный, см. раздел 8
  rawContent: object | null
}
```

Ключ (`key`) в этом ответе не появляется никогда — его отдаёт `getOrderContent`.

#### `getOrderStatus(manaOrderId)`
`GET /orders/{order}` — актуальные `fulfillment_status`/`payment_status`.

#### `getOrderContent(manaOrderId)`
`GET /orders/{order}/get-codes` — получает коды. Ответ содержит по каждой позиции `status` (`completed`/`pending`) и массив `codes` с `code`/`serial_number`/`pin_code`/`expiration_date`. Должен возвращаться в нормализованном виде:

```js
{
  ready: boolean,   // true если все позиции completed
  codes: [{ code, serialNumber, pinCode, expirationDate }]
}
```

#### `listProducts(params)` / `searchProducts(query)` / `getProduct(id)`
Реальные каталожные эндпоинты (`GET /products`, `GET /products/search`, `GET /products/{id}`), используются для `syncSkuCatalog()` (раздел 15) — не опционально.

#### `getWalletBalance()`
`GET /wallets` — текущий баланс кошелька (`MANASTORE_WALLET_ID`). Нужен для дашборда/алерта о низком балансе (раздел 12) — заказ упадёт с 422 "Insufficient funds", если баланс закончится.

#### `logApiCall(logData)`
Пишет лог в `ManaStoreApiLog`, обязательно включая `environment` (раздел 6.1) — определяется один раз при инициализации сервиса из `MANASTORE_ENV`, а не передаётся вызывающим кодом каждый раз (риск ошибиться на вызывающей стороне).

### Общие правила
- использовать `axios`;
- на каждый запрос: timeout, try/catch, логирование;
- скрывать секреты из логов (Bearer-токен никогда не должен попасть в `requestData`/`responseData`);
- нормализовать внешний ответ к внутреннему формату POSA.

---

## 8. Нормализация статусов

> **Правка:** ManaStore не отдаёт единый статус — есть два независимых поля `fulfillment_status` и `payment_status` (раздел 26.4), и явного `failed`/`cancelled` значения среди них нет. "Отказ" в реальности — это ошибка HTTP-запроса создания заказа (401/403/422/500), а не статус, который можно опросить позже. Таблица ниже заменяет исходную.

| fulfillment_status | payment_status | Внутренний статус POSA |
|---|---|---|
| completed | completed | COMPLETED |
| pending / processing / partially_fulfilled | pending / completed | PENDING |
| refunded | любой | REFUNDED (новое значение, отсутствовало в исходном ТЗ — требует бизнес-решения, см. ниже) |
| — (запрос createOrder вернул 401/403/422/500) | — | FAILED |

**Открытый вопрос для бизнеса:** что делать с уже активированным ваучером, если ManaStore позже помечает заказ `refunded` (деньги вернулись, а ключ клиенту уже выдан)? В исходном ТЗ такого статуса не было. Нужно решение: либо это просто информационная пометка в `ManaStoreOrder`, либо требуется процесс аннулирования ключа/уведомления поддержки.

---

## 9. Интеграция в flow активации ваучера

Изменить файл:

```txt
controllers/storeController.js
```

Добавить новый блок:

```js
else if (voucher.product.vendor.productType === 'MANASTORE') {
  ...
}
```

### Алгоритм

> **Правка:** т.к. `createOrder` никогда не возвращает ключ сразу (раздел 26.3/26.5), шаг «получить ключ» — это отдельный обязательный вызов `getOrderContent` сразу после успешного `createOrder`, а не просто проверка поля в ответе. Также добавлен шаг резолва `variantId` из `product.manastoreVariantId` (аналог `voucher.product.rokkySku` у Rokky) — без него заказ создать нельзя.

1. проверить ваучер и принадлежность магазину;
2. проверить статус ваучера;
3. проверить наличие завершённого `ManaStoreOrder`;
4. при необходимости привязать `OnlineVoucher` к клиенту;
5. перевести ваучер в `pending`;
6. взять `variantId = voucher.product.manastoreVariantId`; если пусто — ошибка, заказ не создаётся (см. раздел 22, негативный тест-кейс 1);
7. вызвать `manastoreService.createOrder(variantId)`;
8. сделать `upsert` в `ManaStoreOrder` (`fulfillmentStatus`, `paymentStatus`, нормализованный `status`);
9. если `status === 'COMPLETED'`: сразу вызвать `getOrderContent(manaOrderId)`:
   - если `ready === true` — взять первый код в `key`, сохранить полный список в `codes`, создать `VoucherActivation`, перевести ваучер в `activated`, вернуть ключ клиенту;
   - если `ready === false` — коды ещё формируются несмотря на `fulfillment_status=completed`; оставить ваучер в `pending`, вернуть `success: true, pending: true`;
10. если `status === 'PENDING'` — вернуть `success: true, pending: true` без вызова `getOrderContent` (коды точно не готовы);
11. если ошибка HTTP при создании заказа (401/403/422/500):
   - записать `FAILED` с `errorMessage` (для 422 "Insufficient funds" — отдельно залогировать как алерт по балансу кошелька, раздел 12);
   - вернуть безопасное сообщение клиенту.

---

## 10. Идемпотентность и повторные запросы

> **Правка:** ManaStore не принимает наш `referenceId`/`partnerOrderId` (раздел 26.3), значит сверить на стороне ManaStore "этот заказ уже создавался для этого ваучера" — нельзя в принципе. Вся защита от дублей — исключительно локальная (уникальный `voucherId` в `ManaStoreOrder` + проверка **до** вызова API). Так как `createOrder` списывает деньги с реального кошелька, случайный повторный вызов — это не просто "лишний заказ в логах", а **финансовая потеря**. Поэтому проверка "нет ли уже `ManaStoreOrder` для этого `voucherId`" обязана идти строго до сетевого вызова, в той же транзакции/блокировке, что и перевод ваучера в `pending`.

На один `voucherId` должен существовать максимум один `ManaStoreOrder`.

### Поведение при повторной активации
- если заказ уже `COMPLETED` — повторная активация запрещена;
- если заказ `PENDING` — сначала проверить статус в ManaStore;
- если заказ `FAILED` — повторное создание допускается по бизнес-правилам;
- не создавать бесконтрольные дубли внешних заказов (реальное списание с кошелька, не тестовые данные).

### Рекомендуемое поведение
1. при повторной попытке по `PENDING` сначала вызвать `getOrderStatus()`, затем при необходимости `getOrderContent()` — не вызывать `createOrder()` повторно;
2. если стал `COMPLETED` и `getOrderContent().ready === true` — завершить активацию;
3. если остался `PENDING` — вернуть pending;
4. если `FAILED` (ошибка была на этапе создания заказа, запись в БД так и не получила `manaOrderId`) — можно разрешить controlled retry, это единственный случай, когда повторный `createOrder()` не создаёт дубль оплаченного заказа.

---

## 11. Async-обработка

> **Правка:** это не «если» — ManaStore **всегда** отдаёт ключ вторым вызовом (`get-codes`), никогда в ответе `createOrder` (раздел 26.3/26.5). Вариант A — не временное решение "на первом этапе", а обязательный базовый механизм независимо от webhook.

### Вариант A — polling при повторной проверке (обязателен)
- `createOrder()` никогда не возвращает ключ; сразу после успешного создания вызывается `getOrderContent()`;
- если коды ещё не готовы — `ManaStoreOrder` остаётся `PENDING`;
- при следующем обращении клиента (или админа) повторно вызывается `getOrderStatus()` / `getOrderContent()`.

### Вариант B — cron/webhook (дополнительно, не подтверждён доками)
- ManaStore поддерживает единственное событие `order.fulfilled` (раздел 26.6), настраиваемое вручную в личном кабинете (не через API);
- **доки не описывают подпись/секрет для верификации подлинности webhook** — до уточнения у поддержки ManaStore webhook нельзя использовать как источник истины для выдачи ключа. Безопасный вариант: по приходу webhook только триггерить повторный `getOrderContent()` через авторизованный API-вызов, не доверять телу самого webhook-payload напрямую (раздел 18).

### Рекомендация
Реализовать **Вариант A** как основной путь на первом этапе. Webhook (Вариант B) подключать только после уточнения у ManaStore схемы подписи — иначе публичный HTTPS-эндпоинт без верификации подлинности является дырой в безопасности (любой может дёрнуть его поддельным payload).

---

## 12. Admin-модуль ManaStore

Создать контроллер:

```txt
controllers/admin/manastoreController.js
```

### Методы
- `showManaStoreDashboard`
- `showManaStoreSkus`
- `showAddSkuForm`
- `handleAddSku`
- `showEditSkuForm`
- `handleEditSku`
- `showManaStoreProducts`
- `handleBindSku`
- `showManaStoreActivations`
- `showManaStoreFinance`

### Что должно быть в dashboard
- число товаров ManaStore;
- число SKU;
- число активаций;
- последние 20 API-логов;
- **бейдж текущего контура** (STAGING/PRODUCTION, раздел 6.1) — некликабельный, читается из `MANASTORE_ENV`;
- баланс кошелька (`getWalletBalance()`, раздел 7) активного контура;
- **быстрые ссылки на подстраницы** — по образцу `admin-rokky-dashboard.ejs` ([admin-rokky-dashboard.ejs:92,111,130,149](activation-system/views/pages/admin-rokky-dashboard.ejs#L92)), где дашборд Rokky сам содержит карточки-ссылки на `/admin/rokky/skus`, `/admin/rokky/products`, `/admin/rokky/activations`, `/admin/rokky/finance`. Для ManaStore аналогично: карточки на `/admin/manastore/skus`, `/admin/manastore/products`, `/admin/manastore/activations`, `/admin/manastore/finance`. Без этого пункта верхнее меню будет вести только на dashboard, а остальные страницы окажутся «сиротами» без входа из UI.

### Что должно быть в activations
Фильтры:
- дата от/до;
- товар;
- телефон;
- магазин;
- статус.

Телефон фильтровать по корректному полю `client.phoneNumber`.

> **Найдено при живом тестировании 2026-07-17:** модель `VoucherActivation` не имеет поля `createdAt` — только `activatedAt` (то же самое для `Sale`, у которой дата продажи хранится в поле `date`, а не `createdAt`). Rokky-контроллер (`rokkyController.showRokkyActivations`/`showRokkyFinance`) использует несуществующее `createdAt` в фильтрах и `orderBy` — это скрытая, не проявляющаяся без активных фильтров дат ошибка (`where.createdAt` просто не выставляется, если `startDate`/`endDate` не переданы, поэтому запрос по умолчанию не падает — но падает, как только фильтр по дате реально используется). Реализация ManaStore **не должна** копировать эту ошибку: `showManaStoreActivations` — `where.activatedAt`/`orderBy: { activatedAt: 'desc' }`; `showManaStoreFinance` — `where.date`. Проверено `PrismaClientValidationError` вживую и исправлено.

---

## 13. Admin routes

> **Правка:** маршрут finance у Rokky использует `allowFinance` (пускает и `financial_mgr`), а не только `ensureAdmin` — см. `routes/adminRoutes.js:127` (`router.get('/rokky/finance', allowFinance, rokkyController.showRokkyFinance);`). Для полной симметрии с Rokky у ManaStore должно быть так же.

В `routes/adminRoutes.js` добавить:

```js
router.get('/manastore', ensureAdmin, manastoreController.showManaStoreDashboard);
router.get('/manastore/skus', ensureAdmin, manastoreController.showManaStoreSkus);
router.get('/manastore/skus/add', ensureAdmin, manastoreController.showAddSkuForm);
router.post('/manastore/skus/add', ensureAdmin, manastoreController.handleAddSku);
router.get('/manastore/skus/edit/:id', ensureAdmin, manastoreController.showEditSkuForm);
router.post('/manastore/skus/edit/:id', ensureAdmin, manastoreController.handleEditSku);

router.get('/manastore/products', ensureAdmin, manastoreController.showManaStoreProducts);
router.post('/manastore/products/:id/bind', ensureAdmin, manastoreController.handleBindSku);

router.get('/manastore/activations', ensureAdmin, manastoreController.showManaStoreActivations);
router.get('/manastore/finance', allowFinance, manastoreController.showManaStoreFinance); // финансист тоже должен видеть, как у Rokky
```

### 13.1. Обязательная интеграция в меню админки

> **Требование пользователя:** после изменений раздел ManaStore должен полностью отображаться в меню, так же как Rokky. Ниже — точные правки существующего файла навигации (без создания нового партиала).

Пункт `Rokky API` сейчас находится в выпадающем меню **«Интеграции»** (видимо только роли `admin`), в двух местах одного файла `views/partials/admin-navbar.ejs`:

- десктоп-версия: блок `<!-- Интеграции Dropdown (admin only) -->`, `views/partials/admin-navbar.ejs:142-188`, ссылка `Rokky API` — `views/partials/admin-navbar.ejs:159-167`;
- мобильная версия: блок `<!-- Интеграции Group (Mobile) -->`, `views/partials/admin-navbar.ejs:359-388`, ссылка `Rokky API` — `views/partials/admin-navbar.ejs:377-379`.

**Что добавить:** новую ссылку `ManaStore API` → `/admin/manastore`, **сразу после** ссылки `Dr.Web API` в обоих блоках (десктоп и мобильный), тем же HTML-паттерном (тот же класс, та же иконка-заглушка `<svg>` — можно переиспользовать существующую иконку Rokky/DrWeb или взять нейтральную, главное — не ломать вёрстку `desktop-dropdown-menu`/`mobile-accordion-content`). Никаких новых dropdown-групп не создавать — модуль встраивается в существующую группу «Интеграции» наравне с Rokky и Dr.Web.

**Проверка после реализации:** в меню «Интеграции» (роль `admin`, десктоп и мобильная версии) должны быть видны три пункта — `Rokky API`, `Dr.Web API`, `ManaStore API` — и переход по `ManaStore API` должен открывать `/admin/manastore`.

### 13.2. Обязательная интеграция в существующие формы вендора/товара и клиентскую историю

> **Требование пользователя:** ManaStore должен выбираться как «тип товара» при создании/редактировании вендора — так же, как сейчас работает Rokky — через выпадающий список, и **всё должно реально работать**, а не только формально сохраняться в БД. Ниже — все точки кода, найденные проверкой, куда должен попасть тип `MANASTORE`, чтобы цепочка «вендор → товар → активация → отображение клиенту» была полной, как у Rokky. Без каждого из пунктов ниже получится нерабочая или наполовину рабочая интеграция, даже если модуль ManaStore сам по себе реализован верно.

**(a) Выпадающий список «Тип товаров» при создании вендора**
`views/pages/admin-add-vendor.ejs:71-77` — `<select name="productType">` сейчас содержит `ROKKY`, `DRWEB`, `MANUAL`, `VOUCHER`. Добавить:
```html
<option value="MANASTORE">ManaStore (автоматическая активация)</option>
```

**(b) Тот же список при редактировании вендора**
`views/pages/admin-edit-vendor.ejs:56-65` — тот же набор `<option>`, но с условным `selected` (`<%= vendor.productType==='MANASTORE' ? 'selected' : '' %>`). Без этой правки существующего ManaStore-вендора нельзя будет открыть в форме редактирования, не сбросив тип на пустой.

**(c) Бейдж типа вендора в списке вендоров**
`views/pages/admin-vendors.ejs:170-174` — цепочка `if/else if` вручную мапит `productType` на человекочитаемый лейбл (`ROKKY` → «Rokky (авто)», и т.д.). Добавить ветку `else if (productTypeLabel==='MANASTORE') productTypeLabel='ManaStore (авто)'`. Без этого вендор ManaStore будет отображаться в списке с сырым значением `MANASTORE` вместо аккуратного лейбла — не критично для работы, но заметно нарушает паритет с Rokky.

**(d) Поле SKU в общей форме редактирования товара**
`views/pages/edit-product.ejs:80-96` — для `vendor.productType === 'ROKKY'`/`'DRWEB'` там выводится обычный текстовый `<input>` (не dropdown) с полем `rokkySku`/`drwebSku`. Добавить аналогичный блок для `MANASTORE` с полем `manastoreVariantId` (числовое, `type="number"`, а не текстовое — см. раздел 5.2). Это дублирующий, «безопасный» способ поправить привязку вручную, аналогично Rokky/DrWeb — основной способ подбора остаётся дропдаун на `/admin/manastore/products` (пункт (e) ниже).

> **Не забыть серверную часть формы:** сам HTML-инпут бесполезен без обработки в контроллере. `controllers/admin/productController.js` — `handleAddProduct` (строки 54-68) и `handleEditProduct` (строки 109-150) сейчас деструктурируют `rokkySku, drwebSku` из `req.body` и пишут их как строки. Добавить `manastoreVariantId`, распарсить как `parseInt(manastoreVariantId, 10) || null` (в отличие от `rokkySku`/`drwebSku`, это число, а не строка) и включить в `data` обоих Prisma-вызовов (`create`/`update`). Без этой правки поле в форме будет отображаться, но значение при сохранении молча потеряется.

**(e) Реальный выпадающий список привязки SKU — то, что пользователь называет «выпадающим списком»**
Настоящий `<select>`, из которого выбирают конкретный SKU/вариант, находится не в форме товара, а на отдельной странице `views/pages/admin-rokky-products.ejs:90-108` (маршрут `/admin/rokky/products`): построчная форма `POST /admin/rokky/products/:id/bind` с `<select name="rokkySku">`, где `<option>` генерируются циклом по `skus` (активные `RokkySku`), с пометкой `selected` для текущей привязки. **Именно этот файл — образец 1:1 для `views/pages/admin-manastore-products.ejs`**: `<select name="variantId">`, `<option>` циклом по активным `ManaStoreSku`, значение — `sku.variantId`, текст — `` `${sku.variantId} - ${sku.name}` ``, форма `POST /admin/manastore/products/:id/bind`. Это уже было предусмотрено в разделах 12/14 в общих словах («bind SKU к товару») — здесь зафиксирован точный референс-файл, чтобы не реализовать это как обычный текстовый инпут по ошибке.

**(f) Быстрая ссылка на финансы ManaStore в общем финансовом дашборде**
`views/pages/admin-dashboard-finance.ejs:41-47` — уже содержит ссылку «Финансы Rokky» → `/admin/rokky/finance`. Добавить рядом «Финансы ManaStore» → `/admin/manastore/finance`.

**(g) Отображение ключа в истории клиента — критично, иначе клиент не увидит код повторно**
Ключ ManaStore-заказа физически не появится клиенту при повторном заходе, если не внести правки в трёх местах, которые сейчас знают только про Rokky/DrWeb/Manual:
- `controllers/storeController.js:44-49` (`getStorePage`, серверный рендер `store/activate.ejs`) — в `include` для `voucher` добавить `manastoreOrder: true` рядом с `rokkyOrder`, `drwebOrder`, `manualActivationRequest`;
- `views/store/activate.ejs:1-11` — в цепочке `if (item.voucher.rokkyOrder...) else if (item.voucher.drwebOrder...) else if (item.voucher.manualActivationRequest...)` добавить `else if (item.voucher.manastoreOrder && item.voucher.manastoreOrder.key) key = item.voucher.manastoreOrder.key;`;
- `controllers/storeController.js:609-628` (отдельный JSON-эндпоинт истории активаций) — та же пара правок: добавить `manastoreOrder: true` в `include` (строки 612-614) и аналогичную ветку `else if` в резолве `key` (строки 623-628).

Все три точки дублируют одну и ту же логику независимо друг от друга (исторически не вынесены в общую функцию) — пропуск любой из них означает, что часть UI (либо серверный рендер страницы магазина, либо JSON API истории) будет показывать пустой ключ для ManaStore-активаций, хотя сам заказ и ключ в БД будут корректны.

**(h) ⚠️ Критично: защита от обхода через портал вендора (`/vendor/activate`)**
Обнаружено при сквозной проверке всех ролей (раздел 13.3): `services/voucherActivationService.js:59` — сервис, который обслуживает **ручную активацию из портала вендора** (`routes/vendorRoutes.js`, роль `vendor`/`vendor_user`, отдельный от админки и от клиентского магазина портал), — уже содержит явную защиту:
```js
if (voucher.product?.vendor?.productType === 'ROKKY' || voucher.product?.vendor?.productType === 'DRWEB') {
  throw new ActivationError('Этот ваучер активируется только через клиентский магазин...', 'VENDOR_ONLY', 403);
}
```
Без добавления `|| voucher.product?.vendor?.productType === 'MANASTORE'` в это условие сотрудник вендора ManaStore, авторизованный в портале как `vendor_user`, сможет вызвать `/vendor/activate` и **вручную «активировать» ваучер в обход всей интеграции**: `activateVoucherForVendor()` не вызывает `manastoreService`, не создаёт `ManaStoreOrder`, не списывает кошелёк — а в качестве `activationKey` вернёт **сырое значение самого ваучера** (`voucher.value`, см. `voucherActivationService.js:78`), которое не является настоящим кодом ManaStore. Итог — клиент получит на руки нерабочий код, ваучер будет числиться `activated`, а разбор такого инцидента задним числом будет тяжёлым (в БД всё выглядит «успешно завершённым»). Это самое важное расхождение с Rokky/DrWeb, которое нужно закрыть **до** первого реального теста с участием вендор-пользователя ManaStore.

---

### 13.3. Ролевая матрица — проверено по коду для каждой роли системы

> По запросу пользователя: полная сверка, что ManaStore работает одинаково с Rokky **для каждой роли**, а не только для `admin`. Роли взяты из `middleware/auth.js` (`ensureAdmin`, `allowFinance`, `allowContent`, `allowSupport`, `allowFinanceOrContent`, `ensureVendor`, `ensureMerchant`, `ensureKassa`) и из `admin-navbar.ejs`.

| Роль | Что видит/делает у Rokky сейчас | Что должно быть у ManaStore | Статус после правок раздела 13.1-13.2 |
|---|---|---|---|
| `admin` | Полный доступ: меню «Интеграции» → `/admin/rokky/*`, создание/редактирование вендора и товара | Полный доступ к `/admin/manastore/*`, пункт в меню, дропдаун типа вендора | ✅ Покрыто (13.1, 13.2a-e) |
| `financial_mgr` | Только `/rokky/finance` (`allowFinance`), достижимо исключительно через ссылку «Финансы Rokky» на их landing-дашборде (`admin-dashboard-finance.ejs`) — `/admin/rokky` (сам дашборд) им недоступен (`ensureAdmin`) | Симметрично: только `/manastore/finance` (`allowFinance`), ссылка «Финансы ManaStore» на том же landing-дашборде | ✅ Покрыто (13.2f, раздел 13 роут с `allowFinance`) |
| `content_mgr` | Доступ к `/add-vendor`, `/vendors/edit/:id`, `/add-product`, `/edit-product/:id` (`allowContent`), достижимо через существующий пункт «Контент» → «Вендоры»/«Товары» в навбаре; **не имеет** доступа к `/admin/rokky/*` (`ensureAdmin`) | Может выбрать `MANASTORE` в дропдауне при создании/редактировании вендора и вписать `manastoreVariantId` вручную на `edit-product`; **не имеет** доступа к `/admin/manastore/*` (тот же `ensureAdmin`) — это осознанное ограничение, зеркальное Rokky, а не пробел | ✅ Покрыто (13.2a,b,d); доступ к `/admin/manastore/*` НЕ добавлять — иначе нарушится симметрия с Rokky |
| `support_agent` | **Не имеет** доступа ни к `/admin/rokky/*`, ни к пункту меню «Интеграции» (скрыт для их роли), ни к деталям `rokkyOrder` в `/admin/clients/:id` (контроллер их не выбирает) | Идентично: никакого специального доступа к ManaStore — если бы такой добавили, это стало бы асимметрией с Rokky, а не улучшением | ✅ Подтверждено — сознательно ничего не менять |
| `vendor` / `vendor_user` (портал `/vendor/*`) | Для вендора с `productType=ROKKY`/`DRWEB` явно запрещена ручная активация через `/vendor/activate` (`voucherActivationService.js:59`); дашборд/ваучеры/транзакции/настройки — универсальные, без привязки к productType | Тот же запрет обязателен для `MANASTORE` (иначе обход интеграции, см. пункт (h) выше); остальные страницы портала уже универсальны и не требуют правок | ⚠️ Требует правки — раздел 13.2h (новое) |
| `merchant` (портал мерчанта) | Не завязан на конкретный `productType` вендора — работает с продажами/комиссиями безотносительно Rokky/DrWeb | Аналогично, изменений не требует | ✅ Подтверждено, изменений не требуется |
| `kassa_admin` / `kassa_viewer` | Отдельный кабинет кассы (`/kassa/*`), не завязан на `productType` вендора | Аналогично, изменений не требует | ✅ Подтверждено, изменений не требуется |
| Клиент (сессия `clientId`, без роли `User`) | Активирует ваучер через `/store/:slug`, видит ключ сразу и в истории (`store/activate.ejs`, JSON-эндпоинт истории) | Идентично для ManaStore — раздел 9 (flow) и 13.2g (история) | ✅ Покрыто (раздел 9, 13.2g) |

---

## 14. Views

> Полный набор страниц 1:1 соответствует Rokky (7 файлов у Rokky в `views/pages/admin-rokky-*.ejs` — dashboard, skus, add-sku, edit-sku, products, activations, finance). Ни одна из них не должна быть пропущена — иначе ссылки из раздела 12 (карточки на дашборде) и раздела 13 (роуты) будут вести на несуществующие страницы.

Создать шаблоны:

```txt
views/pages/admin-manastore-dashboard.ejs
views/pages/admin-manastore-skus.ejs
views/pages/admin-manastore-add-sku.ejs
views/pages/admin-manastore-edit-sku.ejs
views/pages/admin-manastore-products.ejs
views/pages/admin-manastore-activations.ejs
views/pages/admin-manastore-finance.ejs
```

### UI-требования
- стиль как у существующей админки;
- в dashboard выводить API-логи, бейдж контура (STAGING/PRODUCTION) и карточки-ссылки на остальные 6 страниц (раздел 12);
- в products — bind SKU (`manastoreVariantId`) к товару;
- в activations — маскировать ключ;
- в SKUs — отображать variantId, sku (алиас), name, category, costPrice, retailPrice, isActive;
- в finance — баланс кошелька активного контура (раздел 16).

### Проверка полноты после реализации
Пройти по каждому пункту меню «Интеграции» → «ManaStore API» и по каждой карточке на дашборде ManaStore и убедиться, что: (а) страница открывается без 404/500, (б) выглядит согласованно со страницами Rokky того же назначения, (в) бейдж контура на dashboard соответствует реальному значению `MANASTORE_ENV` в `.env`.

---

## 15. Каталог SKU

> **Правка:** каталог **реально доступен и хорошо задокументирован** (`GET /products`, `GET /products/search`, `GET /products/{id}`, раздел 26.3) — это не гипотетическая опция, а рекомендованный основной способ заводить `ManaStoreSku`, вместо ручного ввода вслепую.

### Базовый вариант
Ручной ввод остаётся доступен (на случай отсутствующих в каталоге позиций), но не должен быть единственным способом.

### Импорт каталога (реализовать, не опционально)
Добавить метод `syncSkuCatalog()`, использующий `listProducts()`/`searchProducts()`, и кнопку импорта в админке.

### Правила синка
- обновлять по `variantId` (`variant.id` из ответа `/products`), а не по `sku` — своего SKU-кода ManaStore не выдаёт;
- цену синхронизировать из `variant.price` / `variant.face_value` в `retailPrice`/`faceValue`, `costPrice` ManaStore не отдаёт — остаётся ручным полем;
- сохранять raw-данные товара в `meta`;
- не удалять локальные SKU автоматически без отдельного флага.

---

## 16. Финансовая логика

В `showManaStoreFinance` использовать:

- `sale.price` как выручку;
- `ManaStoreSku.costPrice` как себестоимость;
- `totalMargin = totalRevenue - totalCost`.

Если `costPrice` отсутствует — считать как `0` или помечать отдельно.

> **Важно:** ManaStore не отдаёт себестоимость через API ни в каком поле (`variant.price`/`face_value` — это отпускная цена ManaStore, не наша закупочная себестоимость с учётом возможной скидки/тарифа партнёра). `costPrice` в `ManaStoreSku` **всегда** заполняется вручную администратором — сверить с ManaStore, по какой цене реально списывается баланс кошелька за конкретный вариант, и вносить это значение при заведении SKU.

Не использовать приблизительные коэффициенты вроде `price * 0.7`.

Дополнительно в дашборд/финансы вывести текущий баланс кошелька (`getWalletBalance()`, раздел 7) — при обнулении баланса заказы начнут падать с 422.

---

## 17. Обработка ошибок

### Для клиента
Возвращать безопасочное сообщение:

```txt
Произошла ошибка. Пожалуйста обратитесь в службу поддержки.
```

### Для админа
В логах должны быть:
- метод;
- endpoint;
- request body;
- response body;
- status code;
- duration;
- ошибка.

### Retry policy
- 1 автоматический retry при timeout/5xx;
- не делать retry при бизнес-ошибках 4xx.

---

## 18. Безопасность

- хранить ключи только в env;
- не логировать токены/секреты (Bearer-токен ManaStore, `MANASTORE_WEBHOOK_SECRET`);
- admin routes должны быть под `ensureAdmin`;
- не показывать полный ключ в списках;
- исключить двойную активацию — здесь это ещё и защита от повторного списания с реального кошелька (раздел 10), а не только от повторной выдачи кода;
- не отдавать пользователю сырой ответ ManaStore;
- **webhook `order.fulfilled` не имеет задокументированной подписи** (раздел 26.6) — до уточнения у ManaStore нельзя использовать его payload как основание для выдачи ключа; использовать только как триггер для повторного авторизованного запроса статуса.

---

## 19. Технические изменения по файлам

### Новые файлы
- `controllers/admin/manastoreController.js`
- `services/manastoreService.js`
- `views/pages/admin-manastore-dashboard.ejs`
- `views/pages/admin-manastore-skus.ejs`
- `views/pages/admin-manastore-add-sku.ejs`
- `views/pages/admin-manastore-edit-sku.ejs`
- `views/pages/admin-manastore-products.ejs`
- `views/pages/admin-manastore-activations.ejs`
- `views/pages/admin-manastore-finance.ejs`

### Изменяемые файлы
- `routes/adminRoutes.js`
- `controllers/storeController.js` — ветка активации (раздел 9) **и** оба `include`/резолва ключа для истории клиента (раздел 13.2, пункт g: строки 44-49 и 609-628)
- `prisma/schema.prisma`
- `views/partials/admin-navbar.ejs` — ссылка `ManaStore API` в группе «Интеграции», десктоп и мобильная версии (раздел 13.1)
- `views/pages/admin-add-vendor.ejs` — опция `MANASTORE` в дропдауне «Тип товаров» (раздел 13.2a)
- `views/pages/admin-edit-vendor.ejs` — та же опция с `selected` (раздел 13.2b)
- `views/pages/admin-vendors.ejs` — лейбл `MANASTORE` в бейдже типа вендора (раздел 13.2c)
- `views/pages/edit-product.ejs` — поле `manastoreVariantId` по образцу `rokkySku`/`drwebSku` (раздел 13.2d)
- `controllers/admin/productController.js` — сохранение `manastoreVariantId` в `handleAddProduct`/`handleEditProduct` (раздел 13.2d)
- `views/pages/admin-dashboard-finance.ejs` — ссылка «Финансы ManaStore» (раздел 13.2f)
- `views/store/activate.ejs` — ветка `manastoreOrder` в резолве ключа истории (раздел 13.2g)
- `services/voucherActivationService.js` — **обязательно**: добавить `MANASTORE` в защиту от ручной активации через портал вендора, строка 59 (раздел 13.2h) — иначе обход всей интеграции через `/vendor/activate`

---

## 20. Миграция БД

Создать Prisma migration, включающую:
- добавление `MANASTORE` в enum `VendorProductType`;
- добавление `Product.manastoreVariantId`;
- создание таблиц `ManaStoreOrder`, `ManaStoreApiLog`, `ManaStoreSku` (с полем `environment` в первых двух, раздел 6.1);
- связь `Voucher.manastoreOrder`.

---

## 21. Acceptance Criteria

Задача считается выполненной, если:

1. **`MANASTORE` виден и выбираем как опция в дропдауне «Тип товаров»** при создании (`admin-add-vendor.ejs`) и редактировании (`admin-edit-vendor.ejs`) вендора — так же, как `Rokky`/`Dr.Web` (раздел 13.2a-b);
2. вендор с `productType = MANASTORE` сохраняется и отображается в списке вендоров с корректным лейблом, а не сырым значением enum (раздел 13.2c);
3. можно создать товар под таким вендором и привязать `manastoreVariantId` — как через дропдаун на `/admin/manastore/products` (основной способ, раздел 13.2e), так и вручную полем на `edit-product` (раздел 13.2d);
4. открывается `/admin/manastore` и все 6 связанных подстраниц (skus, add-sku, edit-sku, products, activations, finance) — без 404/500;
5. пункт **`ManaStore API`** виден и кликабелен в меню «Интеграции» рядом с `Rokky API`/`Dr.Web API`, в десктоп и мобильной версии навигации (раздел 13.1);
6. на дашборде ManaStore есть карточки-ссылки на все подстраницы и бейдж текущего контура (STAGING/PRODUCTION), совпадающий с `MANASTORE_ENV`;
7. смена `MANASTORE_ENV` в `.env` (с рестартом процесса) реально меняет: используемый base URL, используемые `MANASTORE_API_KEY_*`/`MANASTORE_WALLET_ID_*`, значение `environment` в новых записях `ManaStoreOrder`/`ManaStoreApiLog`, и бейдж на дашборде — без правок кода;
8. при активации ваучера ManaStore вызывается внешний API того контура, который указан в `MANASTORE_ENV`;
9. создаётся `ManaStoreOrder` с корректным `environment`;
10. при успешном ответе (и готовых кодах через `getOrderContent`) создаётся `VoucherActivation`;
11. ваучер переводится в `activated`, и клиент **видит ключ и при первой активации, и при повторном заходе на страницу истории магазина, и в JSON-эндпоинте истории** — все три места из раздела 13.2g учитывают `manastoreOrder`;
12. при pending-заказе flow корректно возвращает pending;
13. ошибки пишутся в `ManaStoreApiLog` с корректным `environment`;
14. повторная активация уже завершённого заказа невозможна и не создаёт второй внешний заказ (раздел 10);
15. ссылка «Финансы ManaStore» видна на общем финансовом дашборде рядом с «Финансы Rokky» (раздел 13.2f);
16. **вендор-пользователь ManaStore не может активировать ваучер вручную через `/vendor/activate`** — попытка возвращает ту же ошибку `VENDOR_ONLY`, что и для Rokky/DrWeb (раздел 13.2h);
17. проверена ролевая матрица раздела 13.3: `financial_mgr` видит только finance-страницу, `content_mgr` — только формы вендора/товара (без `/admin/manastore/*`), `support_agent` не получает никакого нового доступа, `merchant`/`kassa_*` не затронуты.

---

## 22. Тест-кейсы

> **Правка:** тест-кейс 1 скорректирован — `createOrder` никогда не возвращает ключ синхронно (раздел 26.3/26.5), поэтому «мгновенная» активация на практике означает createOrder→сразу успешный getOrderContent в рамках одного запроса. Добавлены кейсы по меню/переключению, дропдауну вендора, клиентской истории и — по итогам ролевой сверки (раздел 13.3) — по каждой роли системы и по обходу через портал вендора.

### Позитивные
1. `createOrder` завершается, `getOrderContent` сразу отдаёт готовые коды → ваучер активирован в рамках одного запроса клиента.
2. API возвращает `PENDING` (или коды ещё не готовы) → клиент получает pending-статус.
3. При повторной проверке pending становится completed → активация завершается.
4. `manastoreVariantId` успешно привязывается к товару через дропдаун на `/admin/manastore/products` (раздел 13.2e).
5. Успешный API-вызов виден в dashboard, с корректным `environment`.
6. Пункт «ManaStore API» отображается и открывается в меню «Интеграции» (десктоп и мобильная версия), все 6 подстраниц доступны с dashboard (раздел 13.1, 14).
7. Смена `MANASTORE_ENV` со `staging` на `production` (с рестартом) переключает base URL/credentials/бейдж и не позволяет запуститься без заполненных credentials выбранного контура (раздел 6.1).
8. В форме создания и в форме редактирования вендора опция `MANASTORE` присутствует в дропдауне «Тип товаров», сохраняется корректно (в т.ч. `handleAddProduct`/`handleEditProduct` реально сохраняют `manastoreVariantId`, раздел 13.2d), и в списке вендоров отображается с человекочитаемым лейблом (раздел 13.2a-c).
9. После успешной активации через ManaStore клиент видит ключ: (а) сразу в ответе на активацию, (б) при повторном заходе на `/store/:slug` (серверный рендер истории), (в) через JSON-эндпоинт истории активаций — все три пути (раздел 13.2g).
10. Под ролью `financial_mgr`: вход на landing-дашборд → клик «Финансы ManaStore» → открывается `/admin/manastore/finance` без 403 (раздел 13.2f, 13.3).
11. Под ролью `content_mgr`: через «Контент» → «Вендоры» создаётся вендор `MANASTORE`, через «Товары» товар привязывается к `manastoreVariantId`; прямой переход на `/admin/manastore` даёт 403 (ожидаемо, как и с `/admin/rokky`) — это правильное поведение, а не баг (раздел 13.3).

### Негативные
1. У товара нет `manastoreVariantId` → заказ не создаётся.
2. ManaStore возвращает 4xx → заказ получает `FAILED`.
3. ManaStore возвращает 5xx → выполняется 1 retry, затем `FAILED`.
4. Для уже `COMPLETED` заказа повторная активация запрещена и не создаёт второй внешний заказ (реальное повторное списание с кошелька).
5. Неверный store / чужой ваучер → generic error.
6. `MANASTORE_ENV=production` указан, но `MANASTORE_API_KEY_PRODUCTION`/`MANASTORE_WALLET_ID_PRODUCTION` пусты → процесс не должен стартовать с "молчаливыми" пустыми значениями (раздел 6.1, пункт 2).
7. Забыта правка `storeController.js:44-49` или `:609-628` (раздел 13.2g) → ключ ManaStore-заказа существует в БД, но не показывается клиенту в истории — это регрессионный сценарий, который нужно явно прогнать, а не только проверить happy path из кейса 9.
8. **Вендор-пользователь ManaStore пытается активировать ваучер через `/vendor/activate`** → должен получить ту же ошибку `VENDOR_ONLY` (403), что и Rokky/DrWeb, без создания `VoucherActivation` и без утечки сырого `voucher.value` в качестве «ключа» (раздел 13.2h) — это самый важный негативный тест-кейс из всего раунда проверки ролей.
9. Роль `support_agent` пытается открыть `/admin/manastore` напрямую по URL → должен получить 403, как и на `/admin/rokky` (раздел 13.3) — регрессия здесь означала бы случайно расширенный доступ, а не исправление.

---

## 23. Этапы реализации

### Этап 1
- обновить schema;
- добавить migration;
- добавить vendor type и поля.

### Этап 2
- реализовать `manastoreService.js`;
- подключить env, включая раздельные `*_STAGING`/`*_PRODUCTION` credentials и `MANASTORE_ENV` (раздел 6.1);
- сделать логирование API с полем `environment`.

### Этап 3
- встроить `MANASTORE` в `storeController` (ветка активации, раздел 9);
- реализовать idempotency и pending-flow;
- добавить `manastoreOrder: true` в оба `include` истории клиента и ветку резолва ключа (`storeController.js:44-49`, `:609-628`, `store/activate.ejs:1-11`) — раздел 13.2g;
- **добавить `MANASTORE` в защиту `services/voucherActivationService.js:59`** — раздел 13.2h. Сделать это в один PR с веткой активации в `storeController`, чтобы обе стороны интеграции (клиентский магазин и портал вендора) обновлялись синхронно.

### Этап 4
- сделать admin controller;
- сделать routes (включая `allowFinance` на `/manastore/finance`, раздел 13);
- сверстать views, включая бейдж контура и карточки-ссылки на дашборде (раздел 12, 14);
- **добавить пункт `ManaStore API` в `views/partials/admin-navbar.ejs`** (десктоп + мобильная версия, раздел 13.1) — без этого шага модуль технически работает, но не виден в UI;
- **добавить опцию `MANASTORE` в дропдаун «Тип товаров»** в `admin-add-vendor.ejs` и `admin-edit-vendor.ejs`, лейбл в `admin-vendors.ejs`, поле SKU в `edit-product.ejs` + сохранение в `productController.js`, ссылку в `admin-dashboard-finance.ejs` (раздел 13.2a-d,f).

### Этап 5
- выполнить smoke test на staging (раздел 27.3);
- проверить сценарии ошибок;
- проверить повторные активации (без повторного списания с кошелька);
- проверить переключение `MANASTORE_ENV` staging→production и обратно (раздел 6.1) на стороне, где это безопасно тестировать;
- проверить видимость и переходы по пункту меню и всем подстраницам (раздел 21, пп. 4–5);
- **создать тестового вендора через форму** (не напрямую в БД) с `productType = MANASTORE`, привязать товар через дропдаун `/admin/manastore/products`, активировать ваучер и убедиться, что ключ виден клиенту и при первой активации, и при повторном заходе в историю (раздел 13.2, раздел 21 пп.1-3,11);
- **прогнать ролевую матрицу раздела 13.3 по всем ролям**: `financial_mgr` (только finance-ссылка), `content_mgr` (формы вендора/товара, но 403 на `/admin/manastore`), `support_agent` (403 на `/admin/manastore`, как и на `/admin/rokky`), `vendor_user` ManaStore-вендора (403 на `/vendor/activate`, раздел 13.2h), `merchant`/`kassa_*` (без изменений в поведении).

---

## 24. Чек-лист по docs.manastore.com перед кодом

> **Статус:** сверено 2026-07-17 с `docs.manastore.com`. Большинство пунктов закрыты — см. раздел 26. Остались пункты, не описанные в докáх — их нужно уточнять напрямую у поддержки ManaStore, а не додумывать.

| № | Вопрос | Статус |
|---|---|---|
| 1 | Тип авторизации | ✅ Bearer token, `Authorization: Bearer <token>` + `Accept: application/json` |
| 2 | Endpoint создания заказа | ✅ `POST /api/v1/orders` |
| 3 | Название внешнего order id | ✅ `ulid` (используется в путях), плюс `id`, `order_number` |
| 4 | Возвращается ли ключ сразу | ✅ Нет, никогда — нужен отдельный `get-codes` |
| 5 | Endpoint статуса | ✅ `GET /orders/{order}` (fulfillment_status/payment_status) |
| 6 | Endpoint получения ключа/контента | ✅ `GET /orders/{order}/get-codes` |
| 7 | Нужен ли `price` в запросе | ✅ Нет — цена не передаётся, определяется на стороне ManaStore |
| 8 | Нужен ли `referenceId`/`partnerOrderId` | ✅ Нет — API его не принимает вообще |
| 9 | Реальные статусы ManaStore | ✅ Два поля: fulfillment_status (pending/processing/partially_fulfilled/completed/refunded), payment_status (pending/completed); явного failed нет |
| 10 | Rate limit | ❌ **Не задокументирован — уточнить у поддержки** |
| 11 | Sandbox | ⚠️ Отдельного sandbox нет, но есть staging: `api-staging.manastore.com` |
| 12 | Webhook | ⚠️ Есть, но только `order.fulfilled`, без описанной подписи/секрета — **уточнить схему верификации у поддержки** |
| 13 | Endpoint каталога товаров/SKU | ✅ `GET /products`, `GET /products/search`, `GET /products/{id}` |
| 14 (новое) | Как пополняется `wallet_id` | ❌ **Не описано в API — уточнить процесс пополнения у поддержки/менеджера ManaStore** |
| 15 (новое) | Поведение при `refunded` после выдачи ключа клиенту | ❌ **Бизнес-решение не принято, у ManaStore не спрашивали** |

---

## 25. Рекомендация по реализации

Не строить отдельную новую архитектуру. Реализовать ManaStore **как полноценный третий провайдер по образцу Rokky/DrWeb**:

- `manastoreService.js`
- `manastoreController.js`
- `ManaStoreOrder`
- `ManaStoreApiLog`
- `ManaStoreSku`
- ветка `MANASTORE` в `storeController`
- admin pages `/admin/manastore/*`

Это минимизирует риск и позволит быстрее встроить обновление в POSA.

---

## 26. Фактическая спецификация API ManaStore (сверено 2026-07-17, docs.manastore.com)

### 26.1. Базовые URL и версионирование
- Production: `https://api.manastore.com/api/v1`
- Staging: `https://api-staging.manastore.com/api/v1`
- Версия зашита в путь (`v1`), отдельного заголовка версии нет.

### 26.2. Авторизация
- `Authorization: Bearer <token>` на каждый запрос;
- `Accept: application/json` обязателен;
- токен генерируется в личном кабинете: Account Settings → API Key → Generate API Key;
- ни partner code, ни username/password, ни HMAC-подписи запросов — нет.

### 26.3. Orders

**`POST /orders`** — создать заказ
```json
{
  "wallet_id": "123e4567-e89b-12d3-a456-426614174002",
  "items": [{ "product_variant_id": 123, "quantity": 1 }]
}
```
Ответ `201`: `id`, `ulid`, `order_number`, `fulfillment_status`, `payment_status`, `subtotal`/`total` (amount+formatted), `currency`, `items[]`. Ключей нет.
Ошибки: `401` (нет/неверный токен), `403` (доступ запрещён), `422` (например «Insufficient funds in wallet»), `500`.

**`GET /orders/{order}`** (`order` = ulid) — статус заказа. Тот же набор полей, что и при создании.

**`GET /orders/{order}/get-codes`** — коды:
```json
{
  "error": false,
  "message": "...",
  "data": [{
    "product_name": "...",
    "status": "completed | pending",
    "codes": [{ "code": "XXXX-XXXX-XXXX-XXXX", "serial_number": "...", "pin_code": "...", "expiration_date": "..." }]
  }]
}
```

**`GET /orders/{order}/download-codes`** и **`GET /orders/{order}/download-invoice`** — ZIP с кодами и PDF-счёт соответственно; в scope текущего ТЗ не требуются, но полезны для раздела истории активаций/поддержки в будущем.

**`GET /orders`** — постраничный список заказов текущего аккаунта (для сверки/аудита, не для flow активации).

### 26.4. Статусы
- `fulfillment_status`: `pending`, `processing`, `partially_fulfilled`, `completed`, `refunded`;
- `payment_status`: `pending`, `completed`;
- явного `failed`/`cancelled` значения нет — отказ до создания заказа проявляется как HTTP-ошибка, а не как статус для последующего опроса.

### 26.5. Products (каталог)
- `GET /products` — пагинация (`page`, `per_page`, default 15), фильтры `search`, `category`; объект товара включает `id`, `brand_id`, `name`, `category_name`, `variant` (`id`, `name`, `price`, `face_value`), `images`, `isPermanentOutOfStock`;
- `GET /products/search` — поиск по строке с пагинацией;
- `GET /products/{id}` — детали одного товара.

### 26.6. Wallets
- `GET /wallets` — список кошельков аккаунта: `id`, `name`, `balance` (amount/currency/formatted), `currency`, `credit_limit`;
- пополнение кошелька через API **не описано** — предположительно ручной процесс (см. раздел 24, пункт 14).

### 26.7. Webhooks
- Настройка: Account Settings → Webhook, публичный HTTPS-эндпоинт, доставка начинается сразу после сохранения (без подтверждающего запроса);
- единственное событие: `order.fulfilled`, payload `{ event, timestamp, data: { fulfillment_status: "completed", payment_status: "completed", ... } }`;
- таймаут ответа получателя — 10 секунд, до 3 повторов с экспоненциальной задержкой при не-2xx;
- **схема подписи/секрета не описана в доках** — трактовать webhook только как триггер для повторного авторизованного запроса, не как источник данных для выдачи ключа (см. разделы 11, 18).

### 26.8. Расхождения, найденные только в живом тестировании (2026-07-17, staging, реальный API-ключ)

> Раздел 26.1–26.7 — как описано в docs.manastore.com. Но реальные ответы API оказались строже/иначе структурированы, чем краткое описание в доках («single resources return objects directly» — неверно как минимум для двух эндпоинтов ниже). Все пункты ниже уже исправлены в `services/manastoreService.js` и `controllers/admin/manastoreController.js`, зафиксированы здесь, чтобы при доработках/рефакторинге их не откатили обратно по «памяти доков».

1. **`POST /orders` и `GET /orders/{order}` оборачивают объект заказа в `{ data: {...} }`** (у первого ещё и `{ message, data: {...} }`), а не отдают `id`/`ulid`/`fulfillment_status` на верхнем уровне ответа, как написано в разделе 26.3. Подтверждено реальным вызовом:
   ```json
   {"message":"Order created successfully","data":{"id":1193,"ulid":"01kxr3s6j9ndddvtfyqt8c5sm6","order_number":"#2041","fulfillment_status":"processing","payment_status":"completed", ...}}
   ```
   Оба метода сервиса должны читать `response.data.ulid`/`response.data.fulfillment_status` и т.д., а не `response.ulid`.
2. **`GET /products/{id}` (единичный товар) тоже завёрнут в `{ data: {...} }`** — та же поправка в `getProduct()`. `GET /products` (список) — не затронут, там `data` уже было массивом по документации и это подтвердилось.
3. **`variant.price` и `variant.face_value` — не числа, а объекты** `{ amount, currency, formatted, decimal, localized_decimal }`; `decimal` — строка (`"8.90"`), а не число. Наивное присваивание в Prisma `Float`-поле (`retailPrice`/`faceValue`) даёт `PrismaClientValidationError: Expected Float or Null, provided String` (для строки) либо падает ещё раньше при попытке записать целый объект. Нужен парсинг: `parseFloat(variant.price?.decimal)`.
4. **Реальный тестовый заказ не завершается мгновенно**: `fulfillment_status` остаётся `processing` не менее нескольких минут даже на staging (в отличие от того, что можно было бы предположить по доке). Это лишний раз подтверждает: вариант "ключ сразу" из старого черновика ТЗ (раздел 22, тест-кейс 1) — не типичный путь, а исключение; расчёт на обязательный повторный опрос (раздел 11) был верным архитектурным решением.
5. **Кошелёк (`GET /wallets`) содержит поле `credit_limit`**, не упомянутое в кратком описании раздела 26.6 — баланс может быть `0`, а заказ всё равно пройдёт за счёт кредитного лимита. Это меняет трактовку "низкого баланса": алерт на дашборде (раздел 12) должен учитывать `balance + credit_limit`, а не только `balance`, иначе будет ложная тревога о нехватке средств.
6. **Домен `staging.manastore.com` (без `api-`) — это личный кабинет, не API-хост**; реальный API staging живёт на `api-staging.manastore.com` (подтверждено: первый отдаёт 404 на `/api/v1/wallets`, второй — 200). При получении новых доменов от ManaStore в будущем — всегда проверять curl'ом, а не полагаться на визуальное сходство названия.

**Не найдено на практике (пока), но стоит перепроверить при дальнейшей работе:** аналогичного «объектного» формата цены могут встретиться и в других полях каталога (`discount_percentage` пришёл как обычное число — не проверялось так подробно, как price/face_value).

---

## 27. Что нужно, чтобы способ был доступен в POSA и его можно было протестировать

### 27.1. Организационные шаги (не код, блокируют тестирование)
1. Завести аккаунт ManaStore (или получить доступ к уже существующему) и сгенерировать Bearer API-ключ отдельно для staging и prod (Account Settings → API Key).
2. Создать/получить `wallet_id` (`GET /wallets` после регистрации) и уточнить у ManaStore, как его пополнить — в API это не описано (раздел 24, п.14). Для теста достаточно небольшой суммы.
3. Согласовать с ManaStore хотя бы 1 реальный `product_variant_id` для smoke-теста (желательно самый дешёвый товар в каталоге).
4. Запросить у поддержки ManaStore: схему подписи webhook (п.12), процесс пополнения кошелька (п.14), поведение `refunded` после выдачи кода (п.15), наличие rate limit (п.10). Без ответа на первые два пункт откладываем реализацию webhook (раздел 11, вариант B) и не рискуем деньгами сверх тестовой суммы.

### 27.2. Технические шаги (код, по обновлённому ТЗ)
1. Обновить `prisma/schema.prisma` по разделу 5 (с правками, включая `environment` в `ManaStoreOrder`/`ManaStoreApiLog`) и `VendorProductType`; сгенерировать и прогнать миграцию (раздел 20).
2. Заполнить `.env` по разделу 6: `MANASTORE_ENV=staging`, `MANASTORE_API_URL_STAGING`, `MANASTORE_API_KEY_STAGING`, `MANASTORE_WALLET_ID_STAGING` — для начала работать только с staging-блоком; `*_PRODUCTION`-переменные можно оставить пустыми до этапа реального запуска (сервис должен падать при старте, только если выбранный через `MANASTORE_ENV` контур не сконфигурирован, раздел 6.1).
3. Реализовать `services/manastoreService.js` (раздел 7): `createOrder`, `getOrderStatus`, `getOrderContent`, `listProducts`/`searchProducts`/`getProduct`, `getWalletBalance`, `logApiCall`, резолвинг контура из `MANASTORE_ENV` при инициализации.
4. Встроить ветку `MANASTORE` в `controllers/storeController.js` (раздел 9) с обязательным вторым вызовом `getOrderContent` и локальной идемпотентностью (раздел 10).
5. Реализовать `controllers/admin/manastoreController.js`, роуты (раздел 13, включая `allowFinance` на finance) и views (раздел 14), включая бейдж контура, баланс кошелька и синк каталога (`syncSkuCatalog`, раздел 15).
6. **Добавить пункт `ManaStore API` в `views/partials/admin-navbar.ejs`** — десктоп-дропдаун «Интеграции» и мобильный аккордеон «Интеграции» (раздел 13.1). Без этого шага модуль недоступен из UI даже при полностью рабочем бэкенде.
7. **Добавить `MANASTORE` в защиту `voucherActivationService.js:59`** (раздел 13.2h) — до создания тестового вендора в п.8, иначе тестовый вендор-пользователь сможет случайно обойти интеграцию ещё на этапе тестирования.
8. Завести тестового `Vendor` с `productType = MANASTORE`, тестовый `Product`, привязать `manastoreVariantId` (взять реальный вариант из каталога через синк), создать тестовый `Voucher` в статусе `sold`. Для полноты ролевого теста дополнительно завести: тестового пользователя с ролью `content_mgr` (создать вендора/товар через форму, не в БД напрямую), `financial_mgr` (проверить finance-ссылку) и `vendor_user`, привязанного к тестовому ManaStore-вендору (проверить блокировку `/vendor/activate`).

### 27.3. Порядок тестирования (smoke, только на staging — `MANASTORE_ENV=staging`)
1. **Проверить видимость в UI**: под ролью `admin` пункт `ManaStore API` виден в меню «Интеграции» (десктоп и мобильная версия), ведёт на `/admin/manastore`; с дашборда открываются все 6 подстраниц; бейдж на дашборде показывает `STAGING`.
2. Активировать тестовый ваучер через обычный store-flow → проверить создание `ManaStoreOrder` с `environment=staging`, реальное списание с тестового баланса кошелька, получение кода через `getOrderContent` (сразу или при повторном заходе, если `pending`).
3. Проверить сценарий нехватки средств: искусственно обнулить/использовать баланс → убедиться, что приходит `422`, заказ помечается `FAILED`, клиенту — безопасное сообщение, в `ManaStoreApiLog` — полная трассировка с `environment=staging`.
4. Проверить, что повторная активация того же ваучера **не создаёт второй `ManaStoreOrder`** и не списывает деньги дважды (раздел 10) — это самый важный тест именно для ManaStore, в отличие от Rokky/DrWeb, где повтор не стоил реальных денег.
5. Проверить отображение в админке: dashboard (счётчики + API-логи + бейдж + баланс), skus (синк из каталога), products (bind), activations (фильтры, маскированный ключ), finance (маржа по ручному `costPrice`, баланс кошелька, доступ у `financial_mgr`).
6. **Проверить переключение контура**: заполнить `*_PRODUCTION`-переменные, поменять `MANASTORE_ENV=production`, перезапустить процесс → бейдж на дашборде должен показать `PRODUCTION`, новый `ManaStoreOrder`/`ManaStoreApiLog` — писаться с `environment=production`, использоваться должны prod-ключ и prod-`wallet_id`. Затем откатить обратно на `staging` и убедиться, что переключение симметрично.
7. **Прогнать ролевую матрицу (раздел 13.3) по очереди**:
   - `content_mgr` — создать вендора `MANASTORE` через `/admin/add-vendor`, товар через `/admin/add-product`, вписать `manastoreVariantId` вручную на `edit-product`; убедиться, что прямой переход на `/admin/manastore` даёт 403;
   - `financial_mgr` — залогиниться, убедиться, что попадаешь на finance-дашборд, кликнуть «Финансы ManaStore», убедиться, что открывается `/admin/manastore/finance` без 403, а `/admin/manastore` (без `/finance`) — с 403;
   - `support_agent` — убедиться, что в меню нет «Интеграции» вообще, прямой переход на `/admin/manastore` — 403 (как и на `/admin/rokky`);
   - `vendor_user` тестового ManaStore-вендора — залогиниться в `/vendor`, попытаться активировать тестовый ваучер через `/vendor/activate` → должен получить `VENDOR_ONLY` (403), ваучер должен остаться в исходном статусе, `VoucherActivation` не создаётся.
8. Только после чистого прогона всех пунктов на staging — оставить `MANASTORE_ENV=production` в реальном окружении и повторить пункт 2 с минимальной суммой перед вводом в эксплуатацию.
