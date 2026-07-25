# Alifpay Integration

## Обзор

Alifpay — платежная система Узбекистана. Данная документация описывает интеграцию Alifpay Invoice API (v2) в систему POSA Activation как третий способ оплаты рядом с Click и Payme.

В отличие от Click/Payme, реквизиты Alifpay привязываются **только к кассе (`Kassa`)** — fallback на `process.env` не предусмотрен, т.к. `alifEnv` по умолчанию `sandbox` и без явно настроенного `Token` касса просто не предлагает Alif как способ оплаты (см. `processCheckout` в `controllers/public/qrPaymentController.js`).

## Конфигурация

Реквизиты вводятся в админке: `/admin/kassas/:id/edit` → блок «Реквизиты Alifpay».

| Поле в `Kassa` | Назначение |
|---|---|
| `alifTokenProduction` | Token для запросов к `POST /invoice` в проде |
| `alifTokenSandbox` | Token для запросов к `POST /invoice` в песочнице |
| `alifSecretKeyProduction` | Секрет для проверки HMAC-подписи вебхука, прод |
| `alifSecretKeySandbox` | Секрет для проверки HMAC-подписи вебхука, sandbox |
| `alifEnv` | `sandbox` \| `production` — какой из токенов/секретов использовать |

### Endpoints

```
POST /pay/:token/checkout           - создаёт QrPaymentAttempt + счёт в Alifpay (paymentMethod=alif)
POST /api/payments/alif/:kassaId/webhook  - вебхук от Alifpay (per-kassa)
```

`webhook_url` передаётся в Alifpay динамически при создании счёта (не настраивается в личном кабинете Alifpay заранее, в отличие от Click/Payme, где callback URL статичный per-merchant).

## Поток оплаты

1. Клиент выбирает Alif на `/pay/:token/checkout` → `POST /pay/:token/checkout` с `paymentMethod=alif`.
2. Бэкенд вызывает `createInvoice()` (`utils/payment/alifClient.js`) → `POST {baseUrl}/invoice` с заголовком `Token`, телом `{ items, cancel_url, redirect_url, webhook_url, meta: { order_id } }`.
   - `order_id` в `meta` — это `QrPaymentAttempt.id`, что позволяет находить попытку оплаты в вебхуке без завязки на `externalPaymentId`.
   - Сумма — в тийинах (`price * 100`), диапазон 50 000–20 000 000 000 тийин (500–200 000 000 сум) — валидируется до вызова API.
3. `QrPaymentAttempt.externalPaymentId` сохраняется сразу (invoice id) — счёт уже реально создан на стороне Alifpay.
4. Клиент редиректится на `https://checkout(-dev).alifpay.uz/?invoice=...`.
5. После оплаты (или отказа) Alifpay шлёт вебхук на `POST /api/payments/alif/:kassaId/webhook`.
6. Вебхук проверяет HMAC-подпись по **сырому телу запроса** (заголовок `Signature`), затем вызывает общую `processPaymentInternal()` — списание ваучера, чек, SMS, обновление балансов и `Kassa.totalReceivedAlif`.

**Если вебхук не подтверждён (HTTP не 200) в течение часа — Alifpay сам отменяет платёж и возвращает деньги клиенту.** Поэтому обработчик всегда отвечает `200`, даже при внутренней ошибке (сама ошибка логируется отдельно).

## Структура тела вебхука

```json
{
  "id": "invoice-id",
  "meta": { "order_id": "123" },
  "payment": {
    "id": "payment-id",
    "status": "SUCCEEDED",
    "amount": 150000
  }
}
```

**Важно:** верхнеуровневый `id` — это ID счёта (invoice), а не платежа. Статус/сумма/ID платежа — в `payment.*`. Разбор по плоской структуре (как у Click) здесь неприменим.

Статусы `payment.status`, помимо `SUCCEEDED`: `PENDING`, `PENDING_REVERSAL`, `OTP_REQUIRED` (промежуточные, попытка не меняется), любой другой финальный статус переводит `QrPaymentAttempt` в `FAILED`.

## Подпись вебхука

```
Signature = base64( HMAC-SHA256(rawBody, secretKey) )
```

`rawBody` — точные байты тела запроса, без повторной JSON-сериализации. Для этого в `index.js` глобальный `express.json()` подключён с опцией `verify`, которая сохраняет `req.rawBody` (Buffer) до парсинга — `JSON.stringify(req.body)` не подходит, т.к. порядок ключей/форматирование чисел при пересборке может отличаться от присланного Alifpay, и подпись не совпадёт.

## Тестирование в sandbox

- Base URL API: `https://api-dev.alifpay.uz/v2` (не подтверждён напрямую документацией Alifpay — сверить в личном кабинете перед боевым тестированием).
- Checkout: `https://checkout-dev.alifpay.uz/`
- Тестовая карта успешной оплаты: `1234111111111111`, OTP `111111`.
- Тестовая карта отказа (недостаточно средств): `1234666666666666`.

## Коды ошибок

Alifpay всегда возвращает HTTP 200 у `POST /invoice`, даже при бизнес-ошибке — признак ошибки — поле `error` в теле ответа. Полный список кодов (диапазон `1001`–`1110`) — см. официальную документацию [docs.alifpay.uz](https://docs.alifpay.uz).

## Отличия от Click/Payme

| | Click | Payme | Alifpay |
|---|---|---|---|
| Инициация | URL строится локально | URL строится локально | Реальный HTTP-вызов `POST /invoice` до редиректа |
| Callback | Prepare/Complete, MD5 | JSON-RPC, Basic Auth | 1 вебхук, HMAC-SHA256 в заголовке `Signature` |
| Тело вебхука | Плоские поля | JSON-RPC params | Вложенное: `payment.*`, верхний `id` — ID счёта |
| Сумма | Сумы | Тийины | Тийины, диапазон 500–200 000 000 сум |
| Таймаут ответа | — | — | 1 час, иначе автоотмена и возврат денег клиенту |
