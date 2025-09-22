# ROADMAP_RELEASE.md
> Target: Release-ready app (offline receipts + vendor UI + client PWA)  
> TZ: Asia/Tashkent

## Milestone 1 — Receipts foundation (1–2 days)
- Embed Roboto.ttf in PDFKit; render Cyrillic
- New receipt layout builder (schema + renderer)
- Live preview on `/admin/vendors/edit/:id`
- QR content spec (JWT claims: voucherId, vendorId, scope, exp)

## Milestone 2 — Vendor portal (1–2 days) ✅ выполнено (2025-08-15)
- Tailwind-тема, общий navbar и мобильное меню
- Реализованы страницы: Dashboard, Activate, Vouchers, Transactions, Settings
- Активация ваучеров (код/Telegram), ACL `vendor_user`, аналитика и очереди

## Milestone 2.1 — Merchant UI refresh (done)
- Унифицированный Tailwind-UI для `/merchant/dashboard`, `/merchant/sell`, `/merchant/checkout`, `/merchant/sales`
- Фиксированный navbar, адаптивные таблицы, пустые состояния

## Milestone 3 — Client QR & Wallet (2–3 days)
- Web QR scanner (zxing/jsQR in a dedicated page)
- iOS: `.pkpass` flow; Android: web wallet page
- Polished UI & states

## Milestone 4 — PWA & QA (1–2 days)
- `manifest.webmanifest`, icons, SW caching
- Tests: PDF with Cyrillic, QR deep links, ACL, basic E2E
- Docs sync (BUSINESS_LOGIC/ERD/PRD/SRS)

## Deliverables
- PRs per milestone + final rollup PR
- Updated docs + screenshots/gifs in PR body

## Risks & Mitigations
- PDF fonts not embedded → add explicit font registration
- Camera permissions for QR → graceful fallback (manual code)
- PWA caching bugs → SW versioning & cache busting
