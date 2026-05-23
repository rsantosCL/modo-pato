# Backend

## Purpose & Scope

Django 6 + DRF API server. Currently scaffolding only — no Django apps, no domain models from SPEC.md §5.

Handles: all domain logic, catalog query derivation (§8), rounding (§9), month lifecycle (§10–§11), auth.
Does NOT handle: user-facing rendering (frontend), static hosting in production (Cloudflare Pages).

## Entry Points & Contracts

- `GET /api/v1/health/` — only endpoint, defined in `config/urls.py`
- Settings via `django-environ`: `DATABASE_URL`, `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`
- Deps managed with `uv`: edit `pyproject.toml` → `uv lock` → `uv sync --frozen` in Docker

## Anti-patterns

- Don't store derived fields (`end_month`, `valid_months`, `prepaid_installments`) — compute at read time (§5.1.1).
- Don't round `actual_amount_*` or `amount_real` — only `Planificado` is rounded (§9.1, load-bearing rule).
- Don't allow negative amounts via direct entry — only two system-generated paths: TC adjustment and savings retirement (§10.4).
- Don't duplicate catalog items for time-varying values — use `CatalogItemRevision` with `effective_from_month` (§5.1, §13.5).
- Production Docker images must target `linux/arm64` (Hetzner CAX11 ARM VPS).
- Carry-over and balance math use raw per-item sums, never Resumen-smoothed values (§11.2).
