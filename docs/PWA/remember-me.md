# PWA «Запомнить меня» / Auto Logout – План внедрения

Этот документ описывает, как добавить в проект функциональность «Запомнить меня» с 30‑дневным refresh‑токеном и автоматическим выходом через 15 минут бездействия, если флажок «Запомнить меня» не установлен.  
Стэк проекта: Node.js 20, Express, EJS, PWA (Service Worker), Prisma.

## 0. Подготовка

1. Создайте ветку Git:  
   ```bash
   git checkout -b feature/remember-me
   ```
2. Проверьте, что `.env` содержит `SESSION_SECRET`.
3. Убедитесь, что Prisma миграции работают (`npx prisma migrate status`).

## 1. Модель RefreshToken в Prisma

1. Откройте `prisma/schema.prisma` и добавьте модель (пример):
   ```prisma
   model RefreshToken {
     id        Int      @id @default(autoincrement())
     userId    Int
     role      String   // 'client' | 'merchant' | 'admin' ...
     token     String   @unique
     expiresAt DateTime
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     Client    Client?  @relation(fields: [userId], references: [id])
     // при необходимости добавить отношения для других ролей
   }
   ```
2. Примените миграцию:
   ```bash
   npx prisma migrate dev --name add-refresh-token
   ```

## 2. Настройка express-session

В `index.js` (инициализация Express):

```js
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 15 * 60 * 1000, // 15 минут
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));
```

Добавьте middleware, чтобы при активности продлевать cookie:

```js
app.use((req, res, next) => {
  if (req.session?.user || req.session?.client) {
    req.session.cookie.maxAge = 15 * 60 * 1000;
  }
  next();
});
```

## 3. UI: чекбокс «Запомнить меня»

1. Обновите формы логина:
   - `views/pages/client-login.ejs`
   - `views/pages/login.ejs` (админ/мерчант)
2. Добавьте в формы:
   ```html
   <input type="hidden" name="rememberMe" value="0" />
   <label class="flex items-center gap-2 text-sm text-slate-600">
     <input type="checkbox" name="rememberMe" value="1" />
     Запомнить меня
   </label>
   ```
   Hidden-поле гарантирует передачу `rememberMe=0`, если чекбокс не выбран.

## 4. Генерация Refresh токена при логине

### 4.1. Общий подход

В `controllers/authController.js` (админ/мерчант/вендор) и `controllers/client/authController.js` (клиент):

1. После успешной аутентификации:
   ```js
   import crypto from 'crypto';
   import prisma from '../../prisma/client.js';

    // ...
    const rememberMe = Boolean(req.body.rememberMe);

    const sessionMaxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 дней
      : 15 * 60 * 1000;          // 15 минут

    req.session.cookie.maxAge = sessionMaxAge;

    if (rememberMe) {
      const refreshToken = crypto.randomBytes(40).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.upsert({
        where: { userId_role: { userId: user.id, role: user.role }},
        update: { token: refreshToken, expiresAt },
        create: { userId: user.id, role: user.role, token: refreshToken, expiresAt },
      });
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      res.cookie('remember_me', '1', { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    } else {
      res.clearCookie('refresh_token');
      res.clearCookie('remember_me');
    }
   ```

2. Храните в `req.session.user` / `req.session.client` минимальный набор (id, role, phone). При rememberMe сервер будет продлевать сессию через refresh.

## 5. REST маршрут для refresh

Создайте `/auth/refresh` (и при необходимости `/client/refresh`):

```js
// routes/authRoutes.js
router.post('/refresh', authController.refreshSession);
```

```js
// controllers/authController.js
export const refreshSession = async (req, res) => {
  try {
    const token = req.cookies.refresh_token;
    if (!token) return res.status(401).json({ ok: false, message: 'No token' });

    const record = await prisma.refreshToken.findUnique({ where: { token }});
    if (!record || record.expiresAt < new Date()) {
      if (record) {
        await prisma.refreshToken.delete({ where: { token }});
      }
      res.clearCookie('refresh_token');
      res.clearCookie('remember_me');
      return res.status(401).json({ ok: false, message: 'Expired' });
    }

    // Продлеваем cookie express-session на 15 минут
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ ok: false });
      req.session.user = { id: record.userId, role: record.role };
      req.session.cookie.maxAge = 15 * 60 * 1000;

      // Опционально rotate refresh token
      const newToken = crypto.randomBytes(40).toString('hex');
      const newExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      prisma.refreshToken.update({
        where: { token },
        data: { token: newToken, expiresAt: newExpires },
      }).catch(() => {});

      res.cookie('refresh_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({ ok: true });
    });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
};
```

> Примечание: для клиента (`client/authController.js`) реализация аналогична, но с `req.session.client` и выборкой `Client`.

## 6. Logout

Обновите logout-хэндлеры (`controllers/authController.js` и `controllers/client/authController.js`):

```js
export const logout = (req, res) => {
  const token = req.cookies.refresh_token;
  if (token) {
    prisma.refreshToken.delete({ where: { token }}).catch(() => {});
  }
  res.clearCookie('refresh_token');
  res.clearCookie('remember_me');

  req.session.destroy(() => {
    res.redirect('/auth/login'); // или '/wallet'
  });
};
```

## 7. Клиентская интеграция (PWA)

### 7.1. Подключение общего скрипта

1. Создайте `public/js/client-session.js`.
2. Включите `<script type="module" src="/js/client-session.js"></script>` во всех клиентских страницах:
   - `views/pages/client-login.ejs`
   - `views/pages/client-verify.ejs`
   - `views/pages/client-register.ejs`
   - `views/pages/client-dashboard.ejs`
   - `views/pages/client-profile.ejs`
   - `views/pages/client-qr-scanner.ejs`

### 7.2. Содержимое `client-session.js`

```js
const REFRESH_ENDPOINT = '/client/refresh';
const LOGOUT_URL = '/client/logout';
const LOGIN_URL = '/wallet';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 минут
const IDLE_TIMEOUT = 15 * 60 * 1000;    // 15 минут

const hasRememberMe = document.cookie.includes('remember_me=1');

async function refreshSession() {
  if (!hasRememberMe) return;
  try {
    const res = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      window.location.href = LOGIN_URL;
    }
  } catch (error) {
    console.warn('Refresh failed', error);
  }
}

let idleTimer = null;

function resetIdleTimer() {
  if (hasRememberMe) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    window.location.href = LOGOUT_URL;
  }, IDLE_TIMEOUT);
}

['click', 'mousemove', 'keydown', 'touchstart'].forEach((evt) => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});
resetIdleTimer();

if (hasRememberMe) {
  setInterval(refreshSession, REFRESH_INTERVAL);
  refreshSession();
}

window.addEventListener('offline', () => console.log('offline - refresh suspended'));
window.addEventListener('online', () => hasRememberMe && refreshSession());
```

### 7.3. Поведение

- Если пользователь не выбрал remember me: любой период бездействия 15 минут → redirect на `/client/logout`.
- Если remember me включён: каждые 5 минут отправляется `/client/refresh`; при ошибке (`401`) — redirect на `/wallet`.
- Страницы должны обрабатывать `401` от API и также отправлять на логин.
- Для административной части (страницы `views/pages/login.ejs` и связанные layout’ы) создайте зеркальный скрипт `public/js/admin-session.js` с той же логикой refresh/idle и подключите его в админский layout (`views/partials/admin-navbar.ejs` или общий layout).

## 8. Безопасность

- Используйте `httpOnly`, `secure`, `sameSite` для всех cookie; в продакшене добавьте `app.set('trust proxy', 1)`.
- В `RefreshToken` добавьте уникальный индекс `@@unique([userId, role])`, чтобы `upsert` работал корректно.
- Ротируйте токены при refresh, очищайте просроченные (крон задача).
- При смене пароля/выходе со всех устройств — удаляйте токены пользователя.
- Ограничьте количество активных токенов (например, 1–3 на пользователя).

## 9. Тестирование

1. **Backend**
   - Логин с `rememberMe=true` → refresh токен создаётся, cookie выставляется.
   - Логин без remember → после 15 минут бездействия сессия исчезает.
   - `/auth/refresh` и `/client/refresh` возвращают `200` и продлевают сессию.
2. **Frontend/PWA**
   - Проверить auto logout без remember (таймер idle).
   - С remember — спустя 30 минут/несколько часов refresh продолжает поддерживать сессию.
   - Офлайн → онлайн: refresh без ошибок; если токен просрочен — redirect на `/wallet`.

## 10. Деплой и мониторинг

1. Чек-лист:
   - `npx prisma migrate deploy`.
   - `.env`: `SESSION_SECRET`, `DATABASE_URL` установлены.
   - Logout очищает refresh токены.
   - trust proxy настроен (если используется HTTPS через прокси).
2. Мониторинг:
   - Логи `/auth/refresh` и `/client/refresh` (успех/ошибка).
   - Cron для удаления `expiresAt < now()`.

## 11. Финал

После внедрения:

- Пользователи с «Запомнить меня» остаются в системе 30 дней (refresh).
- Обычные пользователи выходят через 15 минут неактивности.
- Logout очищает всё.
- PWA и будущая упаковка в APK/IPA работают корректно за счёт cookie и refresh API.

## 12. Чек-лист разработчика

- [ ] Добавлена модель `RefreshToken` и применена миграция.
- [ ] Формы логина (`client-login.ejs`, `login.ejs`) содержат чекбокс + hidden `rememberMe`.
- [ ] Контроллеры логина/выхода обновлены, refresh токены выдаются/очищаются.
- [ ] Реализованы маршруты `/auth/refresh` и `/client/refresh`.
- [ ] Создан и подключён `public/js/client-session.js` (refresh + idle). 
- [ ] (Опционально) создан `public/js/admin-session.js` с аналогичной логикой.
- [ ] PWA протестирована: remember me / auto logout / offline.
- [ ] Trust proxy (`app.set('trust proxy', 1)`) и cookie флаги настроены.
- [ ] Настроено удаление просроченных refresh токенов (крон/скрипт).
