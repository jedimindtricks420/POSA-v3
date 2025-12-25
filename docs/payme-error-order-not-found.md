# ⚠️ ОШИБКА PAYME: "Номер заказа не найден"

## 🔴 Проблема:

При переходе на Payme вы видите: **"Номер заказа не найден"**

URL был:
```
https://checkout.paycom.uz/bT02M2I3YWM3Y2QzYWYzNGRlZTk5ODZlMDE7YWMub3JkZXJfaWQ9MTI7YT01MDAwMDA7Yz1odHRwcyUzQSUyRiUyRndhbGxldC5uYW1vLnV6JTJGcGF5JTJGYjYxNmQ4OWQtYWJkNy00NDZhLTkxMTQtZjNiMWRjNzc5OTliJTJGcmVzdWx0JTJGMTI=
```

Декодировано:
```
m=63b7ac7cd3af34dee9986e01;
ac.order_id=12;
a=500000;
c=https://wallet.namo.uz/pay/.../result/12  
```

---

## ✅ ЧТО РАБОТАЕТ:

1. ✅ Редирект на Payme происходит
2. ✅ URL генерируется правильно
3. ✅ QrPaymentAttempt создан в базе (id=12)
4. ✅ Сумма правильная (5000 сум = 500000 тийин)

---

## ❌ ЧТО НЕ РАБОТАЕТ:

**Payme НЕ МОЖЕТ найти заказ** потому что:

### Причина: Не настроен Merchant API endpoint в личном кабинете Payme!

Payme Merchant API работает так:
1. Клиент открывает checkout.paycom.uz
2. **Payme СРАЗУ отправляет запрос на ваш сервер** (CheckPerformTransaction)
3. Ваш сервер отвечает "allow: true"
4. Только ТОГДА Payme показывает форму оплаты

**Сейчас:** Payme НЕ может связаться с вашим сервером → показывает ошибку

---

## 🔧 РЕШЕНИЕ:

### 1. Настройте Merchant API endpoint в личном кабинете Payme

Зайдите в личный кабинет Payme:
```
https://cabinet.paycom.uz
```

**Найдите раздел:**
- "Настройки"
- "Merchant API" или "JSON-RPC endpoint"
- "URL для проверки заказов"

**Укажите URL:**
```
https://wallet.namo.uz/api/payments/payme
```

**ВАЖНО:**
- URL должен быть доступен по HTTPS
- Должен принимать POST запросы
- Должен возвращать JSON

---

### 2. Проверьте что endpoint доступен

```bash
curl -I https://wallet.namo.uz/api/payments/payme
```

**Должно быть:**
```
HTTP/2 200  # НЕ 404!
```

---

### 3. Протестируйте вручную

```bash
curl -X POST https://wallet.namo.uz/api/payments/payme \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'Paycom:ВАSH_KEY' | base64)" \
  -d '{
    "method": "CheckPerformTransaction",
    "params": {
      "amount": 500000,
      "account": {"order_id": "12"}
    },
    "id": 1
  }'
```

**Ожидаемый ответ:**
```json
{
  "result": {
    "allow": true
  },
  "id": 1
}
```

---

## 📋 ЧТО НУЖНО НАСТРОИТЬ В PAYME КАБИНЕТЕ:

### Обязательные поля:

| Поле | Значение |
|------|----------|
| **Merchant API URL** | `https://wallet.namo.uz/api/payments/payme` |
| **Тип оплаты** | "Прием электронных платёжей с биллингом" |
| **Метод авторизации** | Basic Auth |
| **Login** | `Paycom` |
| **Key** | `dqVzYxH?NRx9k64&IphRcpUbur1VS25czMQN` (production) |

---

### Дополнительные настройки:

#### Поля заказа (account):
```json
{
  "order_id": {
    "type": "string",
    "required": true
  }
}
```

#### Return URL (опционально):
```
https://wallet.namo.uz/pay/{transaction_param}/result/{id}
```

---

## 🔍 ПРОВЕРКА ПОСЛЕ НАСТРОЙКИ:

### 1. Payme должен отправить тестовый запрос

После сохранения настроек Payme автоматически отправит:
```
CheckPerformTransaction
```

**Посмотрите логи:**
```bash
docker logs -f activation-system | grep "\[Payme\]"
```

Должно появиться:
```
[Payme] CheckPerformTransaction: {"amount":500000,"account":{"order_id":"12"}}
```

---

### 2. Попробуйте снова оплатить

После настройки:
1. Создайте новую попытку оплаты
2. Выберите Payme
3. Нажмите "ОПЛАТИТЬ"

**Теперь должно работать!**

---

## 🐛 ЕСЛИ ВСЁ ЕЩЁ НЕ РАБОТАЕТ:

### Проверка 1: Firewall/nginx

Убедитесь что nginx проксирует `/api/payments/payme`:

```bash
# Проверьте конфиг nginx
cat /etc/nginx/sites-enabled/default | grep -A 10 "location /api"
```

Должно быть:
```nginx
location /api {
    proxy_pass http://localhost:4000;
    ...
}
```

---

### Проверка 2: Docker logs

```bash
docker logs activation-system --tail 50 | grep -E "listening|error"
```

Сервер должен слушать на порту 4000.

---

### Проверка 3: Тест локально

Внутри контейнера:
```bash
docker exec -it activation-system curl -X POST http://localhost:4000/api/payments/payme \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'Paycom:test' | base64)" \
  -d '{"method":"CheckPerformTransaction","params":{"amount":500000,"account":{"order_id":"12"}},"id":1}'
```

---

## ✅ КОРОТКО:

1. **Настройте Merchant API endpoint в Payme кабинете**
   - URL: `https://wallet.namo.uz/api/payments/payme`
   
2. **Проверьте что endpoint доступен**
   - `curl -I https://wallet.namo.uz/api/payments/payme` → 200 OK

3. **Попробуйте снова**

---

**Настройте Payme и попробуйте снова!** 🚀
