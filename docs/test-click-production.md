# 🧪 ИНСТРУКЦИЯ ПО ТЕСТИРОВАНИЮ CLICK (PRODUCTION)

## ✅ Подготовка завершена!

- ✅ Docker перезапущен
- ✅ Click переведён на production (`CLICK_ENV=production`)
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
- Два варианта: Click и Payme (Click выбран по умолчанию)
- Кнопка "ОПЛАТИТЬ X сум"

---

### Шаг 4: Введите данные

1. Номер телефона: `901234567` (9 цифр БЕЗ +998)
2. Убедитесь что выбран **Click**
3. Нажмите "ОПЛАТИТЬ"

---

### Шаг 5: Откройте консоль браузера (F12)

**Перед нажатием "ОПЛАТИТЬ":**

1. Нажмите F12
2. Вкладка "Console"
3. Нажмите "ОПЛАТИТЬ"

**Что должно быть в консоли:**
```
POST https://wallet.namo.uz/pay/abc123xyz/checkout
Status: 200
Response: {
  "success": true,
  "redirectUrl": "https://my.click.uz/services/pay?..."
}
```

---

### Шаг 6: Проверьте что происходит

**Если редирект происходит:**
- ✅ Вы попадёте на my.click.uz
- Там будет форма оплаты
- Введите карту для тестирования

**Если редирект НЕ происходит:**
- ❌ Смотрите консоль браузера (F12 → Console)
- ❌ Смотрите логи сервера (см. ниже)

---

## 🔍 ДИАГНОСТИКА ПРОБЛЕМ

### Проверка 1: Логи сервера

```bash
docker logs activation-system --tail 100 -f
```

**Что искать:**
```
[Payment] Redirecting to click: https://my.click.uz/services/pay?...
```

---

### Проверка 2: Попытки оплаты в БД

```bash
docker exec -it activation-db psql -U tguser -d activation_system -c "SELECT id, \"linkId\", \"phoneNumber\", \"amount\", \"paymentMethod\", status, \"createdAt\" FROM \"QrPaymentAttempt\" ORDER BY \"createdAt\" DESC LIMIT 5;"
```

**Должно быть:**
- Новая запись с вашим телефоном
- `paymentMethod` = `click`
- `status` = `PENDING`

---

### Проверка 3: Тест API вручную

```bash
curl -X POST https://wallet.namo.uz/pay/ВАSH_TOKEN/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+998901234567",
    "paymentMethod": "click"
  }' | jq
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "redirectUrl": "https://my.click.uz/services/pay?service_id=91151&merchant_id=46360&amount=50000&transaction_param=123&return_url=https://wallet.namo.uz/pay/..."
}
```

---

## 🐛 ЧТО ДЕЛАТЬ ЕСЛИ НЕ РАБОТАЕТ

### Ошибка: "Ссылка не найдена"

**Причина:** Неверный token
**Решение:** Убедитесь что используете правильный token из админки

---

### Ошибка: "Некорректный номер телефона"

**Причина:** Неправильный формат
**Решение:** Вводите ровно 9 цифр (без +998)

---

### Ошибка: JavaScript не выполняется

**Причина:** Ошибка в JS или не загрузился
**Решение:** 
1. F12 → Console
2. Проверьте ошибки
3. Проверьте что файл `/pay/:token/checkout` загружается

---

### Редирект не происходит, но в консоли success: true

**Причина:** JavaScript не выполнил `window.location.href`
**Решение:**
1. Проверьте консоль на ошибки
2. Попробуйте в другом браузере

---

## 📞 СООБЩИТЕ МНЕ:

После теста напишите:

1. **Что видите в консоли браузера** (F12 → Console)
2. **URL на который вас редиректит** (если редиректит)
3. **Ошибки из логов** (если есть):
   ```bash
   docker logs activation-system --tail 50
   ```
4. **Данные из БД** (последняя попытка):
   ```bash
   docker exec -it activation-db psql -U tguser -d activation_system -c "SELECT * FROM \"QrPaymentAttempt\" ORDER BY \"createdAt\" DESC LIMIT 1;"
   ```

---

## ✅ ГОТОВО!

Сейчас попробуйте и скажите что получается! 🚀
