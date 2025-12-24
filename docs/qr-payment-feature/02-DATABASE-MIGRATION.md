# Миграция базы данных

## Предварительные требования

- [ ] Бэкап базы данных создан
- [ ] Docker контейнер работает
- [ ] Доступ к Prisma CLI

---

## Шаг 1: Добавить новые модели в schema.prisma

**Файл:** `/home/admin1/posa/activation-system/prisma/schema.prisma`

### 1.1 Добавить в конец файла новые модели:

```prisma
// ========================================
// QR Payment Feature - Новые модели
// ========================================

model MerchantProductLink {
  id          Int       @id @default(autoincrement())
  merchantId  Int
  productId   Int
  token       String    @unique
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  
  merchant    Merchant  @relation(fields: [merchantId], references: [id])
  product     Product   @relation(fields: [productId], references: [id])
  
  paymentAttempts QrPaymentAttempt[]
  
  @@unique([merchantId, productId])
}

model QrPaymentAttempt {
  id                Int       @id @default(autoincrement())
  linkId            Int
  phoneNumber       String
  amount            Float
  paymentMethod     String?
  status            QrPaymentStatus @default(PENDING)
  externalPaymentId String?
  createdAt         DateTime  @default(now())
  expiresAt         DateTime
  paidAt            DateTime?
  saleId            Int?      @unique
  voucherValue      String?
  receiptPath       String?
  
  link              MerchantProductLink @relation(fields: [linkId], references: [id])
  sale              Sale?     @relation(fields: [saleId], references: [id])
}

enum QrPaymentStatus {
  PENDING
  PROCESSING
  PAID
  EXPIRED
  FAILED
}
```

### 1.2 Добавить связи в существующие модели:

**В модель `Merchant` (строка ~50):**
```prisma
model Merchant {
  id         Int     @id @default(autoincrement())
  username   String  @unique
  status     MerchantStatus @default(active)
  legalInfo  String
  balance    Float   @default(0)

  transactions VoucherTransaction[] @relation("MerchantToTransactions")
  payments     MerchantPayment[]    @relation("MerchantToPayments")
  productLinks MerchantProductLink[]  // ← ДОБАВИТЬ ЭТУ СТРОКУ
}
```

**В модель `Product` (строка ~75):**
```prisma
model Product {
  // ... существующие поля ...
  receiptTemplate String?
  merchantLinks MerchantProductLink[]  // ← ДОБАВИТЬ ЭТУ СТРОКУ
}
```

**В модель `Sale` (строка ~178):**
```prisma
model Sale {
  // ... существующие поля ...
  customerPhone    String?
  qrPaymentAttempt QrPaymentAttempt?  // ← ДОБАВИТЬ ЭТУ СТРОКУ
}
```

---

## Шаг 2: Создать миграцию

```bash
# Войти в контейнер (если Docker)
docker exec -it activation-system-backend-1 sh

# ИЛИ локально
cd /home/admin1/posa/activation-system

# Создать миграцию
npx prisma migrate dev --name add_qr_payment_feature

# Если production:
npx prisma migrate deploy
```

---

## Шаг 3: Сгенерировать Prisma Client

```bash
npx prisma generate
```

---

## Шаг 4: Проверить миграцию

```bash
# Проверить, что таблицы созданы
npx prisma studio

# ИЛИ через SQL
docker exec -it activation-system-db-1 psql -U postgres -d activation_db -c "\dt"
```

**Ожидаемые новые таблицы:**
- `MerchantProductLink`
- `QrPaymentAttempt`

---

## Откат (если нужно)

```bash
# Откатить последнюю миграцию
npx prisma migrate reset --skip-seed

# ИЛИ вручную через SQL
DROP TABLE IF EXISTS "QrPaymentAttempt";
DROP TABLE IF EXISTS "MerchantProductLink";
DROP TYPE IF EXISTS "QrPaymentStatus";
```

---

## Чеклист

- [ ] Бэкап создан
- [ ] schema.prisma обновлена
- [ ] Миграция создана
- [ ] Prisma Client сгенерирован
- [ ] Таблицы созданы в БД
- [ ] Приложение перезапущено
