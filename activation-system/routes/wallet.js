import fs from 'fs';
import path from 'path';
import express from 'express';
import { PKPass } from 'passkit-generator';
import prisma from '../prisma/client.js';
import { buildVoucherSmartUrl, extractVoucherCode, parseVoucherToken } from '../utils/qr.js';

const router = express.Router();

/** ——— helpers ——— */
function mustEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing required env: ${name}`);
  return v;
}
function mustFile(p) {
  if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`);
  return p;
}
function readPem(p) {
  return fs.readFileSync(p, 'utf8');
}

/** ——— static config (загружаем один раз при старте) ——— */
const MODEL_DIR = mustFile(
  path.resolve(process.cwd(), 'passModels', 'storeCard.pass')
);

const WWDR_PATH        = mustFile(mustEnv('APPLE_WWDR_CERT_PATH'));
const SIGNER_CERT_PATH = mustFile(mustEnv('APPLE_WALLET_SIGNER_CERT_PATH'));
const SIGNER_KEY_PATH  = mustFile(mustEnv('APPLE_WALLET_SIGNER_KEY_PATH'));
const SIGNER_KEY_PW    = mustEnv('PASS_KEY_PASSWORD'); // v3 требует НЕпустой passphrase

const CERTS = {
  wwdr:       readPem(WWDR_PATH),
  signerCert: readPem(SIGNER_CERT_PATH),
  signerKey:  readPem(SIGNER_KEY_PATH),
  signerKeyPassphrase: SIGNER_KEY_PW
};

const PASS_TYPE_ID = mustEnv('PASS_TYPE_ID');
const TEAM_ID      = mustEnv('TEAM_ID');
const ORG_NAME     = mustEnv('ORG_NAME');
const WS_URL       = process.env.WALLET_WEB_SERVICE_URL && String(process.env.WALLET_WEB_SERVICE_URL).trim();

/** ——— .pkpass генератор ——— */
router.get('/wallet/:serial.pkpass', async (req, res) => {
  try {
    const serial = req.params.serial;

    const dbVoucher = await prisma.voucher.findFirst({
      where: { value: serial },
      include: { product: true },
    });
    if (!dbVoucher) {
      return res.status(404).send('Voucher not found');
    }
    if (['deleted', 'used'].includes(dbVoucher.status)) {
      return res.status(410).send('Voucher not available');
    }

    const onlineLink = await prisma.onlineVoucher.findFirst({
      where: { voucherId: dbVoucher.id },
    });

    const amountNumber = Number(dbVoucher.product?.price ?? NaN);
    const amountLabel = Number.isFinite(amountNumber) && amountNumber > 0
      ? `${amountNumber.toLocaleString('ru-RU')} сум`
      : dbVoucher.product?.name || dbVoucher.productName || 'Ваучер';

    const voucher = {
      serial,
      amountLabel,
      status: dbVoucher.status,
    };

    // базовый origin для построения QR-ссылки внутри пасса
    const origin = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const activationUrl = buildVoucherSmartUrl({ serial: voucher.serial, origin });

    // overrides → попадают в конечный pass.json
    const overrides = {
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      organizationName: ORG_NAME,
      serialNumber: voucher.serial,

      // включай, когда поднимешь Wallet Web Service + токены в БД
      ...(WS_URL && dbVoucher.authToken ? {
        webServiceURL: WS_URL,
        authenticationToken: dbVoucher.authToken
      } : {}),

      // QR в самом .pkpass указывает на «умную» ссылку /activate?voucher=...
      barcodes: [
        {
          format: 'PKBarcodeFormatQR',
          message: activationUrl,
          messageEncoding: 'iso-8859-1'
        }
      ]
    };

    const pass = await PKPass.from(
      { model: MODEL_DIR, certificates: CERTS },
      overrides
    );

    const replaceFields = (fields, next = []) => {
      fields.splice(0, fields.length); // очистить шаблонные значения
      if (next.length) {
        fields.push(...next);
      }
    };

    replaceFields(pass.primaryFields, [
      { key: 'balance', label: 'Баланс', value: voucher.amountLabel }
    ]);
    replaceFields(pass.secondaryFields, [
      { key: 'code', label: 'Код ваучера', value: voucher.serial }
    ]);
    replaceFields(pass.auxiliaryFields, [
      { key: 'status', label: 'Статус', value: voucher.status }
    ]);

    if (onlineLink?.clientId) {
      try {
        await prisma.voucherWalletLog.create({
          data: {
            voucherId: dbVoucher.id,
            clientId: onlineLink.clientId,
            isAddedToWallet: true,
            pkpassId: 'voucher.apple_wallet',
            deviceInfo: 'ios',
          },
        });
      } catch (logError) {
        console.warn('VoucherWalletLog insert failed', logError);
      }
    }

    const buf = await pass.getAsBuffer();

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="${serial}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buf);
  } catch (err) {
    console.error('PKPass error:', err);
    return res.status(500).send('Pass generation error');
  }
});

/** ——— Smart redirect: iOS → pkpass, остальные → форма ввода кода ——— */
router.get('/activate', (req, res, next) => {
  const raw = req.query.voucher || req.query.code || req.query.payload || '';
  const code = extractVoucherCode(raw);
  if (!code) return next();

  const ua = req.headers['user-agent'] || '';
  const isIPhone = /iPhone|iPod/i.test(ua); // только iPhone/iPod
  if (isIPhone) {
    return res.redirect(302, `/wallet/${encodeURIComponent(code)}.pkpass`);
  }
  const enterUrl = process.env.CLIENT_ENTER_URL || '/client/enter-voucher';
  return res.redirect(302, `${enterUrl}?serial=${encodeURIComponent(code)}`);
});

/** ——— Smart-QR по токену (опционально; нужен parseVoucherToken в utils/qr.js) ——— */
router.get('/qr/:token', (req, res) => {
  try {
    const payload = parseVoucherToken?.(req.params.token);
    if (!payload) return res.status(400).send('Bad or expired token');

    const serial = payload.s || payload.voucher || payload.code;
    if (!serial) return res.status(400).send('Token payload has no serial');

    const ua = req.headers['user-agent'] || '';
    const isiOS = /iPhone|iPad|iPod/i.test(ua);
    if (isiOS) {
      return res.redirect(302, `/wallet/${encodeURIComponent(serial)}.pkpass`);
    }
    const clientUrl = process.env.CLIENT_ENTER_URL || '/client/enter-voucher';
    return res.redirect(302, `${clientUrl}?serial=${encodeURIComponent(serial)}`);
  } catch (e) {
    return res.status(400).send('Invalid QR token');
  }
});

export default router;
