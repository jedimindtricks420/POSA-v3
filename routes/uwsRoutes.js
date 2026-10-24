import express from 'express';
import { makeUwsHandler } from '../controllers/payment/uwsController.js';
import { PAYNET_ERRORS } from '../utils/payment/paynetErrors.js';

const router = express.Router();
const PARTNERS = { paynet: 'PAYNET' };

router.all('/api/payments/uws/:partner', async (req, res) => {
  const partner = PARTNERS[String(req.params.partner).toLowerCase()];
  if (!partner) return res.status(404).json({ error: 'unknown partner' });

  // §2.5: запрос не методом POST — ошибка -32300.
  if (req.method !== 'POST') {
    return res.json({ jsonrpc: '2.0', id: null, error: PAYNET_ERRORS.NOT_POST });
  }
  return makeUwsHandler({ partner })(req, res);
});

export default router;
