# Modo Pato

## Purpose & Scope

Personal/family budget app replacing two Google Sheets. Multi-user, multi-currency (CLP/CLF/USD), catalog-driven monthly projections with planned-vs-actual reconciliation.

Currently at v0.3.0: auth, ledgers, and catalog (items + revisions, derived fields, §13.3 validation) are shipped. Currency engine, month views, and actuals not yet implemented.

## Entry Points & Contracts

- `just` — lists all dev shortcuts (`just up`, `just test`, `just migrate`, etc.). Wraps `docker compose` commands; prefer `just` over raw `docker compose` for common tasks.
- `docker compose up` — runs Postgres 16 + Django api (`:8000`) + Django admin (`:8001`) + Vite (`:5173`). Backend and admin share one image; service split is by `DJANGO_URLCONF` env (api → `config.urls_api` at `/v1/...`, admin → `config.urls_admin` at `/`).
- `docs/SPEC.md` — functional spec v1.9: domain model, algorithms, validation rules. The design contract.
- `docs/DEPLOYMENT.md` — infra plan: Hetzner VPS, Cloudflare Tunnel/Pages/Access, Neon Postgres, R2 backups.
- `docs/ROADMAP.md` — versioned step plan from 0.0.1 (baseline) to 1.0.0 (production); each step is a minor bump in lockstep across backend + frontend. All user-facing docs live under `docs/`.
- `V1-IMPLEMENTATION-PLAN.md` — agent execution companion to `docs/ROADMAP.md` (stays at repo root because it's agent-facing, not user-facing).

## Conventions

- Frontend npm installs must use `docker run --platform linux/amd64` (not `docker compose run`) to keep `package-lock.json` on linux/amd64, matching CI.

## Anti-patterns

- Don't restate SPEC.md content in code comments or docs — downlink to the relevant section.
- Don't store what can be derived: `end_month`, `valid_months`, `prepaid_installments` are computed (§5.1.1).
- Real values are never rounded — this is load-bearing (§9.1). Only `Planificado` is rounded.
- `CLF` in code, `UF` in Spanish UI only (§6.2).
- Stack is Django + Vue 3 — SPEC §3.3's React/Node suggestion is superseded.
- Don't duplicate catalog items for annual changes (e.g. "Sueldo 2025"/"Sueldo 2026") — use revisions on a single item (§5.1, §13.5).
- Closed months are immutable snapshots; open months are derived on demand from the catalog — never persist open month views as source of truth (§3.2, §10.5).
- Computing any open month N requires cascading through all prior open months in order (§11.4).

## Downlinks

[backend/CLAUDE.md]: backend/CLAUDE.md (Django API: domain logic, models, endpoints)
[frontend/CLAUDE.md]: frontend/CLAUDE.md (Vue 3 SPA: UI rendering, API client)
