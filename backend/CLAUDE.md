# Backend

## Purpose & Scope

Django 6 + DRF API server. Currently scaffolding only — no Django apps, no domain models from SPEC.md §5.

Handles: all domain logic, catalog query derivation (§8), rounding (§9), month lifecycle (§10–§11), auth.
Does NOT handle: user-facing rendering (frontend), static hosting in production (Cloudflare Pages).

## Entry Points & Contracts

- Two URL configurations selected by `DJANGO_URLCONF` env var:
  - `config.urls_api` (api service, port 8000) — `GET /v1/health/` (+ future `/v1/...` routes). Default when env unset.
  - `config.urls_admin` (admin service, port 8001) — Django admin mounted at `/`. Production: `admin.modo-pato.rsantos.cl` gated by Cloudflare Access.
- Settings via `django-environ`: `DATABASE_URL`, `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `DJANGO_URLCONF`.
- Deps managed with `uv`: edit `pyproject.toml` → `uv lock` → `uv sync --frozen --all-groups` in Docker (dev deps, including pytest, are installed in the image — acceptable for this project's scale).
- Tests: `pytest` + `pytest-django` (Django's unittest runner is not used).

## Anti-patterns

- Don't store derived fields (`end_month`, `valid_months`, `prepaid_installments`) — compute at read time (§5.1.1).
- Don't round `actual_amount_*` or `amount_real` — only `Planificado` is rounded (§9.1, load-bearing rule).
- Don't allow negative amounts via direct entry — only two system-generated paths: TC adjustment and savings retirement (§10.4).
- Don't duplicate catalog items for time-varying values — use `CatalogItemRevision` with `effective_from_month` (§5.1, §13.5).
- Production Docker images must target `linux/arm64` (Hetzner CAX11 ARM VPS).
- Carry-over and balance math use raw per-item sums, never Resumen-smoothed values (§11.2).
- Don't add api and admin routes to the same URLconf — keep them isolated by service so an outage in one doesn't touch the other; admin auth is enforced by Cloudflare Access at the subdomain, not by path rules.
