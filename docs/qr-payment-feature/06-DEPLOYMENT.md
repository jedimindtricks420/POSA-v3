# Деплой инструкция

## Предварительные требования

- [ ] Все тесты пройдены локально
- [ ] Код отревьюен
- [ ] Бэкап production БД создан

---

## 1. Подготовка

### 1.1 Проверить окружение

```bash
# Проверить версии
node -v  # >= 18
npm -v   # >= 9

# Проверить переменные окружения
echo $DATABASE_URL
echo $BASE_URL
```

### 1.2 Создать бэкап БД

```bash
# Если Docker
docker exec activation-system-db-1 pg_dump -U postgres activation_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Если локальный PostgreSQL
pg_dump -U postgres activation_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 2. Деплой кода

### 2.1 Получить изменения

```bash
cd /home/admin1/posa/activation-system

# Сохранить локальные изменения (если есть)
git stash

# Получить последнюю версию
git pull origin main

# Вернуть локальные изменения (если были)
git stash pop
```

### 2.2 Установить зависимости

```bash
npm install
```

### 2.3 Проверить новые зависимости

Если добавлены новые пакеты:
```bash
npm install uuid qrcode  # Если ещё не установлены
```

---

## 3. Миграция БД

### 3.1 Проверить схему

```bash
# Показать pending миграции
npx prisma migrate status
```

### 3.2 Применить миграцию

```bash
# Development (создаёт миграцию если нужно)
npx prisma migrate dev --name add_qr_payment_feature

# Production (только применяет существующие)
npx prisma migrate deploy
```

### 3.3 Сгенерировать клиент

```bash
npx prisma generate
```

### 3.4 Проверить

```bash
npx prisma studio  # Открыть в браузере и проверить таблицы
```

---

## 4. Перезапуск приложения

### Docker

```bash
# Пересобрать и перезапустить
docker-compose down
docker-compose up -d --build

# Проверить логи
docker-compose logs -f backend
```

### PM2

```bash
# Перезапустить
pm2 restart activation-system

# Проверить статус
pm2 status

# Проверить логи
pm2 logs activation-system
```

### Systemd

```bash
sudo systemctl restart activation-system
sudo systemctl status activation-system
journalctl -u activation-system -f
```

---

## 5. Проверка после деплоя

### 5.1 Health check

```bash
curl http://localhost:3000/health  # или ваш порт
```

### 5.2 Проверить новые страницы

```bash
# Админ-панель
curl -I http://localhost:3000/admin/qr-links

# Публичная страница (с тестовым токеном)
curl -I http://localhost:3000/pay/test-token
```

### 5.3 Быстрый smoke test

1. Войти в админку
2. Открыть `/admin/qr-links`
3. Сгенерировать тестовую ссылку
4. Открыть ссылку в браузере
5. Пройти весь флоу до чека

---

## 6. Мониторинг

### Логи ошибок

```bash
# Docker
docker-compose logs -f backend | grep -i error

# PM2
pm2 logs activation-system --err

# Файлы логов (если настроено)
tail -f /var/log/activation-system/error.log
```

### Метрики БД

```sql
-- Количество созданных ссылок
SELECT COUNT(*) FROM "MerchantProductLink";

-- Количество попыток оплаты
SELECT status, COUNT(*) FROM "QrPaymentAttempt" GROUP BY status;

-- Сегодняшние продажи через QR
SELECT COUNT(*) FROM "QrPaymentAttempt" 
WHERE status = 'PAID' AND DATE("paidAt") = CURRENT_DATE;
```

---

## 7. Откат (если нужно)

### 7.1 Откат кода

```bash
git log --oneline -5  # Найти предыдущий коммит
git checkout <commit_hash>
npm install
pm2 restart activation-system
```

### 7.2 Откат БД

```bash
# Восстановить из бэкапа
psql -U postgres activation_db < backup_YYYYMMDD_HHMMSS.sql

# ИЛИ откатить миграцию (осторожно!)
npx prisma migrate reset --skip-seed
```

---

## 8. Чеклист деплоя

### До деплоя
- [ ] Бэкап БД создан
- [ ] Тесты пройдены локально
- [ ] Код отревьюен

### Деплой
- [ ] Код обновлён
- [ ] Зависимости установлены
- [ ] Миграция применена
- [ ] Prisma Client сгенерирован
- [ ] Приложение перезапущено

### После деплоя
- [ ] Health check OK
- [ ] Админ-панель работает
- [ ] Клиентский флоу работает
- [ ] Логи без ошибок
- [ ] Команда уведомлена

---

## Контакты

В случае проблем:
- DevOps: [контакт]
- Backend Lead: [контакт]
- On-call: [контакт]
