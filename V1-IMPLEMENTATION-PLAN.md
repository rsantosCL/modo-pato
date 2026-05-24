# Modo Pato — v1 Implementation Plan

Detailed execution companion to [`docs/ROADMAP.md`](docs/ROADMAP.md). Each step here corresponds to one minor (or, for the final step, major) version bump and lists concrete deliverables for the agent. The design contract is [`docs/SPEC.md`](docs/SPEC.md); the production rollout is [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). This document never restates those — it points back into them.

## How to use this document

- Work one step at a time, in version order. Each step is mergeable on its own and ships with version bumps on both `backend/pyproject.toml` and `frontend/package.json` (in lockstep).
- When in doubt about behavior or rules, defer to `docs/SPEC.md`. This doc only lists implementation deliverables, not product rationale.
- Per-phase library decisions are constrained by the **Frontend library policy** table below. The bolded recommendation stands unless a phase documents a deviation here.
- Anti-patterns are downlinked from `CLAUDE.md` files — don't duplicate them in this doc; reference the SPEC § instead.

## Conventions

- API URL pattern: `https://api.modo-pato.rsantos.cl/v1/<resource>/`. No `/api/` path prefix (subdomain already encodes that). New endpoints land under `/v1/`. URL versioning is the only versioning lever; bump to `/v2/` only on a breaking change.
- Django admin URL: `https://admin.modo-pato.rsantos.cl/` (mounted at root via `config.urls_admin`). Local dev: `http://localhost:8001/`.
- Two-service Django: same image, `DJANGO_URLCONF=config.urls_api` for the api container (port 8000), `DJANGO_URLCONF=config.urls_admin` for the admin container (port 8001).
- Tests: backend uses `pytest` + `pytest-django` only — never Django's unittest runner. Frontend uses Vitest. Both run in CI.
- Versions ride together: bumping `backend/pyproject.toml` requires bumping `frontend/package.json` in the same PR.

## Frontend library policy

Mandated (no alternatives):

- **Language — TypeScript.** All Vue SFCs use `<script setup lang="ts">`. Type-check via `vue-tsc --noEmit` in CI.
- **CSS — Pico.css.** Classless, semantic HTML. Custom CSS only where Pico's defaults don't cover a case (Vue SFC scoped styles + one small `app.css` for globals).
- **Routing — Vue Router.**
- **Unit tests — Vitest + `@vue/test-utils`** (+ `jsdom` or `happy-dom`).

Per-phase decisions (alternatives smallest → largest; recommended in **bold**):

| Concern | Phase | Options | Recommendation rationale |
|---|---|---|---|
| State management | 0.2.0 | composables w/ `provide`/`inject` · **Pinia** (~6KB) | Pinia — auth/ledger state is shared widely; devtools pay for the dep |
| API client | 0.2.0 | **native `fetch` + ~30-line wrapper** · `ofetch` (~3KB) · `ky` (~5KB) · `axios` (~14KB) | Native fetch — token injection, JSON parsing, error normalization fit in a small composable |
| Icons | 0.2.0 | **inline SVG** · `lucide-vue-next` (~2KB tree-shaken) | Inline SVG — ~10 icons total, copy-paste from Heroicons / Lucide |
| **i18n (bilingual en + es-CL)** | 0.2.0 | simple `t(key)` composable + JSON · Petite Vue I18n (~9KB) · **vue-i18n** (~25KB) | vue-i18n — bilingual from day 1 avoids costly retrofit; `$n` integrates `Intl.NumberFormat` per locale (CLP / USD / UF labelling per §6.2); `$d` handles dates |
| Form validation | 0.3.0 | **hand-rolled composable** · `valibot` (~1KB) + composable · `vee-validate` (~10KB) | Hand-rolled — §13.3 validations are crisp and few |
| Date / month math | 0.5.0 | **native `Date` + `Intl`** · `dayjs` (~2KB) | Native — we deal in `YYYY-MM` strings and month arithmetic only; vue-i18n's `$d` handles display formatting |
| Currency input | 0.6.0 | **native + composable** · `vue-currency-input` (~5KB) | Native — three currencies (CLP / CLF / USD), formatting via vue-i18n's `$n` |
| Modal / dialog | 0.8.0 | **native `<dialog>`** | HTMLDialogElement is fully supported in 2026; no library |
| Charts | 0.10.0 | hand-rolled SVG · `uPlot` (~40KB) · **`Chart.js`** (~70KB) · `ApexCharts` (~140KB) | Chart.js — 12-month timeline gets polished tooltips/legends for free; doesn't compromise UX |
| E2E tests | 0.13.0 | **Playwright** · Cypress | Playwright — lighter installer, better headless, native Vite integration |

Deviating from the bolded recommendation requires a one-line justification in the affected phase's **Library decisions** block below.

## Backend tooling

- **Test framework — `pytest` + `pytest-django`** (mandated). `[tool.pytest.ini_options]` lives in `backend/pyproject.toml`; `DJANGO_SETTINGS_MODULE = "config.settings"`. Tests live under `backend/tests/` or alongside apps as `tests.py`.
- Linter / type-checker / coverage threshold: deferred. Surface decisions in the phase that first benefits.

---

## 0.0.1 — Baseline

Already shipped via baseline-prep alongside this document:

- Version strings reset to `0.0.1`.
- Frontend on TypeScript (`tsconfig.json`, `main.ts`, `vite.config.ts`, `<script setup lang="ts">` in `App.vue`).
- Django URL config split into `config/urls_api.py` (api host, `/v1/...`) and `config/urls_admin.py` (admin host, `/`). `ROOT_URLCONF` selected by `DJANGO_URLCONF` env var.
- Two Docker services in `docker-compose.yml`: `backend` (port 8000, `config.urls_api`) and `admin` (port 8001, `config.urls_admin`).
- API URL pattern dropped `/api` prefix; Vite proxy removed; frontend uses `VITE_API_BASE_URL` directly.
- `docs/DEPLOYMENT.md` updated for admin subdomain (Cloudflare Tunnel ingress, Cloudflare Access policy, ALLOWED_HOSTS, `docker-compose.prod.yml` admin service, verification steps).
- Intent-layer `CLAUDE.md` files reflect the new layout.

---

## 0.1.0 — CI + branch protection

**Goal:** Gate every merge to `main` on passing tests before any feature work begins.

**Depends on:** `0.0.1` baseline.

**Entities introduced:** none.

**Backend deliverables**
- Add `pytest`, `pytest-django`, `pytest-cov` to `backend/pyproject.toml` dev deps.
- Add `[tool.pytest.ini_options]` block: `DJANGO_SETTINGS_MODULE = "config.settings"`, `python_files = "tests.py test_*.py *_tests.py"`.
- Create `backend/tests/__init__.py` and `backend/tests/test_health.py`. The smoke test uses Django's test client to `GET /v1/health/` and asserts 200 + JSON `{"status": "ok"}`.

**Frontend deliverables**
- Add `vitest`, `@vue/test-utils`, `jsdom` (or `happy-dom`) to `frontend/package.json` dev deps. Add `"test": "vitest run"` script.
- Create `frontend/vitest.config.ts` (extends `vite.config.ts`, sets `test.environment = "jsdom"`).
- Create `frontend/src/App.test.ts`: mount `App.vue` with `@vue/test-utils`, assert root element renders. TS extension is non-negotiable.

**CI deliverables**
- `.github/workflows/ci.yml`:
  - Trigger: `pull_request` against `main`, `push` to feature branches.
  - Job `backend`: `actions/checkout`, `astral-sh/setup-uv`, `uv sync`, `uv run pytest`.
  - Job `frontend`: `actions/checkout`, `actions/setup-node`, `npm ci`, `npm run type-check`, `npm run test`.
  - Job `version-sync`: enforces the lockstep version invariant between `backend/pyproject.toml` and `frontend/package.json`. Fails the PR if they differ.
    ```yaml
    version-sync:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: Backend and frontend versions match
          run: |
            BE=$(python -c "import tomllib; print(tomllib.load(open('backend/pyproject.toml','rb'))['project']['version'])")
            FE=$(python -c "import json; print(json.load(open('frontend/package.json'))['version'])")
            [ "$BE" = "$FE" ] || { echo "version drift: backend=$BE frontend=$FE"; exit 1; }
    ```
  - Job names are load-bearing — the branch protection rule below references them.

**Manual repo config** (operator runs once after the workflow lands):
- GitHub → Settings → Branches → Add rule for `main`:
  - Require a pull request before merging.
  - Require status checks to pass before merging; required checks: `backend`, `frontend`, `version-sync`.
  - Require branches to be up to date before merging.
  - Do not allow bypass; include administrators.
  - (Optional, recommended) Require linear history.
- Verify by attempting `git push origin main` from a clone — must be rejected.

**Library decisions:** none new beyond the mandated frontend test stack.

**SPEC anchors:** not in SPEC — operational requirement.

**Anti-patterns to avoid**
- Don't skip type-check in CI to make the pipeline faster; TS errors caught locally are cheap, TS errors found post-merge aren't.
- Don't run `pytest` and `vitest` in one shell to "save time" — separate jobs surface failure source more clearly.

**Done when:** A PR that breaks any backend or frontend test (or type-check), or that bumps only one of the two version files, cannot merge to `main`; direct pushes to `main` are blocked for everyone.

---

## 0.2.0 — Phase 0: Foundations

**Goal:** Multi-user ledger access — sign in, create a ledger, invite a partner.

**Depends on:** `0.1.0`.

**Entities introduced:** `User`, `Ledger`, `LedgerMember`.

**Backend deliverables**
- New Django app `accounts/`: extend or use the default `User` model per SPEC §5.1. Custom user model is recommended even if minimal, to avoid the painful future migration.
- New Django app `ledgers/`: `Ledger`, `LedgerMember` (FK to ledger + user, role enum), invitation token model (simple opaque token, no email yet).
- Migrations for the new tables.
- DRF viewsets:
  - `POST /v1/auth/signup/`, `POST /v1/auth/login/` (returns JWT pair via `simplejwt`), `POST /v1/auth/refresh/`.
  - `GET/POST /v1/ledgers/`, `GET/PATCH /v1/ledgers/{id}/`.
  - `POST /v1/ledgers/{id}/invites/` (returns token), `POST /v1/invites/{token}/accept/`.
- Permissions: ledger access requires membership (any role); editing requires owner or editor.
- Tests: pytest covers auth happy path, ledger CRUD with permissions, invitation flow.

**Frontend deliverables**
- Add deps: `vue-router`, `pinia`, `vue-i18n`, `@picocss/pico`.
- Routes: `/login`, `/signup`, `/ledgers` (list + create), `/ledgers/:id` (placeholder), `/ledgers/:id/members`.
- Pinia stores: `auth` (current user, JWT pair, refresh logic), `ledgers` (list, active ledger).
- API client (`src/lib/api.ts`): native `fetch` wrapper that injects `Authorization: Bearer …`, parses JSON, normalizes errors. ~30 lines.
- vue-i18n bootstrap: `src/i18n/index.ts` with `en.json` and `es-CL.json`; all UI strings go through `t()` from day 1. Detect locale from `navigator.language` with `es-CL` fallback.
- Pico.css import in `main.ts` (`@picocss/pico/css/pico.min.css`) plus a slim `src/app.css` for globals.
- Vitest tests for the auth store and one e2e-style component test (mount login page, fill, assert API call).

**Library decisions**
- State management: **Pinia** (per policy).
- API client: **native fetch + wrapper** (per policy).
- Icons: **inline SVG** (per policy). Copy ~3 needed icons from Heroicons.
- i18n: **vue-i18n** (per policy). Setting up bilingual now means every later phase's strings go through `t()` without retrofit.

**SPEC anchors:** §4 (roles, sharing, concurrency note), §5.1 (User, Ledger, LedgerMember entities), §6.2 (UF/CLF terminology — only relevant for the locale label, but i18n setup must accommodate it).

**Anti-patterns to avoid**
- Don't skip the custom `User` model. See [`backend/CLAUDE.md`](backend/CLAUDE.md) anti-patterns.
- Don't render any UI string outside `t()` — even placeholder text. Retrofits are costly.
- Don't add Vuetify / Element Plus / etc. Pico.css + semantic HTML is the standing rule.

**Done when:** Can create a ledger as User A, generate an invite token, accept it as User B, both log in and see the shared ledger; all strings render correctly in both `en` and `es-CL`.

---

## 0.3.0 — Phase 1: Catalog kernel

**Goal:** Build the foundation for all recurring items.

**Depends on:** `0.2.0`.

**Entities introduced:** `CatalogItem`, `CatalogItemRevision`.

**Backend deliverables**
- New Django app `catalog/` with `CatalogItem`, `CatalogItemRevision` models per SPEC §5.1.
- **Derived fields stay derived** (`end_month`, `valid_months`, `prepaid_installments`) — see [`backend/CLAUDE.md`](backend/CLAUDE.md). Compute via model methods / properties, never store.
- Migrations.
- DRF viewsets: nested under ledger (`GET/POST /v1/ledgers/{id}/catalog-items/`, `GET/PATCH/DELETE /v1/catalog-items/{id}/`, similar for revisions).
- Validators implementing every rule in §13.3 (start month required, ≥1 revision covering start, frequency / custom_months consistency, etc.). Revisions immutable after creation — enforce in serializer.
- Pytest coverage of every §13.3 rule (one test per rule, plus the worked example from Appendix B as a fixture).

**Frontend deliverables**
- Routes: `/ledgers/:id/catalog`, `/ledgers/:id/catalog/:itemId` (drawer or modal for revisions).
- Catalog editor page: filterable + sortable table of catalog items, inline edit for simple fields, "Add revision" / "View history" actions per row.
- Revision drawer: list of revisions for the active item, add new revision with `effective_from_month`, `amount_real`, `fuente`. Cannot edit existing revisions.
- Hand-rolled form validation composable (`src/lib/validation.ts`) implementing §13.3 rules client-side for fast UX; backend remains authoritative.

**Library decisions**
- Form validation: **hand-rolled composable** (per policy). §13.3 is finite and well-defined; libs add weight without value.

**SPEC anchors:** §5.1 (CatalogItem, CatalogItemRevision), §5.1.1 (derived fields), §13 (catalog editor), §13.3 (validations), §13.5 (revision workflow).

**Anti-patterns to avoid**
- Don't store `end_month` / `valid_months` (§5.1.1).
- Don't allow editing existing revisions — create a new revision instead (§13.5).
- Don't duplicate items for time-varying values (e.g. "Sueldo 2025" + "Sueldo 2026"). Use one item with multiple revisions.

**Done when:** Can enter every catalog item from the source sheets — including multi-revision items like "Sueldo" with 2025 / 2026 / 2027 revisions — and reload to verify persistence.

---

## 0.4.0 — Phase 2: Catalog query + currency engine

**Goal:** Implement the mathematical core: derive planned items for any month, with currency conversion and rounding.

**Depends on:** `0.3.0`.

**Entities introduced:** `ExchangeRate`. `PlannedItem` exists only as an in-memory DTO (never stored).

**Backend deliverables**
- `currency/` app:
  - `ExchangeRate` model: `(currency, month, rate_clp_per_unit, source)`. Source enum: `mindicador`, `manual`, `projected`.
  - Daily fetch via management command `python manage.py fetch_rates` (called from cron in dev compose for now; production scheduling decided later). Pulls CLF and USD from mindicador.cl, stores latest for the current month. Add a manual `set_rate` command for offline fallback.
  - Future-month projection: `rate(month + n) = rate(month) × (1 + variation_rate)^n`, where `variation_rate` comes from `LedgerConfig` per currency.
- `catalog/query.py`: pure function `derive_planned_items(ledger_id: int, month: str) -> list[PlannedItem]` implementing SPEC §8 step by step. No I/O inside the function — caller passes in items, revisions, exchange rates.
- `catalog/rounding.py`: implements §9. Direction-aware (income floors, expense / provision ceilings), applied only to `Planificado`, only in CLP, only after conversion. Three rounding units from `LedgerConfig.approximations`.
- Admin endpoint or management command `derive_month` for testing: `python manage.py derive_month <ledger_id> <YYYY-MM>` → prints planned items.
- Pytest: fixture file with the Appendix B worked example + edge cases (prepago month combined amount, installment exhaustion mid-year, CUSTOM frequency, H half-yearly, revision selection at boundary months, USD bank surcharge, CLF/UF label).

**Frontend deliverables**
- Small admin/debug page (`/ledgers/:id/derive`) showing the derived planned items for an arbitrary month — useful during this phase, can be polished/removed later.

**Library decisions:** none new in this phase.

**SPEC anchors:** §6 (currency, USD surcharge, CLF/UF), §8 (catalog query), §8.3 (prepago combined amount), §9 (rounding rules), Appendix B (worked example).

**Anti-patterns to avoid**
- Never round real values (`amount_real`, actuals). Only `Planificado` is rounded (§9.1).
- Carry-over math uses raw per-item sums, never Resumen-smoothed values (§11.2) — this will matter in 0.7.0; design 0.4.0's DTOs to keep raw values accessible.
- The catalog query is a **pure function** — no DB reads inside. Caller fetches inputs.

**Done when:** `python manage.py derive_month <ledger_id> <YYYY-MM>` produces planned items matching the source sheets exactly for at least three sample months. Tests cover every edge case in Appendix B.

---

## 0.5.0 — Phase 3: Month view (read-only)

**Goal:** Render a complete derived month view for any open month.

**Depends on:** `0.4.0`.

**Entities introduced:** `MonthState` (metadata only — `status: open | closed`, `monto_en_cuenta_override`, `closed_at`, `closed_by`, `catalog_version_at_close`).

**Backend deliverables**
- `months/` app with `MonthState` model.
- `GET /v1/ledgers/{id}/months/{YYYY-MM}/` returns the full derived view (planned items grouped by category, Resumen aggregation per §10.8, Real vs Ideal block, balance block — read-only). Closed months return their snapshot (but snapshots don't exist yet; assume open in this phase).
- Cascade computation: deriving month N reads `monto_en_cuenta` from previous month's derivation. Implement as a recursive call with memoization within a single request (§11.4).
- Caching: cache derived months in Redis or Django's cache framework, keyed by `(ledger_id, month, catalog_version)`. Bump `catalog_version` on any catalog write so caches invalidate.
- Pytest covers cascade correctness across 12 months and cache invalidation on catalog edit.

**Frontend deliverables**
- Route `/ledgers/:id/months/:month` (e.g. `/ledgers/123/months/2026-05`).
- Month view page: header (month label, status, exchange rates), balance block, card payments block, Real vs Ideal block, Resumen table, four category tables (Ingresos, Gastos esenciales, Gastos variables, Previsión).
- Navigation: prev / next month buttons. Visiting future month triggers backend cascade (single request).
- All values rendered via `t()` and `$n` for locale formatting.

**Library decisions**
- Date / month math: **native `Date` + `Intl`** (per policy). All months stored as `YYYY-MM` strings.

**SPEC anchors:** §10.1 (month view layout), §10.8 (Resumen aggregation), §11.4 (cascade), §3.2 (source-of-truth principle — open months derive, never persist).

**Anti-patterns to avoid**
- Don't persist any derived value for an open month (§3.2). The cache is invalidatable; persistence is not.
- Don't compute Resumen on the frontend. Backend returns Resumen alongside the items.

**Done when:** Can navigate to any open month (past or future, within reasonable horizon) and see a complete view matching the source sheets. Editing a catalog item invalidates the relevant months' caches.

---

## 0.6.0 — Phase 4: Actuals + one-offs

**Goal:** Record what actually happened and allow ad-hoc items inside a month.

**Depends on:** `0.5.0`.

**Entities introduced:** `ActualEntry`, `OneOffItem`, `SavingsAdjustment`.

**Backend deliverables**
- Models in `months/`: `ActualEntry` (links a planned item to a month + actual amounts in all three currencies, paid/received flag), `OneOffItem` (free-form income/expense per month, with currency, category, amount_real), `SavingsAdjustment` (one per month, reconciles cost basis to market value).
- Endpoints:
  - `POST /v1/ledgers/{id}/months/{YYYY-MM}/actuals/` (mark paid with amounts).
  - `DELETE /v1/actuals/{id}/` (unmark).
  - `GET/POST/PATCH/DELETE /v1/ledgers/{id}/months/{YYYY-MM}/one-offs/`.
  - `POST /v1/ledgers/{id}/months/{YYYY-MM}/skip/{planned_item_id}/` with required `reason`.
  - `POST /v1/ledgers/{id}/months/{YYYY-MM}/move-to-next/{planned_item_id}/`.
- Resumen aggregation in `GET /v1/ledgers/{id}/months/{YYYY-MM}/` uses `actual ?? planned` per item.
- Pytest: every action's happy path + skipped-with-reason + per-item variance math.

**Frontend deliverables**
- Month view interactivity: checkbox per row → "Mark paid" modal (native `<dialog>`) with actual-amount fields per currency. Save persists, refreshes the row + Resumen.
- "Add one-off" button per category, opens a small form (currency picker, amount, description). Validates client-side; backend authoritative.
- "Skip" action requires a reason (textarea); contributes zero to totals after skip.
- Variance display: `(actual − planned)` in CLP per item, with color cue (only via Pico-friendly styling).

**Library decisions**
- Currency input: **native + composable** (per policy). Build `src/lib/currency-input.ts` that uses `Intl.NumberFormat` for display formatting and parses input back to a number. Three currencies share the composable; the unit comes from the row's catalog item.

**SPEC anchors:** §10.3 (item interactions), §10.4 (validation rules), §10.8 (Resumen substitution).

**Anti-patterns to avoid**
- Don't round actuals — they're real values (§9.1).
- Don't allow negative amounts via direct entry — only system-generated paths (TC adjustment, savings retirement) per §10.4.

**Done when:** Can mark a planned item paid with actual amounts; Resumen reflects actual; can add a one-off and see it in the right category; variance is visible per row; skipping an item requires a reason and contributes zero.

---

## 0.7.0 — Phase 5: Carry-over + deficit

**Goal:** Connect months into a cascade and surface deficits early.

**Depends on:** `0.6.0`.

**Entities introduced:** none — extends `MonthState` (`monto_en_cuenta_override`).

**Backend deliverables**
- Carry-over math in `months/cascade.py`:
  - `net_movement(month) = income − expenses − non_saving_provisions − savings_contributions` (raw per-item sums per §11.2).
  - `close_balance(month) = monto_en_cuenta(month) + net_movement(month)`.
  - `monto_en_cuenta(month+1) = MonthState(month+1).monto_en_cuenta_override ?? close_balance(month)`.
  - Signed throughout; negatives propagate.
- Endpoint: `PATCH /v1/ledgers/{id}/months/{YYYY-MM}/state/` to set `monto_en_cuenta_override`.
- Deficit detection in the month view response: a `deficit` block with `is_deficit: bool`, `amount: int`, `root_cause_month: str | null`. Walk backward from the deficit month to find the earliest month whose own actions caused the deficit (per §11.5).
- Rolling minimum across all open months (used by the dashboard later; expose as endpoint or include in ledger summary).
- Pytest: 12-month cascades, deficit walkback correctness (mid-horizon vs. immediate trigger), override behavior.

**Frontend deliverables**
- Month view: opening-balance row becomes editable (writes `monto_en_cuenta_override`). Inline edit with confirm.
- Deficit warning banner on every deficit month: "⚠ Déficit proyectado: -$X. Origen: <month_name>." with a link to the root-cause month.
- Surface rolling-minimum on the (placeholder) dashboard for now; full dashboard ships in `0.10.0`.

**Library decisions:** none new.

**SPEC anchors:** §11.2 (carry-over computation), §11.3 (close balance), §11.5 (deficit + root cause), §11.4 (cascade).

**Anti-patterns to avoid**
- Don't use Resumen-smoothed values for carry-over math (§11.2). Use raw per-item sums.
- Don't persist `close_balance` for open months — derive on demand. Persisting it bypasses the carry-over cascade.

**Done when:** Opening any future month shows the correct cumulative balance; setting an override on one month shifts all subsequent months; a deficit anywhere in the horizon displays the warning banner with a working link to the root-cause month.

---

## 0.8.0 — Phase 6: Month close + immutability

**Goal:** Freeze a month as a historical record; closed months become immutable snapshots.

**Depends on:** `0.7.0`.

**Entities introduced:** `MonthSnapshot`, `MonthSnapshotItem`.

**Backend deliverables**
- Models for `MonthSnapshot` (per-month) and `MonthSnapshotItem` (per-item-at-close). Snapshot captures: all planned + one-off items with final amounts, exchange rates at close time, `LedgerConfig` snapshot, Resumen totals, balance block values.
- `POST /v1/ledgers/{id}/months/{YYYY-MM}/close/`:
  - Validation phase: classify items as resolved or pending; return the dialog payload (Case A all resolved vs. Case B pending list).
  - Confirm phase: transactional. For each pending item, create a rollover `OneOffItem` in month+1 with `rollover_from_month`. Materialize the snapshot. Update `MonthState` (status=closed, closed_at, closed_by_user_id). Invalidate caches for months ≥ M+1.
- Server-side close lock: only one close operation per ledger at a time (DB `SELECT … FOR UPDATE` on the ledger row, or a Redis lock).
- Closed-month view: `GET /v1/ledgers/{id}/months/{YYYY-MM}/` reads exclusively from the snapshot, never derives.
- Post-close immutability: catalog edits, exchange-rate updates, and actuals changes do **not** affect the snapshot. Add a guard in the actuals/one-off endpoints that rejects writes against closed months.
- Pytest covers: close all-resolved, close with pending → rollover, snapshot immutability after upstream catalog edit, close lock contention.

**Frontend deliverables**
- "Cerrar mes" button on the earliest open month (only the earliest — others are disabled with a tooltip).
- Confirmation dialog (native `<dialog>`):
  - Case A: "Esta acción es permanente; una vez cerrado, no podrás re-abrir el mes."
  - Case B: list of pending items + "Para cerrar, se moverán al próximo mes como puntuales (rollover)."
- After confirm, the month transitions to read-only and renders from snapshot. Subsequent visits skip the cascade.

**Library decisions**
- Modal / dialog: **native `<dialog>`** (per policy).

**SPEC anchors:** §10.5 (month close — trigger, validation, confirmation, close phase, post-close immutability).

**Anti-patterns to avoid**
- Don't allow re-opening closed months. Amends (next phase) are the only modification path.
- Don't read derivation for closed months — even by accident. The snapshot is the source of truth.
- Don't let one user's close race with another's — the server-side lock is non-negotiable.

**Done when:** Closing a month with pending items moves them forward as one-offs; subsequent catalog edits leave the closed month unchanged; concurrent close attempts on the same ledger serialize correctly.

---

## 0.9.0 — Phase 7: Amend workflow

**Goal:** Provide a controlled mechanism to fix mistakes in the most recently closed month.

**Depends on:** `0.8.0`.

**Entities introduced:** none — extends `MonthSnapshot.audit_log` (JSON field or related model).

**Backend deliverables**
- `POST /v1/ledgers/{id}/months/{YYYY-MM}/amend/`:
  - Only allowed on the most recently closed month (any earlier returns 409).
  - Body specifies amendment type (correct actual, add missed payment, …) + required `reason`.
  - Applies the change to the snapshot, appends to `audit_log` (timestamp, user_id, before/after, reason).
  - Invalidates caches for months > M.
- Pytest covers: amend latest closed month succeeds, amend older closed month rejected, audit log integrity, downstream cache invalidation.

**Frontend deliverables**
- "Amend" button visible only on the most recently closed month. Opens a guided form (action picker + reason textarea).
- "Audit log" section at the bottom of every closed month view, sorted newest-first, each entry showing user + reason + before/after.

**Library decisions:** none new.

**SPEC anchors:** §10.6 (amend workflow).

**Anti-patterns to avoid**
- Don't allow amending older closed months — the cascading re-validation cost is the reason this constraint exists (§10.6). Use a compensating entry in the latest closed month instead.
- Don't silently update a snapshot. Every amend goes into the audit log with a required reason.

**Done when:** Can correct a mistake in the latest closed month with a required reason; an older closed month rejects amend attempts; downstream open months reflect the corrected carry-over.

---

## 0.10.0 — Phase 8: Dashboard

**Goal:** Provide a cross-month overview and natural entry point.

**Depends on:** `0.9.0`.

**Entities introduced:** none.

**Backend deliverables**
- `GET /v1/ledgers/{id}/dashboard/`: aggregate stats for the dashboard — current-month close projection, rolling minimum (over next 12 open months), accumulated savings (`Ahorro inicial`), and the 12-month timeline data points (`close_balance` per month).
- Pytest: dashboard payload across mixed open/closed months.

**Frontend deliverables**
- Route `/ledgers/:id` becomes the dashboard (currently a placeholder).
- Ledger selector at top (if user has multiple ledgers).
- Mini-stats cards: current-month close projection, rolling minimum (red if negative), accumulated savings.
- Timeline chart: 12-month close-balance line with rolling-minimum horizontal line and deficit-month markers.
- Quick links to current month, catalog editor, ledger settings.

**Library decisions**
- Charts: **`Chart.js`** (per policy). 12-month line chart with tooltips and a horizontal annotation for rolling minimum. Use `chart.js` + `vue-chartjs` for SFC integration.

**SPEC anchors:** §12 (dashboard).

**Anti-patterns to avoid**
- Don't compute timeline data on the frontend. Backend returns ready-to-plot points so caching applies once at the dashboard endpoint.

**Done when:** Opening a ledger lands on the dashboard; the 12-month outlook is correct vs. spot-checks against month views; clicking a chart point navigates to that month.

---

## 0.11.0 — Phase 9: Cross-ledger transfers

**Goal:** Model family-to-personal money movements as linked catalog items.

**Depends on:** `0.10.0`.

**Entities introduced:** `TransferLink`.

**Backend deliverables**
- `TransferLink` model: pairs two `CatalogItem`s (expense in ledger A, income in ledger B). Both items reference the same `transfer_link_id` (§7).
- Endpoints to link / unlink items.
- Revision propagation: a new revision on the source leg triggers a matching revision on the target leg with same `effective_from_month` + `amount_real`. Source leg edits offer to sync; unlinking ends propagation.
- Paid-on-one-side handler: marking the source paid returns a hint payload prompting the client to optionally mark the target received (same for the reverse).
- Pytest covers link creation, propagation across 3+ revisions, unlink behavior, paid-on-one-side prompts, independent variance tracking.

**Frontend deliverables**
- Catalog editor: "This is a transfer" checkbox when creating / editing an item. On enable, pick partner ledger + matching item (or create new).
- Link icon indicator on linked items in the catalog table.
- Sync prompt when editing a linked item's amount or fuente.
- Paid-on-one-side prompt in the month view's "Mark paid" modal.

**Library decisions:** none new.

**SPEC anchors:** §7 (cross-ledger transfers — model, behaviors, UI).

**Anti-patterns to avoid**
- Don't auto-link items by name match. Linking is an explicit user action (§7.2).
- Don't force amounts to stay synchronized after the user has unlinked or overridden — independent variances are by design.

**Done when:** Setting up a transfer between family and personal ledgers propagates revisions; both ledgers reconcile correctly when each side is marked paid independently; unlink stops propagation cleanly.

---

## 0.12.0 — Phase 10: Migration helper

**Goal:** Reduce manual work when onboarding from the source Google Sheets.

**Depends on:** `0.11.0`.

**Entities introduced:** none — `MigrationSession` is in-memory only.

**Backend deliverables**
- JSON import endpoint: `POST /v1/ledgers/{id}/import/`. Body schema documented in `docs/IMPORT-FORMAT.md` (added in this phase): catalog items (with embedded revisions), one-off entries, opening balance, ledger config.
- Server-side validation: every imported item passes §13.3.
- Consolidation suggestions endpoint: scan import payload for name patterns like `"Sueldo YYYY"`, suggest merging into one item with revisions.
- Validation flow endpoint: given a historical month from sheets, return the new system's derivation diff (per-item planned vs. expected).
- Pytest covers: round-trip a sample export, consolidation suggestion accuracy, validation diff format.

**Frontend deliverables**
- Migration wizard route `/ledgers/:id/migrate`:
  1. Paste / upload JSON (file input is native `<input type="file">`).
  2. Review consolidation suggestions — accept / edit / reject each.
  3. Set opening month + initial `monto_en_cuenta`.
  4. Configure `LedgerConfig` (rounding units, variation rates, surcharges).
  5. Invite partner (uses the email flow from `0.13.0` if landed, else the manual token flow from `0.2.0`).
  6. Validation step: pick a historical month from sheets, paste expected planned items, see diff.

**Library decisions:** none new.

**SPEC anchors:** §15 (migration from sheets), §15.2 (consolidation suggestions).

**Anti-patterns to avoid**
- Don't auto-accept consolidation suggestions. Every merge is a user decision.
- Don't import historical *month data* — the spec explicitly defers that. Only catalog + opening balance + ledger config land via import.

**Done when:** A real ledger can be migrated from a sheets export in under an hour; validation step surfaces discrepancies clearly; consolidation reduces multi-year items into single-item-with-revisions where appropriate.

---

## 0.13.0 — Phase 11: Polish + multi-user hardening

**Goal:** Make the app usable end-to-end by two non-technical users for their real budget.

**Depends on:** `0.12.0`.

**Entities introduced:** none — adds email-invite token TTL on existing invite model.

**Backend deliverables**
- Optimistic concurrency on shared resources (catalog item, revision, month state): use `updated_at` as an opaque "if-match" header; reject writes with a 409 + the latest server state when stale.
- Email-based invitation flow: SMTP or a transactional email provider (decide in this phase; **propose**: a free tier like Resend or a self-hosted Postfix on the VPS — recommend Resend for ops simplicity). Replaces manual token flow.
- Settings screen API per §14: general (name, archive), members, rounding overrides, approximations, variation rates, category budgets.
- Pytest covers: stale-write rejection, email-invite end-to-end, settings CRUD.

**Frontend deliverables**
- Apply optimistic UI everywhere shared edits happen: write locally first, reconcile on server response, surface stale-data warnings.
- Email invitation UX: enter email, send link; recipient lands on `/invites/:token/accept` with auto-prompt to sign up if not logged in.
- Responsive layout pass: every page works on a 360-wide viewport even if not mobile-first.
- Error / loading / empty states across the whole app — no `<pre>JSON</pre>` leaks.
- Settings page completeness per §14.
- Accessibility basics: `aria-*` where needed, keyboard navigation through forms, focus management on modals.

**Library decisions**
- E2E tests: **Playwright** (per policy). Add `npm run test:e2e` and a CI job. Cover: signup → create ledger → invite → catalog item with revisions → mark paid → close month → amend.

**SPEC anchors:** §4.3 (concurrency), §14 (ledger settings), §11 (general polish).

**Anti-patterns to avoid**
- Don't roll your own pessimistic locking. Last-write-wins per field + stale-data warning is the spec's posture.
- Don't ship Settings screen partial. §14 is finite — finish it in one pass.

**Done when:** Two non-technical users can run their real budget end-to-end (signup, ledger, catalog migration, daily-use flow, month close, amend), on desktop and a small viewport, in both `en` and `es-CL`, without help.

---

## 1.0.0 — Deployment (first production release)

**Goal:** Ship `modo-pato` to its production home and cut the first stable release.

**Depends on:** `0.13.0`.

**Entities introduced:** none.

**Execution — follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) phase by phase. Do not re-derive here.**

- **DEPLOYMENT.md Phase 1 (Manual Platform Setup):** Neon project, Hetzner VPS, Cloudflare Tunnel with `api.*` and `admin.*` hostnames, Cloudflare Access policy on `admin.*`, Cloudflare Pages for the frontend, R2 bucket + API token, GitHub Actions secrets.
- **DEPLOYMENT.md Phase 2 (VPS Provisioning):** `deploy` user, SSH hardening (port 2222), UFW, Docker, cloudflared (both hostnames in `config.yml`), rclone for R2, production `.env` (both subdomains in `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`), `docker-compose.prod.yml` with `backend` + `admin` services, backup cron.
- **DEPLOYMENT.md Phase 3 (Code Changes):** add `gunicorn` and `whitenoise` to backend deps; configure `STATIC_ROOT`, whitenoise middleware, and `CSRF_TRUSTED_ORIGINS` env support in `settings.py`; backend Dockerfile collectstatic + gunicorn CMD; `frontend/src/api.ts` API client (already present from `0.2.0` — confirm `VITE_API_BASE_URL` is wired); `.env.example` documents production vars.
- **DEPLOYMENT.md Phase 4 (GitHub Actions Backend Workflow):** `.github/workflows/deploy-backend.yml`. ARM64 build, push to GHCR, SCP `deploy/` files to VPS, SSH `docker compose pull && up -d`. Note: this is the *deploy* workflow; the *test-gating* workflow from `0.1.0` remains in place and is what `main` requires.
- **DEPLOYMENT.md Phase 5 (Verification):** API health on api subdomain, admin login challenged by Cloudflare Access, firewall closed except SSH, backup runs and a restore is tested.
- Tag `v1.0.0` in git; write the first `CHANGELOG.md` entry covering everything from `0.0.1` baseline through this release.

**Library decisions:** none new.

**SPEC anchors:** not in SPEC — operational rollout.

**Anti-patterns to avoid**
- Don't expose the admin subdomain without the Cloudflare Access policy in place. Validate `curl -I https://admin.modo-pato.rsantos.cl/` returns the Access challenge, not Django's login page directly.
- Don't run `manage.py migrate` from the deploy workflow without backing up first. Backups must succeed before any migration ships.
- Don't `--no-verify` or skip pre-deploy CI to "ship the v1." `main` is protected for a reason.

**Done when:** Frontend, API, and admin are all reachable on their respective subdomains; admin login requires Cloudflare Access; nightly backup runs and a restore has been tested end-to-end; `v1.0.0` is tagged and a CHANGELOG entry exists.
