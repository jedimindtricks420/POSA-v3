// Отдельная точка входа для партнёрского канала: тот же код и та же БД,
// но наружу открыты ТОЛЬКО роуты UWS. Разворачивается своим контейнером,
// чтобы поток из терминалов не делил процесс с кошельком.
import express from 'express';
import dotenv from 'dotenv';
import uwsRoutes from './routes/uwsRoutes.js';

dotenv.config();
const app = express();
const PORT = process.env.UWS_PORT || process.env.PORT || 4600;

app.set('trust proxy', 1);

// Невалидный JSON должен давать -32700, а не падение express.json().
app.use(express.json({
  limit: '256kb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError) {
    return res.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Ошибка парсинга JSON' } });
  }
  return next(err);
});

app.get('/healthz', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/', uwsRoutes);

// Внутри контейнера слушаем 0.0.0.0, иначе проброс порта до процесса не дойдёт.
// Изоляция обеспечивается привязкой опубликованного порта к 127.0.0.1 на хосте
// и allowlist'ом IP партнёра в nginx.
const HOST = process.env.UWS_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`UWS partner gateway listening on ${HOST}:${PORT}`);
  console.log(`endpoint: POST http://127.0.0.1:${PORT}/api/payments/uws/paynet`);
});
