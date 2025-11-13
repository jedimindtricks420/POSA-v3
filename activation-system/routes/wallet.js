import fs from 'fs';
import path from 'path';
import express from 'express';
import { PKPass } from 'passkit-generator';

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

const WWDR_PATH       = mustFile(mustEnv('APPLE_WWDR_CERT_PATH'));
const SIGNER_CERT_PATH= mustFile(mustEnv('APPLE_WALLET_SIGNER_CERT_PATH'));
const SIGNER_KEY_PATH = mustFile(mustEnv('APPLE_WALLET_SIGNER_KEY_PATH'));
const SIGNER_KEY_PW   = mustEnv('PASS_KEY_PASSWORD'); // v3 требует НЕпустой passphrase

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

/** ——— основной эндпоинт ——— */
router.get('/wallet/:serial.pkpass', async (req, res) => {
  try {
    const serial = req.params.serial;

    // TODO: подтягивай реальные данные из БД
    // Пример «заглушки»
    const voucher = {
      serial,
      amount: 100000,
      status: 'Active',
      authToken: 'TEMP_AUTH_TOKEN_32_CHARS'
    };

    // overrides → попадают в конечный pass.json
    const overrides = {
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      organizationName: ORG_NAME,
      serialNumber: voucher.serial,

      // включай, когда поднимешь Wallet Web Service + токены в БД
      ...(WS_URL ? {
        webServiceURL: WS_URL,
        authenticationToken: voucher.authToken
      } : {}),

      // Явный QR (вместо setBarcodes — чтобы контролировать кодировку)
      barcode: {
        format: 'PKBarcodeFormatQR',
        message: voucher.serial,
        messageEncoding: 'iso-8859-1'
      },

      // Динамические поля StoreCard (если в модели уже есть поля — это перезапишет значения)
      storeCard: {
        primaryFields: [
          { key: 'balance', label: 'Баланс', value: `${voucher.amount} сум` }
        ],
        auxiliaryFields: [
          { key: 'status', label: 'Статус', value: voucher.status }
        ]
      }
    };

    const pass = await PKPass.from(
      { model: MODEL_DIR, certificates: CERTS },
      overrides
    );

    const buf = await pass.getAsBuffer();

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${serial}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buf);
  } catch (err) {
    console.error('PKPass error:', err);
    return res.status(500).send('Pass generation error');
  }
});

export default router;
