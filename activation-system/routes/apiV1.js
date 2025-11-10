import express from 'express';
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

router.get('/wallet', (req, res) => {
  const today = new Date().toISOString().slice(0,10);
  res.json({ vouchers: [
    { id: 1, productName: 'Gift 100', value: 'TEST-100-AAAA', status: 'active',  assignedAt: today },
    { id: 2, productName: 'Gift 50',  value: 'TEST-050-BBBB', status: 'pending', assignedAt: today },
  ]});
});

router.get('/voucher/:id', (req, res) => {
  const id = Number(req.params.id)||0;
  const isOne = id === 1;
  const value = isOne ? 'TEST-100-AAAA' : 'TEST-050-BBBB';
  res.json({
    id,
    productName: isOne ? 'Gift 100' : 'Gift 50',
    value,
    displayValue: value,
    statusLabel: isOne ? 'Активен' : 'В ожидании',
    statusColor: isOne ? 'bg-green-400' : 'bg-yellow-400',
    qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`,
    barcodeDataUrl: '',
    terms: 'Условия ваучера…',
    lastSyncAt: new Date().toISOString(),
  });
});

router.post('/voucher/:id/events', (req, res) => {
  res.json({ ok: true });
});

export default router;
