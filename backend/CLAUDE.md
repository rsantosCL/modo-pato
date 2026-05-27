# Backend

## Purpose & Scope

Django 6 + DRF API server. v0.3.0: `core`, `accounts`, `ledgers`, `catalog` apps shipped. Currency, month logic not yet implemented.

Handles: all domain logic, catalog query derivation (§8), rounding (§9), month lifecycle (§10–§11), auth.
Does NOT handle: user-facing rendering (frontend), static hosting in production (Cloudflare Pages).

## Entry Points & Contracts

- `DJANGO_URLCONF` env selects URL conf:
  - `config.urls_api` (port 8000) — `/v1/health/`, `/v1/auth/`, `/v1/ledgers/`, `/v1/invites/`, `/v1/ledgers/{id}/catalog-items/`, `/v1/catalog-items/{id}/`, `/v1/catalog-items/{id}/revisions/`. Default.
  - `config.urls_admin` (port 8001) — Django admin at `/`. Production: gated by Cloudflare Access.
- `AUTH_USER_MODEL = accounts.User` — UUID pk, email login. Must be set before first migration; never revert to `auth.User`.
- Deps: `uv` — edit `pyproject.toml` → `uv lock` → `uv sync --frozen --all-groups`.
- Tests: `pytest` + `pytest-django` only (never Django's unittest runner).

## Shared utilities

- `core/fields.py` → `MonthListField(JSONField)`: DB stores int list, Python returns `calendar.Month` list.
- `ledgers/models.py` → `Ledger.get_for_member(pk, user) -> Ledger | None` (returns `None`; caller raises `NotFound`); `Ledger.can_edit(user) -> bool`.
- `catalog/permissions.py` → `IsCatalogItemMember`, `CanEditCatalogItem`: object-level; delegate to `obj.ledger`.

## SPEC → code naming

SPEC uses Spanish; all code identifiers are English:

| SPEC term | Code name |
|---|---|
| `fuente` | `payment_source` |
| `TC` (Tarjeta de Crédito) | `CREDIT_CARD` |
| `prepago_month` | `payoff_month` |

Spanish labels only appear in i18n JSON files.

## Anti-patterns

- Don't store derived fields (`end_month`, `valid_months`, `prepaid_installments`) — compute at read time (§5.1.1).
- Don't round `amount_real` — only `Planificado` is rounded (§9.1, load-bearing).
- Don't allow negative amounts via direct entry — only TC adjustment and savings retirement (§10.4).
- Don't duplicate catalog items for time-varying values — use `CatalogItemRevision` (§5.1, §13.5).
- Carry-over math uses raw per-item sums, never Resumen-smoothed values (§11.2).
- Production Docker images must target `linux/arm64` (Hetzner CAX11 ARM VPS).
- Api and admin URLconfs must stay isolated — never merge into one file.
