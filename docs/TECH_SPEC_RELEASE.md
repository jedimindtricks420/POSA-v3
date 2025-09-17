# TECH_SPEC_RELEASE.md
> Unambiguous spec for: Offline receipts, Vendor portal, Client QR & PWA

## 1. Receipts (PDFKit)

### 1.1. Font & localization
- Use `assets/fonts/Roboto.ttf`; register once:
  ```js
  // pdf/receipt.js
  const PDFDocument = require('pdfkit');
  const path = require('path');
  const fontPath = path.join(process.cwd(), 'assets/fonts/Roboto.ttf');
  doc.registerFont('Roboto', fontPath);
  doc.font('Roboto');

### 1.2. Receipt data model
type ReceiptItem = { name: string; qty: number; price: number };
type ReceiptPayload = {
  merchantName: string;
  saleId: number;
  dateISO: string;         // server ISO, render localized
  items: ReceiptItem[];
  total: number;
  showPlainCode: boolean;  // per-vendor flag
  voucherMasked?: string;
  voucherFull?: string;    // only if showPlainCode = true
  qrUrl: string;
};

### 1.3. Rendering rules

Header: merchantName, time+date

For each item: name — qty × price

Total (bold)

QR code (png buffer from qrcode lib) with qrUrl

If showPlainCode=true and vendor policy allows → print voucherFull; else print masked and rely on QR.

### 1.4. QR content & flows

qrUrl = /activate?token=<JWT>

JWT claims:

sub: voucherId

vendorId: number

scope: "client_add" or "vendor_activate" (derive in UI)

exp: 48h default

Client path: open -> detect device:

iOS → .pkpass download -> VoucherWalletLog -> status pending

Android → web wallet page -> VoucherWalletLog -> pending

Vendor path: if opened under vendor portal → show activation form; enforce vendorId ACL

### 1.5. Admin: vendor edit page (/admin/vendors/edit/:id)

Add right-side live preview pane (iframe or canvas) that calls /admin/vendors/:id/receipt/preview?sampleSaleId=...

Add “Receipt Builder” tab:

Drag-and-drop widgets: Header, Text, Line Item Table, Total, QR, Raw Code

Save JSON template in Vendor.receiptTemplate

Preview renders using the same renderer as prod (server endpoint), with sample data

## 2. Vendor portal
### 2.1. Styling

Reuse Admin layout (EJS partials, Bootstrap variables)

Shared navbar: Dashboard | Activate | Vouchers | Transactions | Settings

### 2.2. Pages & endpoints

GET /vendor → Dashboard (stats: activations last 7d, pending, etc.)

GET /vendor/activate → form + QR input; POST /vendor/activate (body: code or token)

GET /vendor/vouchers?status=... → list filters

GET /vendor/transactions → derived from VoucherTransaction

GET /vendor/settings → vendor users listing + receipt defaults (read-only if managed by Admin)

### 2.3. ACL

All vendor routes require user.role=vendor_user or vendor admin; enforce user.vendorId === voucher.vendorId on mutations

## 3. Client QR & PWA
### 3.1. QR scanning

Page: /wallet/scan

Use browser getUserMedia + js QR lib (zxing/jsQR)

Fallback: manual input of token / code

On success:

Verify token; if iOS → serve .pkpass; if Android → add to web wallet page

### 3.2. Web wallet (Android)

Page: /wallet — list assigned vouchers (OnlineVoucher), statuses, “Show QR for vendor”

Write VoucherWalletLog on first render per voucher

### 3.3. PWA

public/manifest.webmanifest with app name, theme colors, icons (192/512)

public/icons/* PNGs

public/service-worker.js:

Precache shell (HTML, CSS, JS, fonts)

Runtime caching for API GETs

Versioned cache keys; update on deploy

Add <link rel="manifest"> and <meta name="theme-color">

## 4. Data & schema notes

Use existing Prisma schema. No mandatory migrations. Optional:

Consider Product.status → enum in future

Vendor receiptTemplate already present; reuse it to store DnD JSON

## 5. Tests
### 5.1. Unit

PDF renderer renders Cyrillic (assert text glyphs)

QR payload has correct claims per flow

### 5.2. Integration

/admin/vendors/:id/receipt/preview returns PDF with expected sections

Vendor activation rejects foreign vendorId

### 5.3. E2E (happy paths)

Offline sale → PDF with QR → client scans → pending

Vendor scans → activated

PWA installs and serves offline shell

### 6. Acceptance Criteria (summary)

Cyrillic text appears correctly in receipts using Roboto

On vendor edit page: live preview + DnD builder; template saved and used

Vendor portal matches admin style; activation enforces ACL

Client can scan QR and add the voucher; PWA installable and works offline shell


---