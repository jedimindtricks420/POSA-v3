# ERD.md — Entity–Relationship Specification
> Проект: **activation-system**  
> Версия: **1.0** (синхронизировано со schema.prisma на 2025-09-16, TZ: Asia/Tashkent)  
> Источник: `/home/admin1/posa/activation-system/prisma/schema.prisma`

Документ описывает сущности, ключи, связи и ограничения модели данных. Ниже есть обзорная ER-диаграмма (Mermaid), детальная спецификация таблиц, список связей с кардинальностями, перечисления (enum), а также примечания к консистентности схемы и рекомендации.

---

## 1) Обзорная ER-диаграмма

> Обозначения Mermaid ER:  
> `||` — ровно один; `o|` — ноль или один; `|{` — один или много; `o{` — ноль или много.

```mermaid
erDiagram
  USER ||--o{ VOUCHERACTIVATION : "activatedBy (optional)"
  USER }o--|| VENDOR : "belongs to (vendor_user only)"

  VENDOR ||--o{ PRODUCT : "has"
  PRODUCT ||--o{ VOUCHER : "issues"

  MERCHANT ||--o{ VOUCHERTRANSACTION : "has"
  VENDOR   ||--o{ VOUCHERTRANSACTION : "has"
  PRODUCT  }o--o{ VOUCHERTRANSACTION : "denorm productId (no FK)"

  MERCHANT ||--o{ MERCHANTPAYMENT : "payments"
  VENDOR   ||--o{ VENDORPAYMENT   : "payouts"

  VOUCHER  ||--o{ VOUCHERACTIVATION : "activated records"
  VENDOR   ||--o{ VOUCHERACTIVATION : "activation context"
  CLIENT   ||--o{ VOUCHERACTIVATION : "activated by (optional)"

  VOUCHER  ||--o| ONLINEVOUCHER     : "assigned to (0..1)"
  CLIENT   ||--o{ ONLINEVOUCHER     : "has"

  VOUCHER  ||--o{ VOUCHERWALLETLOG  : "wallet add logs"
  CLIENT   ||--o{ VOUCHERWALLETLOG  : "wallet events"

  VOUCHER  ||--o{ VOUCHERSMSLOG     : "sms logs"

  %% SALE — денормализованная запись без явных FK
  SALE     }o--o{ VOUCHER : "by value (denorm)"
  SALE     }o--o{ PRODUCT : "by productId (denorm)"
  SALE     }o--o{ MERCHANT: "by merchantUsername (denorm)"
````

> **Примечание:** `SALE` и `VOUCHERTRANSACTION` хранят ряд ссылок **денормализованно** (по `voucherValue`, `productId`, `productName`, `merchantUsername`) без явных внешних ключей. Это отражено пунктирными/комментарными связями.

---

## 2) Спецификация сущностей (таблиц)

Ниже — поля, типы, ключи, ограничения и умолчания. Типы указаны по Prisma/PG.

### 2.1. `User`

| Колонка  | Тип     | Ограничения                            | По умолчанию |
| -------- | ------- | -------------------------------------- | ------------ |
| id       | Int     | PK, autoincrement                      | yes          |
| username | String  | UNIQUE                                 | —            |
| password | String  | —                                      | —            |
| role     | Role    | ENUM(`admin`,`merchant`,`vendor_user`) | —            |
| vendorId | Int?    | FK → `Vendor.id` (nullable)            | —            |
| note     | String? | —                                      | —            |

Связи:

* `vendor?` (многие пользователи → один `Vendor`), только для роли `vendor_user`.
* `activations` (`VoucherActivation[]`, по связи `"UserActivations"`).

---

### 2.2. `Merchant`

| Колонка   | Тип            | Ограничения                   | По умолчанию |
| --------- | -------------- | ----------------------------- | ------------ |
| id        | Int            | PK, autoincrement             | yes          |
| username  | String         | UNIQUE                        | —            |
| status    | MerchantStatus | ENUM(`active`,`off`)          | `active`     |
| legalInfo | String         | —                             | —            |
| balance   | Float          | Денорм. текущая задолженность | `0`          |

Связи:

* `transactions` (`VoucherTransaction[]` по `"MerchantToTransactions"`),
* `payments` (`MerchantPayment[]` по `"MerchantToPayments"`).

---

### 2.3. `Vendor`

| Колонка                  | Тип     | Ограничения            | По умолчанию |
| ------------------------ | ------- | ---------------------- | ------------ |
| id                       | Int     | PK, autoincrement      | yes          |
| name                     | String  | —                      | —            |
| category                 | String  | —                      | —            |
| productType              | String  | —                      | —            |
| description              | String? | —                      | —            |
| receiptTemplate          | String? | —                      | —            |
| balance                  | Float   | Денорм. долг платформы | `0`          |
| defaultCommissionPercent | Float   | —                      | `80`         |

Связи:

* `products` (`Product[]`),
* `transactions` (`VoucherTransaction[]` по `"VendorToTransactions"`),
* `users` (`User[]`),
* `voucherActivations` (`VoucherActivation[]`),
* `payments` (`VendorPayment[]` по `"VendorToPayments"`).

---

### 2.4. `Product`

| Колонка                   | Тип    | Ограничения             | По умолчанию |
| ------------------------- | ------ | ----------------------- | ------------ |
| id                        | Int    | PK, autoincrement       | yes          |
| name                      | String | —                       | —            |
| price                     | Float  | —                       | —            |
| status                    | String | *(см. примечание ниже)* | —            |
| vendorId                  | Int    | FK → `Vendor.id`        | —            |
| merchantCommissionPercent | Float  | —                       | —            |
| vendorCommissionPercent   | Float  | —                       | —            |

Связи:

* `vendor` (многие → один `Vendor`),
* `vouchers` (`Voucher[]` по `"ProductVouchers"`).

> **Примечание по консистентности:** в схеме объявлен `enum ProductStatus { on off }`, но поле `Product.status` имеет тип `String`. Если хотите строгую валидацию на уровне БД/Prisma — стоит заменить на `ProductStatus`.

---

### 2.5. `Voucher`

| Колонка     | Тип           | Ограничения                                           | По умолчанию |
| ----------- | ------------- | ----------------------------------------------------- | ------------ |
| id          | Int           | PK, autoincrement                                     | yes          |
| value       | String        | UNIQUE                                                | —            |
| status      | VoucherStatus | ENUM(`activated`,`sold`,`deleted`,`active`,`pending`) | `active`     |
| productId   | Int           | FK → `Product.id`                                     | —            |
| productName | String        | Денорм. название продукта                             | —            |
| type        | VoucherType   | ENUM(`Telegram`,`Vendor`)                             | —            |

Связи:

* `product` (`Product` по `"ProductVouchers"`),
* `voucherActivations` (`VoucherActivation[]`),
* `onlineVouchers` (`OnlineVoucher[]`),
* `smsLogs` (`VoucherSmsLog[]`),
* `walletLogs` (`VoucherWalletLog[]`).

---

### 2.6. `Sale` *(денорм. “факт” без явных FK)*

| Колонка          | Тип        | Ограничения                               | По умолчанию |
| ---------------- | ---------- | ----------------------------------------- | ------------ |
| id               | Int        | PK, autoincrement                         | yes          |
| voucherValue     | String     | — (ссылка по значению на `Voucher.value`) | —            |
| price            | Float      | —                                         | —            |
| status           | SaleStatus | ENUM(`COMPLETED`,`CANCELLED`,`PENDING`)   | `COMPLETED`  |
| productId        | Int        | — (логическая ссылка на Product)          | —            |
| productName      | String     | Денорм.                                   | —            |
| merchantUsername | String     | — (логическая ссылка на Merchant)         | —            |
| date             | DateTime   | —                                         | `now()`      |
| receiptPath      | String?    | —                                         | —            |
| saleType         | SaleType   | ENUM(`ONLINE`,`OFFLINE`)                  | `OFFLINE`    |
| customerPhone    | String?    | —                                         | —            |

---

### 2.7. `VoucherTransaction`

| Колонка      | Тип               | Ограничения                                   | По умолчанию |
| ------------ | ----------------- | --------------------------------------------- | ------------ |
| id           | Int               | PK, autoincrement                             | yes          |
| voucherValue | String            | Денорм. ссылка на ваучер                      | —            |
| merchantId   | Int               | FK → `Merchant.id` (`MerchantToTransactions`) | —            |
| vendorId     | Int               | FK → `Vendor.id` (`VendorToTransactions`)     | —            |
| productId    | Int               | Денорм. ссылка на продукт                     | —            |
| productName  | String            | Денорм.                                       | —            |
| price        | Float             | —                                             | —            |
| merchantDebt | Float             | —                                             | —            |
| adminDebt    | Float             | —                                             | —            |
| vendorDebt   | Float             | —                                             | —            |
| status       | TransactionStatus | ENUM(`PENDING`,`COMPLETED`,`CANCELLED`)       | `PENDING`    |
| createdAt    | DateTime          | —                                             | `now()`      |

---

### 2.8. `MerchantPayment`

| Колонка       | Тип      | Ограничения                               | По умолчанию |
| ------------- | -------- | ----------------------------------------- | ------------ |
| id            | Int      | PK, autoincrement                         | yes          |
| merchantId    | Int      | FK → `Merchant.id` (`MerchantToPayments`) | —            |
| amount        | Float    | —                                         | —            |
| comment       | String?  | —                                         | —            |
| createdAt     | DateTime | —                                         | `now()`      |
| balanceBefore | Float    | —                                         | —            |
| balanceAfter  | Float    | —                                         | —            |

---

### 2.9. `VendorPayment`

| Колонка       | Тип      | Ограничения                           | По умолчанию |
| ------------- | -------- | ------------------------------------- | ------------ |
| id            | Int      | PK, autoincrement                     | yes          |
| vendorId      | Int      | FK → `Vendor.id` (`VendorToPayments`) | —            |
| amount        | Float    | —                                     | —            |
| comment       | String?  | —                                     | —            |
| createdAt     | DateTime | —                                     | `now()`      |
| balanceBefore | Float    | —                                     | —            |
| balanceAfter  | Float    | —                                     | —            |

---

### 2.10. `VoucherActivation`

| Колонка     | Тип      | Ограничения                                      | По умолчанию |
| ----------- | -------- | ------------------------------------------------ | ------------ |
| id          | Int      | PK, autoincrement                                | yes          |
| voucherId   | Int      | FK → `Voucher.id`                                | —            |
| activatedBy | Int?     | FK → `User.id` (`UserActivations`, nullable)     | —            |
| vendorId    | Int      | FK → `Vendor.id`                                 | —            |
| activatedAt | DateTime | —                                                | `now()`      |
| clientId    | Int?     | FK → `Client.id` (`ClientActivations`, nullable) | —            |

> **Бизнес-инвариант:** фактически ожидается не более одной успешной “финальной” активации на ваучер, однако модель допускает несколько записей (для истории/попыток). Логику уникальности конечной активации контролирует прикладной код.

---

### 2.11. `Client`

| Колонка     | Тип      | Ограничения       | По умолчанию |
| ----------- | -------- | ----------------- | ------------ |
| id          | Int      | PK, autoincrement | yes          |
| phoneNumber | String   | UNIQUE            | —            |
| name        | String?  | —                 | —            |
| createdAt   | DateTime | —                 | `now()`      |
| updatedAt   | DateTime | @updatedAt        | —            |

Связи:

* `activations` (`VoucherActivation[]`, `"ClientActivations"`),
* `onlineVouchers` (`OnlineVoucher[]`),
* `walletLogs` (`VoucherWalletLog[]`).

---

### 2.12. `OnlineVoucher`

| Колонка    | Тип      | Ограничения                   | По умолчанию |
| ---------- | -------- | ----------------------------- | ------------ |
| id         | Int      | PK, autoincrement             | yes          |
| clientId   | Int      | FK → `Client.id`              | —            |
| voucherId  | Int      | FK → `Voucher.id`, **UNIQUE** | —            |
| assignedAt | DateTime | —                             | `now()`      |

> **Кардинальность:** каждый ваучер может быть назначен **не более чем одному** клиенту (`voucherId` — UNIQ). Один клиент может иметь много `OnlineVoucher`.

---

### 2.13. `VoucherWalletLog`

| Колонка         | Тип         | Ограничения           | По умолчанию |
| --------------- | ----------- | --------------------- | ------------ |
| id              | Int         | PK, autoincrement     | yes          |
| voucherId       | Int         | FK → `Voucher.id`     | —            |
| clientId        | Int         | FK → `Client.id`      | —            |
| isAddedToWallet | Boolean     | —                     | `false`      |
| addedAt         | DateTime    | —                     | `now()`      |
| pkpassId        | String?     | —                     | —            |
| deviceInfo      | DeviceType? | ENUM(`ios`,`android`) | —            |

---

### 2.14. `VoucherSmsLog`

| Колонка     | Тип       | Ограничения                      | По умолчанию |
| ----------- | --------- | -------------------------------- | ------------ |
| id          | Int       | PK, autoincrement                | yes          |
| voucherId   | Int       | FK → `Voucher.id`                | —            |
| phoneNumber | String    | —                                | —            |
| message     | String    | —                                | —            |
| requestId   | String    | — (Eskiz message id)             | —            |
| status      | String    | — (`waiting/delivered/rejected`) | —            |
| statusDate  | DateTime? | —                                | —            |
| createdAt   | DateTime  | —                                | `now()`      |
| response    | Json?     | — (полный ответ Eskiz)           | —            |

---

### 2.15. `AuthSmsLog` *(OTP Eskiz, автономная таблица)*

| Колонка     | Тип       | Ограничения       | По умолчанию |
| ----------- | --------- | ----------------- | ------------ |
| id          | Int       | PK, autoincrement | yes          |
| phoneNumber | String    | —                 | —            |
| code        | String    | —                 | —            |
| requestId   | String    | —                 | —            |
| status      | String    | —                 | —            |
| statusDate  | DateTime? | —                 | —            |
| createdAt   | DateTime  | —                 | `now()`      |
| response    | Json?     | —                 | —            |
| verified    | Boolean   | —                 | `false`      |
| verifiedAt  | DateTime? | —                 | —            |

---

## 3) Связи и кардинальности (сводно)

1. **Vendor 1 — N Product** (`Product.vendorId → Vendor.id`).
2. **Product 1 — N Voucher** (`Voucher.productId → Product.id`).
3. **Vendor 1 — N User** (опционально для `vendor_user`; `User.vendorId → Vendor.id`).
4. **Voucher 1 — N VoucherActivation** (`VoucherActivation.voucherId → Voucher.id`).
5. **Vendor 1 — N VoucherActivation** (`VoucherActivation.vendorId → Vendor.id`).
6. **User 1 — N VoucherActivation** (опционально; `VoucherActivation.activatedBy → User.id`).
7. **Client 1 — N VoucherActivation** (опционально; `VoucherActivation.clientId → Client.id`).
8. **Voucher 1 — 0..1 OnlineVoucher** (`OnlineVoucher.voucherId` — UNIQUE).
9. **Client 1 — N OnlineVoucher** (`OnlineVoucher.clientId → Client.id`).
10. **Voucher 1 — N VoucherWalletLog** (`VoucherWalletLog.voucherId → Voucher.id`).
11. **Client 1 — N VoucherWalletLog** (`VoucherWalletLog.clientId → Client.id`).
12. **Voucher 1 — N VoucherSmsLog** (`VoucherSmsLog.voucherId → Voucher.id`).
13. **Merchant 1 — N VoucherTransaction** (`VoucherTransaction.merchantId → Merchant.id`).
14. **Vendor 1 — N VoucherTransaction** (`VoucherTransaction.vendorId → Vendor.id`).
15. **Merchant 1 — N MerchantPayment** (`MerchantPayment.merchantId → Merchant.id`).
16. **Vendor 1 — N VendorPayment** (`VendorPayment.vendorId → Vendor.id`).
17. **Sale** — денормализованные связи по значениям (`voucherValue`, `productId`, `merchantUsername`) — **FK отсутствуют**.

---

## 4) Перечисления (ENUM)

* `Role` — `admin`, `merchant`, `vendor_user`
* `MerchantStatus` — `active`, `off`
* `ProductStatus` — `on`, `off` *(не используется в `Product.status` — см. примечания)*
* `VoucherStatus` — `activated`, `sold`, `deleted`, `active`, `pending`
* `VoucherType` — `Telegram`, `Vendor`
* `SaleStatus` — `COMPLETED`, `CANCELLED`, `PENDING`
* `SaleType` — `ONLINE`, `OFFLINE`
* `TransactionStatus` — `PENDING`, `COMPLETED`, `CANCELLED`
* `DeviceType` — `ios`, `android`

---

## 5) Бизнес-инварианты данных (важно)

* **1 ваучер = 1 ключ** (`Voucher.value` — UNIQUE).
* Ваучер продаётся и активируется **ровно один раз** (прикладной контроль; модель допускает множественные записи активаций, но финальная — одна).
* Мерчант **не видит** полный код ваучера (маскирование на уровне приложения).
* **OnlineVoucher**: один ваучер может быть назначен **макс. 1** клиенту (`voucherId` UNIQUE).
* Денормализованные **балансы**:

  * `Merchant.balance` — долг мерчанта перед платформой (актуализируется транзакциями/платежами),
  * `Vendor.balance` — долг платформы перед вендором.
* **Sale** и **VoucherTransaction** содержат денормализованные поля (`voucherValue`, `productName`, `merchantUsername`) — это осознанный дизайн для устойчивости к изменениям каталогов и ускорения отчётности.

---

## 6) Индексы и ограничения (рекомендуется дополнить)

> Большинство FK индексов Prisma создаёт автоматически. Ниже — полезные явные индексы/уточнения:

* `Voucher(value)` — **UNIQUE** *(уже есть)*.
* `Client(phoneNumber)` — **UNIQUE** *(уже есть)*.
* Часто используемые фильтры:

  * `Voucher(status, vendorId, productId)` — композитный индекс для списков/поиска.
  * `VoucherTransaction(createdAt)` + (`merchantId`), (`vendorId`) — отчёты по периодам/контрагентам.
  * `Merchant(username)`, `Sale(date)`, `VoucherSmsLog(requestId)`.
* Если планируете enforce-ссылки:

  * FK от `Sale.productId` → `Product.id` *(сейчас нет)*,
  * FK от `Sale.voucherValue` → `Voucher.value` *(возможен через surrogate key, иначе строковый FK)*,
  * FK от `Sale.merchantUsername` → `Merchant.username` *(не типично, лучше `merchantId`)*,
  * FK от `VoucherTransaction.productId` → `Product.id` *(сейчас это денорм поле)*.

---

## 7) Несоответствия/заметки по схеме

1. **`Product.status` как `String` vs `ProductStatus` enum**: если требуется строгий контроль значений — заменить тип поля на `ProductStatus`.
2. **Денормализация `Sale`/`VoucherTransaction`**:

   * Плюсы: простые отчёты «в моменте», устойчивость к изменению каталога и имен.
   * Минусы: нет референциальной целостности, нужен аккуратный прикладной контроль.
   * Вариант развития: добавить суррогатные FK (например, `voucherId` в `Sale`) или материализованные представления для отчётности.
3. **Денежные поля как `Float`**: для финансов лучше `Decimal`/`numeric(18,2)` или хранение в минимальных единицах (типы `BigInt`/`Int`). Сейчас — `Float`, возможны проблемы округления в суммах/балансах.
4. **Множественные активации одного ваучера**: схема допускает >1 записи, что полезно для логов. Бизнес-правило «ровно одна успешная активация» надо обеспечить уникальным частичным индексом или прикладной валидацией (например, один `VoucherActivation` со статусом `final=true` — если такое поле добавите).

---

## 8) Типовые запросы (ориентир)

* **Баланс мерчанта:** `SELECT balance FROM Merchant WHERE id = :id;`
  (обновляется логикой при продажах и `MerchantPayment`)

* **Список активных ваучеров по продукту/вендору:**
  `SELECT * FROM Voucher WHERE status='active' AND productId=:pid AND EXISTS(SELECT 1 FROM Product p WHERE p.id=:pid AND p.vendorId=:vid);`

* **История транзакций мерчанта за период:**
  `SELECT * FROM VoucherTransaction WHERE merchantId=:mid AND createdAt BETWEEN :from AND :to ORDER BY createdAt DESC;`

* **Логи SMS по ваучеру:**
  `SELECT * FROM VoucherSmsLog WHERE voucherId=:vid ORDER BY createdAt DESC;`

* **Привязка онлайн-ваучера к клиенту:** наличие `OnlineVoucher` c `voucherId=:vid` (UNIQUE) гарантирует 0..1.

---

## 9) Жизненный цикл ключевых сущностей (данные & статусы)

* **Voucher.status:** `active → reserved → sold → (optional) pending → activated → archived/deleted`
  Возврат: `reserved → active` по TTL/отмене. `activated` — терминальное.
* **Sale.status:** `PENDING/COMPLETED/CANCELLED` — отражает жизненный цикл документа продажи; связи денорм.
* **VoucherTransaction.status:** `PENDING/COMPLETED/CANCELLED` — для процессов сверки/проводок.

---

## 10) Приложение: карты соответствия «ключ → сущности»

* **Клиентская доставка (online):** `Client` ↔ `OnlineVoucher` ↔ `Voucher` + `VoucherSmsLog` + `VoucherWalletLog`.
* **Активация у вендора:** `VoucherActivation` связывает `Voucher` + `Vendor` (+ `User`/`Client` по ситуации).
* **Финансы:** `VoucherTransaction` (начисления) → `Merchant.balance`/`Vendor.balance`; движения — `MerchantPayment`/`VendorPayment`.
* **Каталог:** `Vendor` → `Product` → `Voucher`.

---