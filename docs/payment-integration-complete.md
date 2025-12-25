# ✅ Интеграция Click и Payme завершена

## Созданные файлы:

### Routes
- ✅ `/routes/paymentRoutes.js` - маршруты для callbacks

### Controllers
- ✅ `/controllers/payment/clickController.js` - обработка Click (Prepare/Complete)
- ✅ `/controllers/payment/paymeController.js` - обработка Payme (JSON-RPC)

### Utils
- ✅ `/utils/payment/clickSignature.js` - проверка MD5 и генерация URL для Click
- ✅ `/utils/payment/paymeErrors.js` - коды ошибок Click и Payme
- ✅ `/utils/payment/paymeHelpers.js` - генерация URL и авторизация для Payme

### Изменённые файлы
- ✅ `/controllers/public/qrPaymentController.js` - добавлена поддержка редиректа на платёжные системы
- ✅ `/index.js` - подключены paymentRoutes

---

## Как это работает:

### 1. Клиент открывает `/pay/:token/checkout`

- Вводит номер телефона
- Выбирает способ оплаты (Click или Payme)
- Нажимает "ОПЛАТИТЬ"

---

### 2. POST на `/pay/:token/checkout`

```javascript
{
  phoneNumber: "+998901234567",
  paymentMethod: "click" // или "payme"
}
```

**Сервер:**
1. Создаёт `QrPaymentAttempt` со статусом `PENDING`
2. Генерирует URL для платёжной системы
3. Возвращает JSON с `redirectUrl`

---

### 3. Клиент редиректится на платёжную систему

**Click:**
```
https://my.click.uz/services/pay?
  service_id=91151&
  merchant_id=46360&
  amount=50000&
  transaction_param=123&
  return_url=https://wallet.namo.uz/pay/abc/result/123
```

**Payme:**
```
https://checkout.paycom.uz/base64(m=63b7ac...;ac.order_id=123;a=5000000)
```

---

### 4. Платёжная система присылает callbacks

**Click:**
- `POST /api/payments/click/prepare` (action=0) - проверка
- `POST /api/payments/click/complete` (action=1) - оплата

**Payme:**
- `POST /api/payments/payme` с методами:
  - `CheckPerformTransaction`
  - `CreateTransaction`
  - `PerformTransaction`

---

### 5. После успешной оплаты

- Создаётся `Sale`
- Ваучер переводится в `sold`
- Создаётся `OnlineVoucher`
- Обновляются балансы
- `QrPaymentAttempt.status = 'PAID'`

---

### 6. Клиент редиректится обратно

```
https://wallet.namo.uz/pay/abc/result/123
```

Показывается чек с кодом ваучера.

---

## 🧪 Как протестировать

### Локально (эмуляция)

Click и Payme не могут достучаться до localhost, поэтому для локального тестирования:

1. Используйте **ngrok** для создания публичного URL:
```bash
ngrok http 4000
```

2. Обновите `.env`:
```env
PAYMENT_BASE_URL=https://your-ngrok-url.ngrok.io
```

3. В настройках Click/Payme укажите ngrok URL для callbacks

---

### Production

1. Убедитесь что `.env` содержит правильные значения:
```bash
grep "CLICK\|PAYME" /home/admin1/posa/activation-system/.env
```

2. Перезапустите Docker:
```bash
cd /home/admin1/posa/activation-system
docker-compose restart backend
```

3. Проверьте логи:
```bash
docker logs -f posa_backend | grep -E "\[Click\]|\[Payme\]"
```

---

## 🔍 Проверка endpoints

### Click Prepare:
```bash
curl -X POST https://wallet.namo.uz/api/payments/click/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "click_trans_id": 12345,
    "service_id": 91151,
    "merchant_trans_id": "123",
    "amount": 50000,
    "action": 0,
    "sign_time": "2024-12-25 12:00:00",
    "sign_string": "test"
  }'
```

### Payme:
```bash
curl -X POST https://wallet.namo.uz/api/payments/payme \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'Paycom:YqXbQeMb2xXaJpuK&xv2EV5mD&oM6kT&shso' | base64)" \
  -d '{
    "method": "CheckPerformTransaction",
    "params": {
      "amount": 5000000,
      "account": { "order_id": "123" }
    },
    "id": 1
  }'
```

---

## ⚠️ Важно

1. **SSL обязателен** - и Click, и Payme требуют HTTPS
2. **Проверьте переменные окружения** - ключи должны быть правильными
3. **Логи** - все callbacks логируются с префиксом `[Click]` или `[Payme]`

---

## 📞 Если что-то не работает

1. Проверьте логи Docker:
```bash
docker logs posa_backend --tail 100 -f
```

2. Проверьте что endpoints доступны:
```bash
curl -I https://wallet.namo.uz/api/payments/click/prepare
curl -I https://wallet.namo.uz/api/payments/payme
```

3. Проверьте базу данных:
```sql
SELECT * FROM "QrPaymentAttempt" ORDER BY "createdAt" DESC LIMIT 10;
```

---

## ✨ Готово!

Теперь ваша система поддерживает реальные платежи через Click и Payme!
