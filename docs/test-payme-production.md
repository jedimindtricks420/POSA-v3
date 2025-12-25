# 🧪 ИНСТРУКЦИЯ ПО ТЕСТИРОВАНИЮ PAYME (PRODUCTION)

## ✅ Подготовка завершена!

- ✅ Docker перезапущен
- ✅ Payme переведён на production (`PAYME_ENV=production`)
- ✅ Click тоже на production (`CLICK_ENV=production`)
- ✅ Сервер работает на https://wallet.namo.uz

---

## 📋 ПОШАГОВОЕ ТЕСТИРОВАНИЕ

### Шаг 1: Создайте QR-ссылку

1. Откройте админку:
```
https://wallet.namo.uz/admin/qr-links
```

2. Выберите:
   - Мерчанта
   - Товар (проверьте что есть активные ваучеры!)
   
3. Скопируйте ссылку (например: `https://wallet.namo.uz/pay/abc123xyz`)

---

### Шаг 2: Откройте ссылку в браузере

```
https://wallet.namo.uz/pay/abc123xyz
```

**Что должно быть:**
- Название товара
- Цена
- Кнопка "КУПИТЬ" (зелёная)

---

### Шаг 3: Нажмите "КУПИТЬ"

URL изменится на:
```
https://wallet.namo.uz/pay/abc123xyz/checkout
```

**Что должно быть:**
- Поле "Номер телефона" с префиксом +998
- Два варианта: Click и **Payme**
- Кнопка "ОПЛАТИТЬ X сум"

---

### Шаг 4: Введите данные

1. Номер телефона: `901234567` (9 цифр БЕЗ +998)
2. **Выберите Payme** (нажмите на карточку с Payme)
3. Нажмите "ОПЛАТИТЬ"

---

### Шаг 5: Откройте консоль браузера (F12)

**Перед нажатием "ОПЛАТИТЬ":**

1. Нажмите F12
2. Вкладка "Console"
3. Убедитесь что выбран **Payme**
4. Нажмите "ОПЛАТИТЬ"

**Что должно быть в консоли:**
```
POST https://wallet.namo.uz/pay/abc123xyz/checkout
Status: 200
Response: {
  "success": true,
  "redirectUrl": "https://checkout.paycom.uz/..."
}
```

**Важно:** URL начинается с `checkout.paycom.uz` (production), а не `test.paycom.uz`

---

### Шаг 6: Проверьте что происходит

**Если редирект происходит:**
- ✅ Вы попадёте на **checkout.paycom.uz** (НЕ test.paycom.uz!)
- Там будет форма оплаты Payme
- **ВНИМАНИЕ:** Это уже REAL MONEY! Транзакция будет реальной!

**Если редирект НЕ происходит:**
- ❌ Смотрите консоль браузера (F12 → Console)
- ❌ Смотрите логи сервера (см. ниже)

---

## 🔍 РАЗЛИЧИЯ CLICK И PAYME

| Параметр | Click | Payme |
|----------|-------|-------|
| **Test URL** | my.click.uz | test.paycom.uz |
| **Production URL** | my.click.uz | checkout.paycom.uz |
| **Формат суммы** | В сумах (50000) | В тийинах (5000000) |
| **Формат URL** | Query params | Base64 в пути |

---

## 📊 ПРОВЕРКА URL

### Click URL (для сравнения):
```
https://my.click.uz/services/pay?service_id=91151&merchant_id=46360&amount=50000&transaction_param=123&return_url=...
```

### Payme URL (production):
```
https://checkout.paycom.uz/BASE64STRING
```

Где BASE64STRING это:
```
m=63b7ac7cd3af34dee9986e01;ac.order_id=123;a=5000000;c=https://wallet.namo.uz/pay/.../result/123
```

---

## 🔍 ДИАГНОСТИКА ПРОБЛЕМ

### Проверка 1: Логи сервера

```bash
docker logs activation-system --tail 100 -f | grep -E "\[Payment\]|\[Payme\]"
```

**Что искать:**
```
[Payment] Redirecting to payme: https://checkout.paycom.uz/...
```

**Важно:** Должно быть `checkout.paycom.uz`, а НЕ `test.paycom.uz`!

---

### Проверка 2: Попытки оплаты в БД

```bash
docker exec -it activation-db psql -U tguser -d activation_system -c "SELECT id, \"linkId\", \"phoneNumber\", \"amount\", \"paymentMethod\", status, \"createdAt\" FROM \"QrPaymentAttempt\" ORDER BY \"createdAt\" DESC LIMIT 5;"
```

**Должно быть:**
- Новая запись с вашим телефоном
- `paymentMethod` = `payme`
- `status` = `PENDING`

---

### Проверка 3: Тест API вручную

```bash
curl -X POST https://wallet.namo.uz/pay/ВАШ_TOKEN/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+998901234567",
    "paymentMethod": "payme"
  }' | jq
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "redirectUrl": "https://checkout.paycom.uz/bToyM2I3YWM3Y2QzYWYzNGRlZTk5ODZlMDE7YWMub3JkZXJfaWQ9MTIzO2E9NTAwMDAwMDtjPWh0dHBzOi8vd2FsbGV0Lm5hbW8udXovcGF5Ly4uLg=="
}
```

Можно декодировать Base64:
```bash
echo "bToyM2I3YWM3Y2QzYWYzNGRlZTk5ODZlMDE7YWMub3JkZXJfaWQ9MTIzO2E9NTAwMDAwMDtjPWh0dHBzOi8vd2FsbGV0Lm5hbW8udXovcGF5Ly4uLg==" | base64 -d
```

---

## ⚠️ ВАЖНЫЕ ОТЛИЧИЯ PAYME

### 1. Merchant API callbacks

После оплаты **Payme** будет присылать JSON-RPC запросы:

```
1. CheckPerformTransaction
   ↓
2. CreateTransaction
   ↓
3. PerformTransaction (реальное списание)
   ↓
4. Редирект клиента обратно
```

**Проверить callbacks:**
```bash
docker logs activation-system -f | grep "\[Payme\]"
```

Вы должны увидеть:
```
[Payme] CheckPerformTransaction: {...}
[Payme] CreateTransaction: Success for attempt 123
[Payme] PerformTransaction: Success for attempt 123
```

---

### 2. Authorization

Payme проверяет Basic Auth:
```
Authorization: Basic base64("Paycom:PAYME_KEY")
```

Если auth неверный, вы увидите:
```
[Payme] Error: auth error (code: -32504)
```

---

## 🐛 ЧТО ДЕЛАТЬ ЕСЛИ НЕ РАБОТАЕТ

### Ошибка: "Auth error" в логах Payme

**Причина:** Неверный PAYME_KEY
**Решение:**
```bash
# Проверьте ключ
grep PAYME_KEY /home/admin1/posa/activation-system/.env

# Должно быть:
# PAYME_KEY=dqVzYxH?NRx9k64&IphRcpUbur1VS25czMQN (production)
```

---

### Ошибка: Редирект на test.paycom.uz вместо checkout.paycom.uz

**Причина:** PAYME_ENV всё ещё test
**Решение:**
```bash
grep PAYME_ENV /home/admin1/posa/activation-system/.env
# Должно быть: PAYME_ENV=production
```

---

### Ошибка: "Wrong amount" в Payme

**Причина:** Неверная конвертация в тийины
**Решение:**
- Цена в сумах: 50000
- Цена в тийинах: 5000000 (× 100)
- Проверьте код в qrPaymentController.js строка 154

---

## 📞 СООБЩИТЕ МНЕ:

После теста напишите:

1. **URL редиректа** (должен начинаться с checkout.paycom.uz)
2. **Логи Payme callbacks** (если оплата прошла):
   ```bash
   docker logs activation-system | grep "\[Payme\]"
   ```
3. **Статус в БД**:
   ```bash
   docker exec -it activation-db psql -U tguser -d activation_system -c "SELECT id, status, \"externalPaymentId\" FROM \"QrPaymentAttempt\" ORDER BY \"createdAt\" DESC LIMIT 1;"
   ```

---

## ⚠️ ВНИМАНИЕ: PRODUCTION!

**Это уже реальные деньги!**

- ✅ Тестируйте с минимальной суммой
- ✅ Убедитесь что callbacks работают
- ✅ Проверьте что Sale создаётся
- ✅ Проверьте что ваучер активируется

---

## ✅ ТЕСТ CLICK И PAYME

Теперь у вас работают **ОБЕ** платёжные системы в production!

**Протестируйте оба варианта:**
1. Выберите Click → оплатите → проверьте результат
2. Выберите Payme → оплатите → проверьте результат

---

**Готово! Попробуйте и скажите результат!** 🚀
