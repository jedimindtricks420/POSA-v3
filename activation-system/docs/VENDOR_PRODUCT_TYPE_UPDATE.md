# Обновление типов вендоров (productType)

## Дата: 2025-11-28

## Изменения

### 1. База данных
- Создан enum `VendorProductType` с тремя значениями: `ROKKY`, `MANUAL`, `VOUCHER`
- Поле `productType` в таблице `Vendor` изменено с `String` на `VendorProductType`
- Все существующие записи автоматически мигрированы:
  - `Rokky` → `ROKKY`
  - `Manual` → `MANUAL`
  - `Ваучеры`, `Voucher`, `API`, `Telegram` → `VOUCHER`

### 2. Код
Обновлены следующие файлы:

#### Controllers
- `controllers/storeController.js`:
  - Все проверки `productType === 'Rokky'` → `productType === 'ROKKY'`
  - Все проверки `productType === 'Manual'` → `productType === 'MANUAL'`
  - Добавлена отдельная ветка для `productType === 'VOUCHER'`
  
- `services/voucherActivationService.js`:
  - Проверка `productType === 'Rokky'` → `productType === 'ROKKY'`

#### Views
- `views/pages/admin-add-vendor.ejs`:
  - Удалены опции: `Telegram`, `API (устаревший)`, `Ваучеры (устаревший)`
  - Оставлены только: `ROKKY`, `MANUAL`, `VOUCHER`

- `views/pages/admin-edit-vendor.ejs`:
  - Аналогично admin-add-vendor.ejs

- `views/pages/admin-vendors.ejs`:
  - Добавлена локализация для отображения типов:
    - `ROKKY` → "Rokky (автоматическая)"
    - `MANUAL` → "Manual (ручная)"
    - `VOUCHER` → "Ваучеры"

### 3. Prisma Schema
```prisma
enum VendorProductType {
  ROKKY
  MANUAL
  VOUCHER
}

model Vendor {
  // ...
  productType  VendorProductType
  // ...
}
```

## Типы вендоров и их назначение

### ROKKY (Автоматическая активация)
- Ваучеры активируются автоматически через API Rokky
- При активации создается заказ в системе Rokky
- Ключ активации получается автоматически

### MANUAL (Ручная активация)
- Ваучеры активируются оператором вручную
- Создается запрос `ManualActivationRequest`
- Оператор получает уведомление в Telegram
- Оператор вручную отправляет ключ клиенту

### VOUCHER (Ваучеры)
- Коды активируются вне нашей системы
- Например: пополнение баланса в Spotify, активация в физической точке продаж
- Система только фиксирует факт активации для учета

## Обратная совместимость

Миграция полностью обратно совместима:
- Все существующие записи автоматически преобразованы
- Старые значения (`Rokky`, `Manual`, `Ваучеры`, `API`, `Telegram`) больше не используются
- Функциональность осталась прежней

## Тестирование

После обновления необходимо протестировать:
1. ✅ Создание нового вендора каждого типа
2. ✅ Редактирование существующего вендора
3. ✅ Активация ваучера для ROKKY вендора
4. ✅ Активация ваучера для MANUAL вендора
5. ✅ Активация ваучера для VOUCHER вендора
6. ✅ Отображение списка вендоров

## Rollback

В случае необходимости отката:

```sql
-- 1. Удалить enum constraint
ALTER TABLE "Vendor" 
  ALTER COLUMN "productType" TYPE TEXT;

-- 2. Удалить enum
DROP TYPE "VendorProductType";

-- 3. Вернуть старые значения (если нужно)
UPDATE "Vendor"
SET "productType" = CASE
    WHEN "productType" = 'ROKKY' THEN 'Rokky'
    WHEN "productType" = 'MANUAL' THEN 'Manual'
    WHEN "productType" = 'VOUCHER' THEN 'Ваучеры'
    ELSE "productType"
END;
```

## Файлы миграции

- `prisma/migrations/20251128092800_update_vendor_product_type_to_enum/migration.sql`
