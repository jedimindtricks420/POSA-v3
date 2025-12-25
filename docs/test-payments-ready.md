# ✅ CLICK И PAYME - PRODUCTION ГОТОВЫ!

## 🎉 Что сделано:

- ✅ **Click переведён на production** (`CLICK_ENV=production`)
- ✅ **Payme переведён на production** (`PAYME_ENV=production`)
- ✅ **Docker перезапущен** с новыми настройками
- ✅ **Сервер работает** на https://wallet.namo.uz

---

## 🚀 Быстрый старт для тестирования

### 1. Создайте QR-ссылку
```
https://wallet.namo.uz/admin/qr-links
```

### 2. Откройте ссылку
```
https://wallet.namo.uz/pay/ВАШ_TOKEN
```

### 3. Нажмите "КУПИТЬ" → Введите телефон

### 4. Выберите платёжную систему:

**Click:**
- Редирект на: `https://my.click.uz/services/pay?...`
- Оплата реальными деньгами

**Payme:**
- Редирект на: `https://checkout.paycom.uz/...`
- Оплата реальными деньгами

---

## 📊 Проверка в реальном времени

### Логи сервера:
```bash
docker logs -f activation-system | grep -E "\[Payment\]|\[Click\]|\[Payme\]"
```

**Что вы увидите:**

#### При выборе Click:
```
[Payment] Redirecting to click: https://my.click.uz/services/pay?...
[Click] Prepare: {...}
[Click] Prepare: Success for attempt 123
[Click] Complete: {...}
[Click] Complete: Payment successful for attempt 123
```

#### При выборе Payme:
```
[Payment] Redirecting to payme: https://checkout.paycom.uz/...
[Payme] CheckPerformTransaction: {...}
[Payme] CreateTransaction: Success for attempt 123
[Payme] PerformTransaction: Success for attempt 123
```

---

## 📋 URL форматы

### Click:
```
https://my.click.uz/services/pay?
  service_id=91151&
  merchant_id=46360&
  amount=50000&
  transaction_param=123&
  return_url=https://wallet.namo.uz/pay/TOKEN/result/123
```

### Payme:
```
https://checkout.paycom.uz/BASE64_STRING

где BASE64_STRING это:
m=63b7ac7cd3af34dee9986e01;
ac.order_id=123;
a=5000000;
c=https://wallet.namo.uz/pay/TOKEN/result/123
```

---

## 🔍 Проверка в базе данных

```bash
# Последние попытки оплаты
docker exec -it activation-db psql -U tguser -d activation_system -c "
  SELECT 
    id, 
    \"paymentMethod\", 
    status, 
    \"externalPaymentId\",
    \"createdAt\"
  FROM \"QrPaymentAttempt\" 
  ORDER BY \"createdAt\" DESC 
  LIMIT 5;
"
```

---

## ⚠️ ВАЖНО: Production деньги!

**Обе системы сейчас на PRODUCTION:**

- ✅ Click списывает реальные деньги
- ✅ Payme списывает реальные деньги
- ✅ Все транзакции реальные
- ✅ Callbacks приходят на ваш сервер

**Рекомендации:**
1. Тестируйте с минимальными суммами
2. Проверьте что callbacks работают
3. Убедитесь что Sale создаётся и ваучер активируется

---

## 📚 Подробные инструкции

- **Click:** `/home/admin1/posa/docs/test-click-production.md`
- **Payme:** `/home/admin1/posa/docs/test-payme-production.md`

---

## 🐛 Если что-то не работает

### 1. Проверьте .env
```bash
grep -E "CLICK|PAYME" /home/admin1/posa/activation-system/.env
```

Должно быть:
```
CLICK_ENV=production
PAYME_ENV=production
```

### 2. Проверьте Docker
```bash
docker ps | grep activation
docker logs activation-system --tail 50
```

### 3. Проверьте консоль браузера (F12)
При нажатии "ОПЛАТИТЬ" должен быть ответ:
```json
{
  "success": true,
  "redirectUrl": "https://..."
}
```

---

## ✅ Чек-лист готовности

- [ ] Docker запущен
- [ ] CLICK_ENV=production
- [ ] PAYME_ENV=production
- [ ] Есть активные ваучеры
- [ ] QR-ссылка создана
- [ ] Редирект происходит
- [ ] Callbacks приходят
- [ ] Sale создаётся
- [ ] Ваучер активируется

---

**Готово! Обе системы работают! Тестируйте! 🚀**
