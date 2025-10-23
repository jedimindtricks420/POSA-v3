# QR Code Feature – Current State & Context Requirements

## Existing Behaviour Overview

- **Receipt generation (`controllers/merchant/saleController.js`, `utils/receiptRenderer.js`)**
  - For offline sales, vouchers are picked from the active pool, moved to status `sold`, and a PDF receipt is rendered.
  - The QR printed on the receipt is generated from a URL shaped as `/activate?voucher=<code>` (host taken from the current request).
  - Receipt templates resolve the QR via `context.qrUrl`, defaulting to the same activation URL.

- **Client wallet (PWA) (`public/js/client-app.js`, `controllers/client/api/voucherController.js`)**
  - Vouchers shown in the PWA come from the `OnlineVoucher` table and represent vouchers purchased online.
  - The modal renders a QR where the payload is currently just the voucher code (`voucher.value`), not the activation URL.
  - Scan history and offline storage are handled inside `public/js/client-scan.js` and `wallet-offline-store.js`.

- **Client QR scan page (`public/js/client-scan.js`)**
  - Camera scans a QR and the app tries to match the scanned value against the already assigned vouchers in memory.
  - There is no flow to attach an unassigned/offline voucher to the current client account.

- **Vendor activation (`controllers/vendor/activationController.js`, `/vendor/activate`)**
  - Manual activation validates that the voucher belongs to the logged-in vendor and that its status is `sold` or `pending`.
  - Automatic activation via `/activate?voucher=<code>` simply toggles the voucher to `activated` if the session user is a vendor, without vendor ownership checks or assignment clean-up.
  - After activation the voucher remains linked to the client via `OnlineVoucher`, so it still appears in the client wallet and is only marked as `activated`.

## Context Requirements Recap

1. **Single QR identity**  
   The QR shown in the PWA must be the same as the one printed on offline receipts. It encodes at least the voucher code and should be extensible to include a `.pkpass` payload in a future v2.0 release.

2. **Scenario 1 — Vendor scan & activation**  
   - Scanning should behave exactly like manual code entry by the vendor.
   - Activation succeeds only when the voucher belongs to the scanning vendor; otherwise an explicit error is shown and the status does not change.
   - When the vendor activates a voucher that is currently present in a client’s PWA, the wallet must refresh so that the voucher disappears (mirroring the effect of an online voucher after it is redeemed).

3. **Scenario 2 — Client scan of an offline voucher**  
   - A client with no online purchase can scan the QR from a printed offline receipt.  
   - The scanned voucher must be bound to that client account (creating the same records as an online sale) and subsequently displayed in their PWA wallet.
   - The voucher status in the core tables must transition so that the voucher is no longer floating offline.
