# Copilot: repository custom instructions

## Project quick facts
- Stack: Node.js + Express, EJS + Bootstrap, Prisma + PostgreSQL; Python (Pyrogram) for one Telegram vendor.
- App port: 4000. TZ: Asia/Tashkent.
- Docs: see `docs/` → BUSINESS_LOGIC.md, ERD.md, PRD.md, SRS.md.

## Goals for any "docs sync" task
1) Read backend (`/activation-system`), frontend (EJS), Prisma schema and Python module(s).
2) Produce a concise inventory: routes, controllers, middlewares, Prisma models, enums, migrations, templates (EJS), Python flows.
3) Compare **what exists** vs **docs** (`docs/*.md`), find drifts (missing/extra fields, statuses, roles, flows).
4) Update docs to reflect reality. Preserve structure & intent. Explain any uncertainties as TODOs.
5) Open a PR with:
   - `docs/*.md` updates,
   - `artifacts/scan/*.json` (inventories),
   - short CHANGELOG in PR body.

## How to run things here (agent)
- Depend on `.github/copilot-setup-steps.yml` for Node/Python/Postgres.
- Use `npx prisma validate` and `npx prisma format` to understand DB.
- **Do NOT** touch real secrets; use `DATABASE_URL` from env.
- You may create helper scripts in `scripts/` to scan routes/models, then commit them in the PR.

## Ground rules
- Don’t invent features; reflect code reality. If code contradicts doc, explain and update docs.
- Mask voucher codes in examples.
- Keep formulas for debts/commissions consistent across docs.
