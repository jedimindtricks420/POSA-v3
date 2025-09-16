# SRS.md — Software Requirements Specification
> Проект: **activation-system**  
> Версия: **1.0 (MVP/GA план)**  
> Дата: 2025-09-16 (TZ: Asia/Tashkent)  
> Контакты владельца продукта: Ахмад Буранов

---

## 1. Введение

### 1.1. Назначение документа
Этот документ формализует требования к системе **activation-system**: функциональные, нефункциональные, интерфейсные и данные. Он служит базой для разработки, тестирования, релиз-менеджмента и дальнейшей эволюции продукта.

### 1.2. Область применения (Scope)
Система — B2B веб-платформа для **выпуска, продажи, доставки и активации** цифровых ваучеров/лицензионных ключей с учётом комиссий и балансов сторон. Поддерживается **Apple Wallet (.pkpass)**, офлайн/онлайн доставка, интеграция с **одним Telegram-вендором** (через отдельный Python-модуль) и отправка OTP/SMS через **Eskiz**.

### 1.3. Определения, термины и сокращения
- **Voucher (ваучер)** — единица товара, соответствующая **ровно одному** активационному ключу.
- **Sale** — оформленная и подтверждённая продажа набора ваучеров.
- **Merchant** — партнёр-продавец на платформе.
- **Vendor** — поставщик продукции (вендор).
- **VendorUser** — пользователь со стороны вендора, который активирует ваучеры.
- **Client** — конечный покупатель ваучера.
- **Apple Wallet / .pkpass** — кошелёк iOS для хранения пропусков/карт.
- **Eskiz** — SMS-провайдер (Узбекистан); используется для OTP/SMS-доставки.
- **Pyrogram** — Python-библиотека для Telegram-клиента (userbot).
- **ACL** — контроль доступа (access control list).
- **TTL** — время жизни резерва (time-to-live).

### 1.4. Ссылки
- `BUSINESS_LOGIC.md` v2 (актуально на 2025-09-16).  
- `PRD.md` v1.0 (MVP/GA).  
- Внутренние схемы/диаграммы ERD/API (прилагаются отдельно).

### 1.5. Обзор
SRS структурирован на: контекст системы, функциональные требования (с идентификаторами), требования к данным и интерфейсам, нефункциональные требования, окружение и деплой, тестирование и трассируемость.

---

## 2. Обзор системы и контекст

### 2.1. Техконтекст
- Backend: **Node.js + Express**  
- ORM/DB: **Prisma + PostgreSQL**  
- Frontend: **EJS + Bootstrap** (без Vite)  
- Отдельный модуль: **Python (Pyrogram)** — **только** для одного Telegram-вендора  
- Порт по умолчанию: **4000**  
- Рабочая директория: `/home/admin1/posa/activation-system`  
- PDF-чеки: **PDFKit**, директория `/receipts` (путь хранится в `Sale.receiptPath`)  
- TZ: **Asia/Tashkent**

### 2.2. Внешние участники и интеграции
- **Eskiz SMS API** — отправка сообщений/OTP и приём callback-статусов (`request_id`, `status`, `status_date` и др.).
- **Apple Wallet** — генерация и подпись `.pkpass` для iOS.
- **Telegram (Pyrogram userbot)** — получение ключей **только** для одного конкретного вендора.

### 2.3. Ограничения и границы
- Только **один** Telegram-вендор через Python.
- **1 ваучер = 1 ключ**; одноразовая продажа и активация.
- Роли: Admin, Merchant, Vendor, VendorUser, Client.
- Мерчант **не видит** полный код ваучера (маскирование).

---

## 3. Функциональные требования
> Формулировка в формате **«Система должна… (shall)»**. Идентификаторы пригодны для тест-кейсов.

### 3.1. Аутентификация и авторизация
- **SRS-AUTH-01**: Система **должна** поддерживать вход по логину/паролю для ролей Admin, Merchant, VendorUser.  
- **SRS-AUTH-02**: Пароли **должны** храниться с безопасным хешированием (например, Argon2/Bcrypt).  
- **SRS-AUTH-03**: Авторизация **должна** ограничивать доступ к действиям согласно роли (ACL).  
- **SRS-AUTH-04**: VendorUser **должен** иметь доступ к активации **только** ваучеров своего `vendorId`.  
- **SRS-AUTH-05**: Доступ к эндпоинту `/activate?token=...` **должен** проверять валидность токена (подпись, `exp`, `scope`).  
- **SRS-AUTH-06**: Сессии и JWT **должны** иметь сроки жизни и механизмы инвалидации.

### 3.2. Управление справочниками (Admin)
- **SRS-ADM-01**: Админ **должен** управлять вендорами (`Vendor`), их пользователями (`VendorUser`), мерчантами (`Merchant`), продуктами (`Product`) и ваучерами (`Voucher`).  
- **SRS-ADM-02**: Для `Product` система **должна** хранить `price`, `status`, `vendorId`, `vendorCommissionPercent`, `merchantCommissionPercent`, шаблоны SMS/Email/чека.  
- **SRS-ADM-03**: Админ **должен** иметь интерфейс массовой загрузки **Voucher** (построчно) с присвоением `productId`, `vendorId`, `type=Manual`, `status=active`.  
- **SRS-ADM-04**: Система **должна** предотвращать дубликаты кодов ваучеров (уникальность).  
- **SRS-ADM-05**: Система **должна** отображать в админке текущие **балансы** `Merchant.balance` и `Vendor.balance`.

### 3.3. Каталог и ваучеры
- **SRS-VCH-01**: Ваучер **должен** иметь статусы: `active`, `reserved`, `sold`, `pending`, `activated`, `archived/deleted`.  
- **SRS-VCH-02**: Переходы статусов **должны** соответствовать модели в `BUSINESS_LOGIC.md` (см. 5.1).  
- **SRS-VCH-03**: При показе в UI мерчанта код ваучера **должен** быть замаскирован (первые 3 символа + `******`).  
- **SRS-VCH-04**: Для одного конкретного вендора тип `Voucher.type = Telegram`: система **должна** уметь получить ключ через модуль Python (Pyrogram), вычленив **только строку ключа** из ответа бота.  
- **SRS-VCH-05**: Система **должна** логировать все переходы статусов ваучера в `AuditLog`.

### 3.4. Корзина и подтверждение продажи (Merchant)
- **SRS-CART-01**: Система **должна** позволять мерчанту собирать корзину (session-based / Redis).  
- **SRS-CART-02**: Резерв `reserved` **должен** иметь TTL (по умолчанию 15 минут). По истечении — возврат в `active`.  
- **SRS-CART-03**: Подтверждение продажи **должно** быть идемпотентным (по `idempotencyKey`) и атомарным.  
- **SRS-CART-04**: При подтверждении продажи система **должна**:  
  a) перевести ваучеры `active/reserved → sold`;  
  b) создать `Sale` с `deliveryType` = `offline`/`online`;  
  c) на каждый ваучер создать `VoucherTransaction` с расчётом `merchantDebt` и `adminDebt`;  
  d) обновить `Merchant.balance += Σ merchantDebt`;  
  e) обновить `Vendor.balance += Σ adminDebt`;  
  f) сгенерировать **PDF-чек** (PDFKit), сохранить `receiptPath`;  
  g) редиректить на `/merchant/sales`.
- **SRS-CART-05**: При сбое подтверждения система **должна** откатить незавершённые резервы и гарантировать отсутствие дублирующих `Sale`.

### 3.5. Доставка: офлайн и онлайн
- **SRS-DLV-01**: Для `deliveryType=offline` чек **должен** содержать QR-код, ведущий на `/activate?token=...`.  
- **SRS-DLV-02**: Токен в ссылке **должен** быть подписан, иметь `exp`, `voucherId`, `vendorId`, `scope`; по умолчанию токен **не** одноразовый.  
- **SRS-DLV-03**: Для `deliveryType=online` система **должна**:  
  a) создать/найти `Clients` по номеру телефона;  
  b) создать `OnlineVouchers` (связь clientId ↔ voucherId);  
  c) отправить SMS через **Eskiz** по шаблону продукта;  
  d) записать `VoucherSmsLog` с `requestId`;  
  e) обработать callback Eskiz (`request_id`, `status`, `status_date`) и обновить лог.
- **SRS-DLV-04**: При открытии ссылки с iOS система **должна** предложить `.pkpass` и записать `VoucherWalletLog`; статус ваучера может перейти в `pending`.  
- **SRS-DLV-05**: При открытии ссылки с Android система **должна** вести в веб-кабинет/OTP (Eskiz), записать `VoucherWalletLog`; статус — `pending`.

### 3.6. Активация у вендора
- **SRS-VEND-01**: Вендор/VendorUser **должны** иметь экран активации с вводом/сканом кода ваучера.  
- **SRS-VEND-02**: Система **должна** проверять, что `vendorId` ваучера совпадает с `vendorId` пользователя.  
- **SRS-VEND-03**: Разрешены переходы `sold|pending → activated`; при иных — отказ.  
- **SRS-VEND-04**: Для `Voucher.type=Telegram`, если ключ ещё не присвоен — система **должна** запросить Python-модуль (Pyrogram), получить ответ бота, извлечь **строку ключа**, присвоить ваучеру и залогировать операцию.  
- **SRS-VEND-05**: Все активации **должны** писаться в `AuditLog`.

### 3.7. Финансы и балансы
- **SRS-FIN-01**: Для каждой позиции продажи система **должна** рассчитывать:  
  `adminDebt = price * vendorCommissionPercent / 100`  
  `merchantReward = price * merchantCommissionPercent / 100`  
  `platformGross = price - adminDebt - merchantReward`  
  `merchantDebt = price - merchantReward`
- **SRS-FIN-02**: `Merchant.balance` **должен** увеличиваться на `Σ merchantDebt` при продажах и уменьшаться на суммы `MerchantPayment`.  
- **SRS-FIN-03**: `Vendor.balance` **должен** увеличиваться на `Σ adminDebt` при продажах и уменьшаться на суммы `VendorPayment`.  
- **SRS-FIN-04**: Система **должна** обеспечивать формы ввода `MerchantPayment` и `VendorPayment` с фиксацией `balanceBefore/After`.  
- **SRS-FIN-05**: Отчётные страницы `/admin/merchants` и `/admin/vendors` **должны** показывать актуальные балансы и историю транзакций/платежей.

### 3.8. Отчётность и журналы
- **SRS-REP-01**: Система **должна** предоставлять фильтры по статусам ваучеров, вендорам, продуктам, периодам.  
- **SRS-REP-02**: Система **должна** позволять выгружать CSV для продаж/транзакций/платежей.  
- **SRS-REP-03**: Должны вестись логи: `VoucherSmsLog`, `VoucherWalletLog`, `AuditLog`.

### 3.9. Локализация и представление
- **SRS-UX-01**: Интерфейс и шаблоны **должны** поддерживать RU/EN.  
- **SRS-UX-02**: Формат цен в UZS **должен** отображаться как `9.99 сум`.  
- **SRS-UX-03**: После подтверждения продажи система **должна** перенаправлять мерчанта на `/merchant/sales`.

---

## 4. Данные и модель (ERD — обзор)

### 4.1. Основные сущности (ключевые поля)
- **User**: id, username, passwordHash, role.  
- **Merchant**: id, name/username, legalInfo, status, **balance** (задолженность мерчанта).  
- **Vendor**: id, name, status, legalInfo, vendorType, **balance** (задолженность платформы перед вендором).  
- **VendorUser**: id, vendorId, username, passwordHash, status.  
- **Product**: id, name, price, status, vendorId, vendorCommissionPercent, merchantCommissionPercent, templates (sms/email/receipt).  
- **Voucher**: id, code/value, status, productId, vendorId, type (`Telegram|Manual|API`), (опц.) keyStoreRef, createdAt, updatedAt.  
- **Sale**: id, merchantId, total, deliveryType (`offline|online`), receiptPath, createdAt.  
- **VoucherTransaction**: id, saleId, voucherId, productId, merchantId, vendorId, merchantDebt, adminDebt, platformGross, createdAt.  
- **MerchantPayment**: id, merchantId, amount, balanceBefore, balanceAfter, createdAt.  
- **VendorPayment**: id, vendorId, amount, balanceBefore, balanceAfter, createdAt.  
- **Clients**: id, phoneNumber (уник.), createdAt.  
- **OnlineVouchers**: id, voucherId, clientId, assignedAt.  
- **VoucherWalletLog**: id, voucherId, clientId, isAddedToWallet, addedAt, pkpassId, deviceInfo.  
- **VoucherSmsLog**: id, voucherId, phoneNumber, message, requestId, status, statusDate, response JSON, createdAt.  
- **AuditLog**: id, actorUserId, role, action, entityType, entityId, details JSON, ip/ua, createdAt.

### 4.2. Инварианты и ограничения
- **1 ваучер = 1 ключ**; уникальность `Voucher.code/value`.  
- Переиспользование активированного ваучера **запрещено**.  
- Маскирование кода ваучера для ролей, не имеющих права на полный просмотр.  
- Денормализованные поля балансов (`Merchant.balance`, `Vendor.balance`) **истинны** и обновляются только через транзакции/платежи.

### 4.3. Индексы и производительность
- Уникальный индекс на `Voucher.code/value`.  
- Индексы по `Voucher.status`, `Voucher.vendorId`, `Voucher.productId`.  
- Индексы по внешним ключам в `VoucherTransaction`, `OnlineVouchers`, логах.

### 4.4. Ретенция и приватность
- Логи SMS/Wallet/Audit — хранение согласно политике (минимум 1 год, если не указано иное).  
- PII: телефон в `Clients`, должен храниться и передаваться согласно политике приватности.

---

## 5. Внешние интерфейсы и протоколы

### 5.1. Eskiz SMS
- **Отправка**: `POST https://notify.eskiz.uz/api/message/sms/send`  
  Параметры: `to` (phone), `text` (шаблон с ссылкой), … (см. Eskiz docs).  
  Ответ: содержит `id` → сохраняем в `VoucherSmsLog.requestId`.  
- **Callback** (входящий): содержит `request_id`, `status`, `status_date`, др. поля. Система обновляет запись `VoucherSmsLog` и помечает итоговый статус доставки/OTP.

### 5.2. Telegram (Pyrogram)
- Запрос к боту-магазину (команда типа `/402`) → ответ-сообщение.  
- Парсер **обязан** извлечь **только строку ключа** и вернуть её Node-приложению.  
- Ошибки и неоднозначные ответы — в `AuditLog`, без сохранения мусорных данных.

### 5.3. Apple Wallet (.pkpass)
- Генерация `.pkpass` с подписью сертификатами (хранятся в окружении).  
- iOS на ссылке `/activate?token=...` получает `.pkpass`; создаётся `VoucherWalletLog`.

### 5.4. Email SMTP (после GA, опц.)
- Канал доставки ключа/инструкций на email клиента.

---

## 6. Нефункциональные требования

### 6.1. Производительность
- **SRS-NFR-PERF-01**: Подтверждение продажи (1–10 ваучеров) **≤ 2 сек** при номинальной нагрузке.  
- **SRS-NFR-PERF-02**: Отправка SMS — асинхронная, UI не блокируется ожиданием ответа Eskiz.  
- **SRS-NFR-PERF-03**: Страницы списков (1000 записей) — TTFB ≤ 500 мс при пагинации.

### 6.2. Надёжность и доступность
- **SRS-NFR-REL-01**: Идемпотентность подтверждения продажи по `idempotencyKey`.  
- **SRS-NFR-REL-02**: TTL резерва — 15 минут; по истечении — авто-rollback.  
- **SRS-NFR-REL-03**: Бэкапы БД — ежедневные инкрементальные + еженедельные полные; проверка восстановления ежемесячно.  
- **SRS-NFR-REL-04**: RPO ≤ 24 часа; RTO ≤ 4 часа (для MVP).

### 6.3. Безопасность
- **SRS-NFR-SEC-01**: Секреты (JWT, Eskiz, Apple Wallet) — **только** в переменных окружения; не коммитятся.  
- **SRS-NFR-SEC-02**: Шифрование в транспорте (HTTPS).  
- **SRS-NFR-SEC-03**: Рекомендуется шифрование/сегрегация хранения самих ключей ваучеров; минимум — ограничение чтения и аудит.  
- **SRS-NFR-SEC-04**: Ограничение частоты запросов (rate limiting) к критичным эндпоинтам.  
- **SRS-NFR-SEC-05**: CSRF-защита для форм, XSS-санитизация для полей ввода.  
- **SRS-NFR-SEC-06**: Токен `/activate` — подписан, содержит `exp`, `scope`, `voucherId`, `vendorId`; утечка токена не должна позволять активацию без кабинета вендора.

### 6.4. Масштабирование и поддерживаемость
- **SRS-NFR-SCL-01**: Веб-слой stateless; сессии/корзины — в Redis/БД.  
- **SRS-NFR-SCL-02**: Разделение очередей задач (SMS, PDF, pkpass) от HTTP-слоя.  
- **SRS-NFR-MNT-01**: Миграции Prisma обязательны; схемы версионируются.

### 6.5. Локализация, юзабилити
- **SRS-NFR-I18N-01**: RU/EN; легко расширяемо.  
- **SRS-NFR-UX-01**: Форматы дат/валют локализованы (UZS: `9.99 сум`).

### 6.6. Логирование и мониторинг
- **SRS-NFR-OBS-01**: Структурные логи: продажи, Eskiz, Telegram, активации, платежи.  
- **SRS-NFR-OBS-02**: Бизнес-метрики KPI (см. PRD §3.2) — в метриках/дашбордах.  
- **SRS-NFR-OBS-03**: Алерты при: падении доли успешных SMS, ошибках Telegram-модуля, расхождении балансов.

---

## 7. Окружение и деплой

### 7.1. Среды
- **DEV**, **STAGE**, **PROD** (рекомендуется).  
- Порт по умолчанию: **4000** (конфигурируемый).  
- База: PostgreSQL; миграции через Prisma.

### 7.2. Конфигурация и переменные окружения (примеры)
- `DATABASE_URL` (PostgreSQL URI)  
- `JWT_SECRET`, `WALLET_CERT_*` (Apple Wallet), `ESKIZ_API_*`  
- `TZ=Asia/Tashkent`  
> **Примечание:** значения секретов в репозитории **не** храним.

### 7.3. Файловое хранилище
- `/receipts` — PDF-чеки.  
- Хранилище для `.pkpass` (если кэшируем/логируем).  
- Ротация и очистка согласно политике.

---

## 8. Миграции и начальные данные
- Прогон миграций Prisma при деплое.  
- Админ-учётка (seed).  
- Начальные справочники (по необходимости): Vendors, Products, шаблоны.

---

## 9. Верификация и тестирование

### 9.1. Стратегия тестов
- **Unit**: расчёты комиссий, утилиты токенов, парсинг Telegram-ответов.  
- **Integration**: подтверждение продажи (атомарность, идемпотентность), Eskiz (моки), Apple Wallet генерация (моки).  
- **E2E**: офлайн/онлайн флоу, активация у вендора, отчёты/балансы.  
- **Security**: маскирование кодов, ACL для VendorUser, rate limiting.

### 9.2. Критические тест-кейсы (примерно)
- **TC-SALE-01**: подтверждение продажи с 3 ваучерами → `sold`, `Sale`, `VoucherTransaction`, обновление балансов, PDF, редирект.  
- **TC-DLV-ONLINE-01**: онлайн-доставка → SMS `requestId`, callback обновляет `VoucherSmsLog`.  
- **TC-WALLET-01**: iOS открывает ссылку → `.pkpass`, `VoucherWalletLog`, статус `pending`.  
- **TC-VENDOR-ACL-01**: VendorUser пытается активировать чужой ваучер → отказ.  
- **TC-FIN-01**: сверка `Merchant/Vendor.balance` против суммы транзакций и платежей.

### 9.3. Критерии приёмки (соответствуют PRD §9)
См. AC-Sale-01, AC-Delivery-01/02, AC-Wallet-01, AC-Activate-01, AC-Finance-01 из PRD — должны быть покрыты автотестами.

---

## 10. Трассируемость требований (фрагмент)
| PRD эпик/AC | SRS ID(ы) |
|---|---|
| Продажа оффлайн/онлайн (AC-Sale-01) | SRS-CART-03/04/05, SRS-DLV-01/02 |
| Eskiz SMS + callback (AC-Delivery-02) | SRS-DLV-03 |
| Apple Wallet (AC-Wallet-01) | SRS-DLV-04 |
| Активация у вендора (AC-Activate-01) | SRS-VEND-01/02/03/05 |
| Балансы/комиссии (AC-Finance-01) | SRS-FIN-01/02/03/04/05 |
| Маскирование ваучеров | SRS-VCH-03, SRS-NFR-SEC-03 |

---

## 11. Риски и допущения
- **Telegram-вендор нестабилен** → ретраи, уведомления, фолбэк (ручная выдача).  
- **Недоставка SMS** → мониторинг статусов, повторная отправка, альтернативные каналы.  
- **Ошибки комиссий/балансов** → авто-тесты расчётов, сверки отчётов.  
- **Утечки ключей** → ограничение доступа, маскирование, опциональное шифрование.

---

## 12. Открытые вопросы
1. Время жизни токена `/activate` по умолчанию (предложение: **48 часов**).  
2. Где хранить коды ключей: шифрование на уровне БД/приложения?  
3. Требования к экспортам (форматы, поля, локаль) для отчётов GA.  
4. Нужен ли email-канал в MVP или перенести в GA.

---

## 13. Приложения

### 13.1. Состояния ваучера (state machine, текст)
`active → reserved → sold → (optional) pending → activated → archived/deleted`  
Возвраты: `reserved → active` (отмена/TTL). Активация возможна **только** из `sold|pending`.

### 13.2. Примеры формул (1 ваучер)
adminDebt = price * vendorCommissionPercent / 100
merchantReward = price * merchantCommissionPercent / 100
platformGross = price - adminDebt - merchantReward
merchantDebt = price - merchantReward

### 13.3. Эндпоинты верхнего уровня (контуры)
- `POST /merchant/cart` — управление корзиной  
- `POST /merchant/checkout/confirm` — подтверждение продажи  
- `POST /delivery/online/assign` — online-привязка и SMS Eskiz  
- `POST /vendor/activate` — активация ваучера  
- `POST /payments/merchant` / `POST /payments/vendor` — платежи  
- `GET /admin/merchants` / `GET /admin/vendors` — отчёты/балансы

---