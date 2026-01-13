# Payme Merchant API Integration

## Обзор

Payme — платежная система Узбекистана. Данная документация описывает интеграцию Payme Merchant API в систему POSA Activation.

## Конфигурация

### Переменные окружения

```env
PAYME_MERCHANT_ID=your_merchant_id
PAYME_KEY=your_production_key
PAYME_TEST_KEY=your_test_key
PAYME_ENV=test|production
```

### Endpoint

```
POST /api/payments/payme
```

### Авторизация

Basic Auth:
- Username: `Paycom`
- Password: `PAYME_KEY` (production) или `PAYME_TEST_KEY` (test)

---

## Методы API

### 1. CheckPerformTransaction

Проверка возможности проведения платежа.

**Запрос:**
```json
{
    "method": "CheckPerformTransaction",
    "params": {
        "amount": 1500000,
        "account": {
            "Namo": "26"
        }
    },
    "id": 123
}
```

**Успешный ответ:**
```json
{
    "result": {
        "allow": true
    },
    "id": 123
}
```

**Ошибки:**
| Код | Описание |
|-----|----------|
| -31001 | Неверная сумма |
| -31050 | Заказ не найден |
| -31051 | Заказ отменён |
| -31052 | Заказ уже оплачен |

---

### 2. CreateTransaction

Создание транзакции.

**Запрос:**
```json
{
    "method": "CreateTransaction",
    "params": {
        "id": "payme_transaction_id",
        "time": 1699114284039,
        "amount": 1500000,
        "account": {
            "Namo": "26"
        }
    },
    "id": 456
}
```

**Успешный ответ:**
```json
{
    "result": {
        "create_time": 1699114284039,
        "transaction": "26",
        "state": 1
    },
    "id": 456
}
```

**Состояния (state):**
| State | Описание |
|-------|----------|
| 1 | Транзакция создана |
| 2 | Транзакция выполнена |
| -1 | Транзакция отменена (до выполнения) |
| -2 | Транзакция отменена (после выполнения) |

---

### 3. PerformTransaction

Проведение платежа.

**Запрос:**
```json
{
    "method": "PerformTransaction",
    "params": {
        "id": "payme_transaction_id"
    },
    "id": 789
}
```

**Успешный ответ:**
```json
{
    "result": {
        "transaction": "26",
        "perform_time": 1699114285002,
        "state": 2
    },
    "id": 789
}
```

---

### 4. CancelTransaction

Отмена транзакции.

**Запрос:**
```json
{
    "method": "CancelTransaction",
    "params": {
        "id": "payme_transaction_id",
        "reason": 1
    },
    "id": 101
}
```

**Причины отмены (reason):**
| Reason | Описание |
|--------|----------|
| 1 | Одна или несколько товарных позиций отсутствуют |
| 2 | Ошибочная операция |
| 3 | Возврат на основании заявления клиента |
| 4 | Отмена по таймауту |
| 5 | Тестовая транзакция |

**Успешный ответ:**
```json
{
    "result": {
        "transaction": "26",
        "cancel_time": 1699114286000,
        "state": -1
    },
    "id": 101
}
```

---

### 5. CheckTransaction

Проверка статуса транзакции.

**Запрос:**
```json
{
    "method": "CheckTransaction",
    "params": {
        "id": "payme_transaction_id"
    },
    "id": 102
}
```

**Успешный ответ:**
```json
{
    "result": {
        "create_time": 1699114284039,
        "perform_time": 1699114285002,
        "cancel_time": 0,
        "transaction": "26",
        "state": 2,
        "reason": null
    },
    "id": 102
}
```

---

### 6. GetStatement

Получение списка транзакций за период.

**Запрос:**
```json
{
    "method": "GetStatement",
    "params": {
        "from": 1699114284039,
        "to": 1699120284000
    },
    "id": 103
}
```

**Успешный ответ:**
```json
{
    "result": {
        "transactions": [
            {
                "id": "payme_transaction_id",
                "time": 1699114284039,
                "amount": 1500000,
                "account": {
                    "Namo": "26"
                },
                "create_time": 1699114284039,
                "perform_time": 1699114285002,
                "cancel_time": 0,
                "transaction": "26",
                "state": 2,
                "reason": null
            }
        ]
    },
    "id": 103
}
```

---

## Формат ошибок

Все ошибки возвращаются в мультиязычном формате:

```json
{
    "error": {
        "code": -31001,
        "message": {
            "uz": "Noto'g'ri summa",
            "ru": "Недопустимая сумма",
            "en": "Invalid amount"
        },
        "data": null
    },
    "id": 123
}
```

### Коды ошибок

| Код | Описание |
|-----|----------|
| -32300 | Ошибка транспорта |
| -32400 | Системная ошибка |
| -32504 | Ошибка авторизации |
| -32601 | Метод не найден |
| -31001 | Неверная сумма |
| -31003 | Транзакция не найдена |
| -31007 | Невозможно отменить транзакцию |
| -31008 | Невозможно выполнить операцию |
| -31050 | Заказ не найден |
| -31051 | Заказ отменён |
| -31052 | Заказ уже оплачен |
| -31053 | По заказу уже есть транзакция |

---

## Файлы реализации

| Файл | Описание |
|------|----------|
| `controllers/payment/paymeController.js` | Основной контроллер |
| `utils/payment/paymeErrors.js` | Коды ошибок |
| `utils/payment/paymeHelpers.js` | Вспомогательные функции |
| `routes/paymentRoutes.js` | Маршруты API |

---

## Тестирование

### Песочница

URL: `https://test.paycom.uz`

### Тестовые данные

Для тестирования используйте заказы со статусом `PENDING`:

```bash
docker exec activation-system node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.qrPaymentAttempt.findMany({
  where: { status: 'PENDING' },
  select: { id: true, amount: true }
}).then(console.log);
"
```

### Переключение режимов

```env
# Тестовый режим
PAYME_ENV=test

# Продакшн
PAYME_ENV=production
```

---

## Схема базы данных

Транзакции хранятся в таблице `QrPaymentAttempt`:

| Поле | Тип | Описание |
|------|-----|----------|
| id | Int | ID заказа (order_id / Namo) |
| amount | Float | Сумма в сумах |
| status | Enum | PENDING, PROCESSING, PAID, FAILED, EXPIRED |
| externalPaymentId | String? | ID транзакции Payme |
| createdAt | DateTime | Время создания |
| paidAt | DateTime? | Время оплаты |
| cancelTime | DateTime? | Время отмены |
| cancelReason | Int? | Причина отмены |

---

## Ссылки

- [Официальная документация Payme](https://developer.help.paycom.uz/)
- [Методы Merchant API](https://developer.help.paycom.uz/metody-merchant-api/)
