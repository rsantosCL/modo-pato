# Modo Pato — Roadmap

`modo-pato` is a personal/family budget app replacing two Google Sheets: multi-user, multi-currency (CLP / CLF / USD), catalog-driven monthly projections with planned-vs-actual reconciliation. Stack: Django + DRF on the backend, Vue 3 + TypeScript + Pico.css on the frontend, PostgreSQL, all behind Cloudflare in production. This roadmap implements [`SPEC.md`](SPEC.md) step by step and ends with the production rollout described in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Versioning

The project is in 0.x while pre-production: no feature is user-facing yet. Each step bumps the **minor** version in lockstep across `backend` and `frontend`, so a single repo state always has one product version. `1.0.0` cuts at the first production deployment.

For per-phase implementation detail (backend / frontend file lists, library decisions, anti-patterns, done-when), see [`V1-IMPLEMENTATION-PLAN.md`](../V1-IMPLEMENTATION-PLAN.md). The design contract lives in [`SPEC.md`](SPEC.md).

---

## 0.0.1 — Baseline

Today's scaffolding, before any feature work:

- Django + DRF skeleton with one health endpoint at `/v1/health/`.
- Django admin runs as a **separate** Docker service on port 8001 (subdomain-isolated in production); api service runs on port 8000.
- Vue 3 + TypeScript SPA scaffold (Pico.css and Vue Router to be added in `0.2.0`).
- PostgreSQL 16 via `docker compose`.
- Intent-layer docs (`CLAUDE.md` at root + per-directory).

No domain models, no business logic, no UI beyond the title.

**SPEC refs:** — (pre-Phase 0)

---

## 0.1.0 — CI + branch protection

**Goal:** Gate every merge to `main` on passing tests before any feature work begins.

**Highlights**
- `pytest` + `pytest-django` set up on the backend with one smoke test (`GET /v1/health/`).
- Vitest + `@vue/test-utils` set up on the frontend with one smoke test mounting `App.vue`.
- GitHub Actions workflow (`.github/workflows/ci.yml`) runs both test jobs on every PR against `main`.
- Branch protection rule on `main`: require PR, require both status checks, block direct push (including admins).

**Exit criteria:** A PR that breaks any backend or frontend test cannot be merged; direct pushes to `main` are blocked for everyone.

**SPEC refs:** not in SPEC — operational requirement.

---

## 0.2.0 — Phase 0: Foundations (current)

**Goal:** Multi-user ledger access — sign in, create a ledger, invite a partner.

**Highlights**
- Database schema for `User`, `Ledger`, `LedgerMember`.
- Auth (sign up, sign in, sessions / JWT).
- Skeleton API for ledger CRUD and manual member invite/accept.
- Skeleton UI: ledger list, ledger create/edit, member management.
- Bilingual UI scaffolding (en + es-CL) via vue-i18n; locale-aware number/date formatting from day 1.

**Exit criteria:** Can create a ledger as User A, invite User B, both log in and see the shared ledger.

**SPEC refs:** §4 (multi-user model), §5.1 (User, Ledger, LedgerMember).

---

## 0.3.0 — Phase 1: Catalog kernel

**Goal:** Build the foundation for all recurring items.

**Highlights**
- Full `CatalogItem` + `CatalogItemRevision` CRUD with all validations from §13.3.
- Catalog editor UI with inline editing.
- Revision workflow UI: add / edit / view history; immutable revisions.
- No month views yet — focus is the catalog data layer.

**Exit criteria:** Can enter all catalog items from the source sheets, including multi-revision items like "Sueldo" (2025 / 2026 / 2027 in one item).

**SPEC refs:** §5.1 (CatalogItem entities), §13 (catalog editor), §13.5 (revisions).

---

## 0.4.0 — Phase 2: Catalog query + currency engine

**Goal:** Implement the mathematical core: derive planned items for any month, with currency conversion and rounding.

**Highlights**
- Catalog query algorithm (§8) as a pure function: `(ledgerId, month, items, revisions) → PlannedItem[]`.
- Exchange rate model with mindicador.cl daily fetch + manual override fallback.
- Future-month rate projection via configurable monthly variation.
- Rounding engine (§9): direction-aware, applied only in CLP after conversion, never to real values.
- Test suite covers Appendix B worked example plus prepago, installment exhaustion, valid_months, revision selection.

**Exit criteria:** A CLI or admin endpoint can request "what does month X look like?" and produce planned items matching the source sheets exactly.

**SPEC refs:** §6 (currency), §8 (catalog query), §9 (rounding), Appendix B (worked example).

---

## 0.5.0 — Phase 3: Month view (read-only)

**Goal:** Render a complete derived month view for any open month.

**Highlights**
- Month view UI (§10.1): header, balance block, card payments block, Real vs Ideal, Resumen, four category tables.
- All values derived on demand — open months are never persisted as source of truth.
- Cascade computation (§11.4): visiting month N triggers derivation of all prior open months in order.
- Caching with `catalog_version` keying; cache invalidates on upstream writes.

**Exit criteria:** Can navigate to any open month and see a complete, accurate view that matches the source sheets.

**SPEC refs:** §10.1 (layout), §11.4 (cascade), §3.2 (source of truth).

---

## 0.6.0 — Phase 4: Actuals + one-offs

**Goal:** Record what actually happened and allow ad-hoc items inside a month.

**Highlights**
- `ActualEntry` model with "mark paid" workflow (§10.3).
- `OneOffItem` CRUD inline within the month view; supports CLP / CLF / USD.
- Per-item variance display (actual − planned in CLP).
- Resumen substitution: use actual ?? planned.
- Skipped items with required reason (§10.4).

**Exit criteria:** Can mark items paid with actual amounts; Resumen reflects actuals; variances are visible per item.

**SPEC refs:** §10.3 (item interactions), §10.4 (validation rules).

---

## 0.7.0 — Phase 5: Carry-over + deficit

**Goal:** Connect months into a cascade and surface deficits early.

**Highlights**
- Net movement and close balance computed per month (§11.2, §11.3).
- Carry-over to next month, with manual override (`monto_en_cuenta_override`) on opening balance.
- Deficit detection with root-cause walkback to the earliest triggering month.
- Rolling minimum balance across the open horizon, surfaced on the dashboard.

**Exit criteria:** Opening any future month shows correct cumulative balance and deficit warnings.

**SPEC refs:** §11.2, §11.3, §11.5.

---

## 0.8.0 — Phase 6: Month close + immutability

**Goal:** Freeze a month as a historical record; closed months become immutable snapshots.

**Highlights**
- Close workflow (§10.5): validation phase, confirmation dialog, all-or-nothing pending-item rollover to month+1.
- `MonthSnapshot` materializes plan + actuals + Resumen + exchange rates + ledger config at close time.
- Closed month rendering reads exclusively from the snapshot, not from derivation.
- Server-side close lock prevents concurrent close operations.
- Subsequent catalog edits never retroactively change a closed month.

**Exit criteria:** Can close a month; subsequent catalog edits don't affect the closed month.

**SPEC refs:** §10.5 (month close), §3.2 (immutability principle).

---

## 0.9.0 — Phase 7: Amend workflow

**Goal:** Provide a controlled mechanism to fix mistakes in the most recently closed month.

**Highlights**
- Amend UI on the most recently closed month only (older closes stay read-only).
- Audit log on `MonthSnapshot` records each amendment: timestamp, user, before/after, required reason.
- Downstream open-month caches invalidate after amend; carry-overs recompute.

**Exit criteria:** Can correct a mistake in a closed month with a required reason; downstream months reflect the corrected carry-over.

**SPEC refs:** §10.6 (amend workflow).

---

## 0.10.0 — Phase 8: Dashboard

**Goal:** Provide a cross-month overview and natural entry point.

**Highlights**
- Dashboard layout (§12): ledger selector, mini-stats, timeline chart, deficit indicators.
- 12-month close-balance timeline with rolling-minimum line and deficit markers.
- Quick links to current month view, catalog editor, ledger settings.

**Exit criteria:** The dashboard is the natural entry point and shows the 12-month outlook at a glance.

**SPEC refs:** §12 (dashboard).

---

## 0.11.0 — Phase 9: Cross-ledger transfers

**Goal:** Model family-to-personal money movements as linked catalog items.

**Highlights**
- `TransferLink` model joining an expense item in one ledger to an income item in another (§7).
- Catalog editor "This is a transfer" workflow: pick partner ledger, link or create matching item.
- Synchronized amount propagation by default; "unlink" action to detach.
- Paid-on-one-side prompt: marking one leg paid offers to mark the other.

**Exit criteria:** Can set up a transfer between family and personal ledgers; amount changes propagate; both ledgers reconcile correctly.

**SPEC refs:** §7 (cross-ledger transfers).

---

## 0.12.0 — Phase 10: Migration helper

**Goal:** Reduce manual work when onboarding from the source Google Sheets.

**Highlights**
- JSON import format spec for catalog items and one-off entries.
- Migration wizard UI (§15): step-by-step import, set opening month + initial balance, configure ledger settings, invite partner.
- Consolidation suggestions: detect multi-year items (e.g. "Sueldo 2025"/"2026") and offer to merge into one item with revisions.
- Validation flow: pick a historical month from sheets and diff against the new derivation.

**Exit criteria:** Can migrate a real ledger from a sheets export in under an hour, with discrepancies surfaced for review.

**SPEC refs:** §15 (migration from sheets).

---

## 0.13.0 — Phase 11: Polish + multi-user hardening

**Goal:** Make the app usable end-to-end by two non-technical users for their real budget.

**Highlights**
- Concurrent edit handling: optimistic UI, last-write-wins reconciliation, stale-data warnings (§4.3).
- Email-based invitation flow replaces the manual invite of Phase 0.
- Responsive layout (mobile-friendly, even if not mobile-first).
- Comprehensive error / loading / empty states across the app.
- Settings screen completeness (§14): general, members, rounding overrides, approximations, variation rates, category budgets.

**Exit criteria:** The app is usable end-to-end by two non-technical users for their real budget.

**SPEC refs:** §4.3 (concurrency), §14 (ledger settings).

---

## 1.0.0 — Deployment (first production release)

**Goal:** Ship `modo-pato` to its production home and cut the first stable release.

**Highlights**
- Hetzner CAX11 VPS (ARM) provisioned and hardened per [`DEPLOYMENT.md`](DEPLOYMENT.md) Phase 2.
- Cloudflare Tunnel routes `api.modo-pato.rsantos.cl` → port 8000 and `admin.modo-pato.rsantos.cl` → port 8001.
- Cloudflare Pages auto-deploys the frontend on push to `main`; `admin.*` is gated by Cloudflare Access (operator email only).
- GitHub Actions workflow builds an ARM64 backend image and rolls out both services (`backend`, `admin`) via SSH.
- Neon Postgres in `us-east-1`; nightly `pg_dump` → Cloudflare R2 with 30-day rolling retention and monthly snapshots.
- Tag `v1.0.0`; write the first CHANGELOG entry.

**Exit criteria:** Frontend, API, and admin are all reachable on their respective subdomains; admin login requires Cloudflare Access auth; nightly backup runs and a restore has been tested end-to-end.

**Deployment refs:** [`DEPLOYMENT.md`](DEPLOYMENT.md) Phase 1 (platform setup), Phase 2 (VPS provisioning), Phase 3 (code changes), Phase 4 (GitHub Actions), Phase 5 (verification).

---

For implementation details and per-step file checklists, see [`V1-IMPLEMENTATION-PLAN.md`](../V1-IMPLEMENTATION-PLAN.md). For the design rationale behind any phase, follow the SPEC anchors back into [`SPEC.md`](SPEC.md).
