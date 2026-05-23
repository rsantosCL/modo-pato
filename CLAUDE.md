# Modo Pato

## Purpose & Scope

Personal/family budget app replacing two Google Sheets. Multi-user, multi-currency (CLP/CLF/USD), catalog-driven monthly projections with planned-vs-actual reconciliation.

Greenfield project — pre-Phase 0 of the implementation plan (SPEC.md Appendix C). No domain models or business logic implemented yet.

## Entry Points & Contracts

- `docker compose up` — runs Postgres 16 + Django dev server (`:8000`) + Vite dev server (`:5173`)
- `docs/SPEC.md` — functional spec v1.9: domain model, algorithms, validation rules. The design contract.
- `docs/DEPLOYMENT.md` — infra plan: Hetzner VPS, Cloudflare Tunnel/Pages, Neon Postgres, R2 backups.

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
