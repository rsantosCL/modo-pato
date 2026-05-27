# Budget App — Functional Specification

**Migration target:** Two Google Sheets (Family + Personal budgets) → multi-user web app
**Status:** Draft v1.9
**Audience:** Self-build (developer-ready spec)

> **Localization note:** All entity names, field names, enum values, log messages, and code identifiers in this spec are in **English**. They are the canonical names used in code and data. **User-facing text must be translatable**, with Spanish as a first-class supported language. For example, a derived item named in this spec as `"<Name> (prepago)"` is illustrative only — the actual user-visible string would be `"<Name> (pay off)"` in English or `"<Name> (prepago)"` in Spanish, resolved at render time via the app's i18n layer. Specific copy, key naming conventions, pluralization rules, and locale-formatting (numbers, dates, currency) are deferred to implementation time. Source-of-truth dates and numbers are always stored in unambiguous formats (ISO 8601 dates, plain decimals); locale formatting is applied only at the presentation layer.

---

## 1. Background & Goals

### 1.1 What the sheets do today

Two Google Sheets implement a budget system with the following characteristics:

- **Catalog-driven recurring items.** Each ledger (family, personal) has four catalogs: Ingresos, Gastos esenciales, Gastos variables, Previsión. Each catalog item describes a recurring movement with metadata for amount, currency, frequency, start month, end month, installment count, prepaid installments, and which months of the year it applies to.
- **Per-month sheets** generated from the catalogs via `QUERY` formulas, showing the planned tables and a Resumen.
- **One-off items** added directly to the month sheets for unplanned income/expense.
- **Multi-currency** support: CLP (Chilean peso), CLF (Unidad de Fomento, shown to Spanish users as "UF"), USD.
- **Manual reconciliation** of variances via `Ajuste` rows when actuals differ from rounded plans.
- **Cross-ledger transfers** (e.g. family transfers money to personal account) tracked as mirrored manual entries.

### 1.2 Goals of the new app

1. Preserve every automation in the sheets (catalog-driven monthly projection, currency conversion, installment tracking, prepago, validity windows).
2. Make the rounded-plan / actual-payment distinction first-class (eliminate the noisy `Ajuste` workaround).
3. Support multi-user collaboration: family ledger shared with partner, personal ledgers private.
4. Provide on-demand multi-month forecasting that always reflects the current catalog state.
5. Treat closed months as immutable historical records.
6. Surface deficits early through clear warnings, while remaining conservative-by-default.
7. Allow catalog items to evolve over time (e.g. salary raises) without losing historical accuracy or proliferating annual variants like "Sueldo 2025", "Sueldo 2026".

### 1.3 Non-goals

- Bank integration / automatic transaction import (everything stays manual entry).
- Investment tracking / portfolio analysis.
- Tax reporting.
- Importing historical month data from the sheets (spec assumes a fresh start; catalogs are re-entered).

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Ledger** | A budget container. Each ledger has its own catalogs, monthly views, and configuration. Examples: "Familia", "Ricardo personal", "Eve personal". |
| **Catalog** | A list of recurring items in a ledger, partitioned into four categories. |
| **Catalog item** | A recurring income/expense definition (e.g. "Sueldo", "Combustible", "Seguro auto"). |
| **Categories** | Each item belongs to exactly one of four categories. The category captures both *what the item is* and *how disposable it is*. The four categories form a priority order: in a tight month, the user removes or cuts items starting from the bottom of this list and working up — provision first, then variable, then essential. Income is never an expense; it has its own category. |
| ・ **income** | Money coming in (salary, dividends, bonuses, refunds). Rounded down (conservative). |
| ・ **essential** | Mandatory expenses that cannot be removed — only reduced. Rent, utilities, groceries, insurance, debt payments. The user can shop around for a cheaper provider, but cannot simply stop paying. Rounded up. |
| ・ **variable** | Discretionary expenses that are desirable but not required. Gym, subscriptions, dining out, hobbies. The user *could* live without these, and they're the second to be cut after provision. Rounded up. |
| ・ **provision** | Forward-looking allocations: savings, investments, planned future expenses. Not strictly an expense, but treated as one because the money is committed-out of available cash. **First to be analyzed for cuts in a rough month** — reducing savings or pausing investments is preferable to cutting variable expenses, which is preferable to cutting essentials. Rounded up. Items in this category may carry `is_saving = true` to mark them as savings (vs. provisional expenses like insurance). |
| **One-off item** | An income/expense recorded directly into a single month, not derived from the catalog. |
| **Planned item** | A row in a monthly view, either derived from a catalog item or a one-off. Has a planned amount (rounded) and optionally an actual amount. |
| **Month view** | The reconciliation surface for a specific year-month. Lists planned items + one-offs, grouped by category, with a Resumen and balance block. |
| **Closed month** | A month view that has been finalized; its data is frozen and no longer derived. |
| **Open month** | Any month that is not closed (typically the current month and all future months). |
| **Rounding** | Direction-aware conversion of a real amount to a planned amount: incomes round down, expenses and provisions round up. |
| **Variance** | `actual − planned` for an item, signed. Aggregated to category and month level. |
| **Carry-over** | The signed close balance of a month, flowing into the next month's opening `Monto en cuenta`. |
| **Catalog query** | The logical operation that, for a given month, returns the catalog items that apply to that month. Replaces the sheets' `QUERY` formulas. |
| **CLP / CLF / USD** | Currencies. CLF = Unidad de Fomento (displayed to Spanish users as "UF"). See §6 for details. |
| **Fuente** | Payment source. Two values: `CA$H` (debit/cash) and `TC` (credit card). |

---

## 3. Architecture overview

### 3.1 Multi-tenancy

- **Users** authenticate to the app individually.
- **Ledgers** belong to one or more users (sharing model in §4).
- Each user has their own personal ledger (private). They may also be a member of one or more shared ledgers (typically one "Familia" ledger shared with their partner).

### 3.2 Source of truth vs derived views

Per ledger:

- **Catalogs**, **closed months** (snapshots), **one-off items**, and **actuals overlay** are persisted source of truth.
- **Open month views** (planned tables for current and future months) are **derived on demand** from the catalog. They are not stored as primary data. They may be cached, but the cache is an implementation detail and must invalidate whenever upstream data changes.

### 3.3 Stack suggestion (not prescriptive)

The spec is framework-agnostic. A reasonable starting stack:

- Frontend: React + TypeScript, TanStack Query for derived-view caching.
- Backend: Node.js or Python with a typed API (tRPC, GraphQL, or OpenAPI).
- DB: PostgreSQL (suited to the multi-tenancy, transactional integrity, and JSON requirements).
- Currency rates: scheduled fetch from mindicador.cl.
- Auth: Auth0 / Clerk / Supabase Auth / Lucia — anything that supports email + sharing invitations.

---

## 4. Multi-user model

### 4.1 Roles

- **Owner** — the user who created the ledger. Can rename, delete, manage members, archive, and edit data.
- **Editor** — invited collaborator with read/write access to the ledger's data (catalogs, actuals, one-offs, close). Cannot manage members or delete the ledger.
- **Viewer** — invited collaborator with read-only access. Can view all months, dashboard, catalog, and configuration, but cannot make any changes.

The role is set per (ledger, user) pair.

### 4.2 Sharing

- A ledger owner can invite other users (by email) as members, specifying the role (editor or viewer) at invite time.
- Invited users receive an in-app or email invitation; they accept to gain access.
- The owner can change a member's role or revoke access at any time.
- Personal ledgers are not shared by default. Owners can technically share them but the UI should not encourage it.
- A user is **not required to have a personal ledger**. Some users may only participate in shared ledgers (e.g. a partner who only uses the family ledger). The dashboard and onboarding flow must not assume a personal ledger exists.

### 4.3 Concurrency

- Multiple members may edit a shared ledger simultaneously.
- The system must handle concurrent writes without data loss. Recommended approach:
  - Optimistic UI with server-authoritative reconciliation.
  - Last-write-wins for individual fields, with a "stale data" warning if two users edit the same field within a short window.
- Closing a month is a special action that requires a server-side lock: only one close operation can proceed at a time per ledger.

---

## 5. Domain model

The model is described as logical entities; mapping to DB tables is left to implementation.

> **Date precision note:** Fields described in this spec as a "month" (e.g. `start_month`, `end_month`, `month` on MonthState, `effective_from_month`, `prepago_month`, `rollover_from_month`) represent a specific **year-month**, not a date. They have month-level precision only — there is no concept of "day within the month" for any of these. Implementations are free to represent them in storage as: (a) an integer like `202604` for April 2026, (b) a tuple of `(year, month)`, (c) a date with day fixed to 01 (the convention used in the original sheets, and acceptable here too), or (d) a `YearMonth`/`java.time.YearMonth`-style type if the language supports it. Whatever the representation, the spec's logical semantics are year-month only. All comparisons (`<=`, `>=`, equality) are month-level.

### 5.1 Entities

#### User

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| email | string, unique | |
| display_name | string | |
| created_at | timestamp | |

#### Ledger

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | e.g. "Familia", "Ricardo personal" |
| owner_user_id | UUID | FK to User |
| kind | enum: `shared` \| `personal` | UI hint; doesn't affect logic |
| config | LedgerConfig | embedded, see §5.2 |
| created_at | timestamp | |
| archived_at | timestamp? | soft delete |

#### LedgerMember

| Field | Type | Notes |
|---|---|---|
| ledger_id | UUID | |
| user_id | UUID | |
| role | enum: `owner` \| `editor` \| `viewer` | |
| invited_at, joined_at | timestamps | |

PK: (ledger_id, user_id).

#### CatalogItem

A catalog item describes the **identity** and **structure** of a recurring movement. Time-varying values (amount, payment source) live in a separate `CatalogItemRevision` table. Several fields that appeared in the source sheets (`end_month`, `prepaid_installments`, `valid_months`) are **derived at runtime** from the stored fields, not persisted — see §5.1.1.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| ledger_id | UUID | |
| category | enum: `income` \| `essential` \| `variable` \| `provision` | Stored as English; UI translates: `ingreso/esencial/variable/previsión` in Spanish. The four categories form a priority order for budget cuts: provision → variable → essential (essential is the last to be touched). See glossary for full semantics. |
| name | string | "Salary", "Combustible", etc. User-facing; not translated by the app. Stable across revisions. |
| currency | enum: `CLP` \| `CLF` \| `USD` | currency is part of the item's identity; changing it is rare and treated as creating a new item |
| frequency | enum: `M` \| `Q` \| `H` \| `Y` \| `CUSTOM` | monthly / quarterly / half-yearly / yearly / custom. For `CUSTOM`, `custom_months` must be set. |
| custom_months | int[1..12]? | only set when `frequency = CUSTOM`. Subset of {1..12} listing which months in the year apply. Null for all other frequencies. |
| start_month | year-month | "Mes inicial" — both the schedule anchor (for canonical frequencies) and the lower bound for inclusion. |
| total_installments | integer \| null | null = ∞; "Repeticiones"/"Cuotas". Counts only installments that fall on active months (per the derived `valid_months`). |
| prepago_month | year-month? | month in which any remaining installments are paid in advance; "Mes prepago" |
| is_saving | boolean | only meaningful when category=`provision` |
| transfer_link_id | UUID? | if non-null, this item is one leg of a cross-ledger transfer (§7) |
| created_at, updated_at | timestamps | |

A catalog item that is no longer relevant (e.g. a subscription you canceled) is handled by setting an appropriate `total_installments` so its derived `end_month` lands at the last applicable month. Closed snapshots already retain the historical record. There is no separate `archived` flag.

##### 5.1.1 Derived fields on CatalogItem

These three fields appeared in the original sheets but are **not stored** in the new app — they are computed from the stored fields and the active revision. They are exposed by the API and the catalog editor UI for verification purposes.

**`valid_months`** — the set of month-of-year (1..12) values when this item applies.

```
valid_months(item) =
  item.frequency == M       → {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}
  item.frequency == Q       → { m(item.start_month), m(item.start_month + 3), m(item.start_month + 6), m(item.start_month + 9) }
  item.frequency == H       → { m(item.start_month), m(item.start_month + 6) }
  item.frequency == Y       → { m(item.start_month) }
  item.frequency == CUSTOM  → item.custom_months
```
where `m(x)` is the month number of year-month `x`, and addition is month arithmetic.

**`end_month`** — the last year-month this item applies to.

```
end_month(item) =
  item.total_installments == null  → ∞ (sentinel like 3000-01)
  otherwise                        → the year-month M such that exactly `total_installments`
                                     months satisfy "M' >= start_month AND m(M') ∈ valid_months",
                                     for M' iterated forward from start_month.
```
In closed-form for canonical frequencies: `end_month = start_month + ((total_installments − 1) × step_months)` where `step_months` is 1 (M), 3 (Q), 6 (H), or 12 (Y). For CUSTOM, walk forward until `total_installments` valid months have been counted.

**`prepaid_installments`** — number of installments considered already paid before the prepago happens. Used as a helper in §8.3 to compute the prepago combined amount.

```
prepaid_installments(item) =
  item.prepago_month == null  → 0
  otherwise                   → the number of months between start_month (inclusive) and prepago_month (exclusive) that fall on valid_months
```

These derivations are pure functions of stored fields and cheap to compute. Implementations may memoize them per item; cache invalidation follows the same `catalog_version` rule (§11.4) since changing any stored field on the item or its revisions can affect them.

#### CatalogItemRevision

Time-versioned values for a catalog item. Each revision is effective from a given month onwards until superseded by the next revision.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| catalog_item_id | UUID | |
| effective_from_month | year-month | this revision applies to months ≥ this value, until the next revision |
| amount_real | decimal | un-rounded native-currency amount |
| fuente | enum: `CASH` \| `TC` | payment source |
| note | string? | optional context, e.g. "Aumento salarial 2026" |
| created_at | timestamp | |
| created_by_user_id | UUID | |

Constraints:

- Each catalog item must have **at least one revision** with `effective_from_month <= start_month`.
- `effective_from_month` is unique per `catalog_item_id`.
- Revisions are immutable after creation. To change a past revision, the user creates a new revision or uses the amend workflow on the affected closed months.

**Revision resolution for month M:** the active revision is the one with the maximum `effective_from_month` that is ≤ M. If no such revision exists (M is before any revision), the item is invalid for that month and skipped.

#### MonthState

Tracks per-month metadata: open vs closed, and any month-level user inputs.

| Field | Type | Notes |
|---|---|---|
| ledger_id | UUID | |
| month | year-month | |
| status | enum: `open` \| `closed` | |
| closed_at | timestamp? | |
| closed_by_user_id | UUID? | |
| monto_en_cuenta_override | decimal? | optional manual override of the calculated cash-on-hand |
| notes | text? | user notes on the month. **Editable at any time**, including after the month is closed. Notes are not part of the immutability boundary — they're a free-form annotation and editing them does not require the amend workflow. |

PK: (ledger_id, month).

The row exists once a user has interacted with that month (added a one-off, marked something paid, or closed it). For untouched future months, no row exists.

#### ActualEntry

Overlay records that hold per-item status for items in open months. When a month closes, these are folded into MonthSnapshotItem (§5.1) and the ActualEntry rows for that month may be retained or moved into the snapshot, per implementation choice.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| ledger_id | UUID | |
| month | year-month | |
| catalog_item_id | UUID | which catalog item this actualizes |
| actual_amount_original | decimal? | in the item's native currency. Required when `paid = true`; must be > 0. |
| actual_amount_clp | decimal? | converted using the month's CLP rate, computed at write time |
| paid | boolean | "paid" / "received" flag |
| paid_at | timestamp? | when marked paid |
| skipped | boolean | mutually exclusive with `paid` (§10.4) |
| skip_reason | string? | required when `skipped = true` |
| created_at, updated_at | timestamps | |

Constraints:
- `paid` cannot be true unless `actual_amount_original` is non-null and **strictly positive**.
- `skipped` cannot be true unless `skip_reason` is non-empty.
- `paid` and `skipped` cannot both be true.

#### OneOffItem

One-off entries: income or expense added directly into a month, not derived from the catalog.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| ledger_id | UUID | |
| month | year-month | |
| category | enum: same as CatalogItem | |
| name | string | |
| original_amount | decimal | the user-entered Original in native currency. Never rounded. |
| planned_amount_clp | decimal | the Planificado in CLP. Auto-derived from `original_amount` via the rounding rule (§9), unless overridden — see `planned_override_clp` below. |
| planned_override_clp | decimal? | if non-null, this value is used as Planificado instead of the auto-rounded result. Set when the user explicitly types a Planificado that differs from auto-rounding. |
| actual_amount_original | decimal? | what the user actually paid, in native currency. Never rounded. |
| actual_amount_clp | decimal? | conversion of `actual_amount_original` at the month's rate. |
| currency | enum: `CLP` \| `CLF` \| `USD` | |
| fuente | enum: `CASH` \| `TC` | |
| paid | boolean | |
| skipped | boolean | mutually exclusive with `paid` (§10.4) |
| skip_reason | string? | required when `skipped = true` |
| is_saving | boolean | only meaningful when `category = provision`. Mirrors the same flag on `CatalogItem`. Default false; set true automatically for savings retirements. |
| tc_adjustment | boolean | true if this one-off was system-generated by the "Pay credit card" action (§10.3 → "Pay credit card"). When true, the entry may have a negative `original_amount` and `actual_amount_*`. |
| savings_retirement | boolean | true if this one-off was created by the "Retire from savings" action (§10.3 → "Retire from savings"). When true, the entry has a negative `original_amount`, `category = provision`, and `is_saving = true`. |
| rollover_from_month | year-month? | if non-null, this one-off is a rollover of a pending item from a prior month (§10.5) |
| rollover_source | jsonb? | snapshot of where this came from (catalog item id, original name, etc.) for audit |
| created_at, updated_at | timestamps | |

The effective Planificado is `planned_override_clp ?? planned_amount_clp`. Rollover one-offs may have `original_amount` null (since they carry the original Planificado, not a real amount); in that case the rollover code should set `planned_override_clp` directly to preserve the carried-over Planificado.

A OneOffItem may have **at most one** of `tc_adjustment`, `savings_retirement`, or `rollover_from_month` non-null/true — these are the three named, structured one-off types, mutually exclusive with each other and with regular user-created one-offs (which have all three flags falsy/null).

#### MonthSnapshot

Created when a month is closed. The frozen, fully-materialized record of that month.

| Field | Type | Notes |
|---|---|---|
| ledger_id | UUID | |
| month | year-month | |
| closed_at | timestamp | |
| closed_by_user_id | UUID | |
| exchange_rates | jsonb | the rates used: `{ CLF: 39955.0, USD: 870.0 }` |
| ledger_config_snapshot | jsonb | rounding rules at close time (in case ledger config changes later) |
| items | MonthSnapshotItem[] | every planned and one-off item with planned + actual amounts |
| savings_adjustment | jsonb? | snapshot of the `SavingsAdjustment` (if any) for this month: `{ asserted_total_clp, delta_clp, note, created_at, created_by_user_id }` |
| resumen | jsonb | computed totals per category |
| balance | jsonb | `monto_en_cuenta`, `ahorro_inicial`, `ahorro_presupuestado`, `remanente_estimado`, all materialized |
| audit_log | MonthAmendment[] | empty at close; populated by amend workflow (§10.6) |

PK: (ledger_id, month). One snapshot per closed month.

#### MonthSnapshotItem

| Field | Type | Notes |
|---|---|---|
| snapshot_id | (ledger_id, month) | |
| source | enum: `catalog` \| `oneoff` \| `rollover` | |
| source_id | UUID | catalog_item_id or one_off_item_id |
| name, category, currency, fuente | denormalized for immutability | |
| planned_amount_original, planned_amount_clp | decimal | |
| actual_amount_original, actual_amount_clp | decimal? | |
| paid | boolean | |
| is_saving | boolean | |
| installment_index | integer? | for catalog items: which installment this was (1, 2, ..., total) |

#### SavingsAdjustment

A user assertion about the current value of their accumulated savings. Used to record market gains, losses, interest, or any change in savings value that isn't a contribution (a paid `is_saving` item) or a retirement (a `savings_retirement` one-off). See §10.3 → "Adjust savings" for the user flow.

A SavingsAdjustment is **not** an item — it doesn't appear in category tables, doesn't have a planned/actual distinction, doesn't have a Paid/Pending status, and doesn't contribute to Resumen totals or month close balance math. It only affects the running `Ahorro inicial` calculation (§10.2, §11.2.1).

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| ledger_id | UUID | |
| month | year-month | at most one SavingsAdjustment per (ledger, month) |
| asserted_total_clp | decimal | the new total savings balance the user stated, in CLP. May be zero. May not be negative. |
| delta_clp | decimal | computed at write time: `asserted_total_clp − Ahorro_inicial_before_this_adjustment`. Signed: positive = gain, negative = loss. Stored for snapshot/audit purposes (it can be re-derived but it's convenient and immutable once written). |
| note | string? | optional free-text reason ("Ganancia trimestre Fintual", "Pérdida mercado", "Intereses Banco Estado") |
| created_at | timestamp | |
| created_by_user_id | UUID | |

PK: (ledger_id, month).

Constraints:

- `asserted_total_clp >= 0`. The user cannot assert negative total savings.
- Editable only while the month is open. On close, the adjustment is materialized into `MonthSnapshot.savings_adjustment` (see below) and the row may be retained or moved into the snapshot.
- When edited, `delta_clp` is recomputed against the same prior `Ahorro inicial` (i.e. the value just before this adjustment, computed by excluding this row from the running sum).
- Deletable only while the month is open.

#### TransferLink

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| source_ledger_id, source_catalog_item_id | UUID | the "from" leg (an expense) |
| target_ledger_id, target_catalog_item_id | UUID | the "to" leg (an income) |
| created_at | timestamp | |

See §7 for the transfer model.

#### ExchangeRate

| Field | Type | Notes |
|---|---|---|
| month | year-month | |
| currency | enum: `CLF` \| `USD` | |
| clp_value | decimal | how many CLP equal 1 unit |
| source | enum: `api` \| `manual` | |
| fetched_at | timestamp | |

PK: (month, currency).

### 5.2 LedgerConfig

Embedded on Ledger. Captures rounding rules, exchange-rate adjustments, and forecasting variation.

```jsonc
{
  // Rounding units, in CLP. Applied AFTER currency conversion (see §9).
  // - "income":  unit for rounding income amounts DOWN (floor)
  // - "expense": unit for rounding expense and provision amounts UP (ceil)
  // - "minimum": unit for smoothing Resumen category subtotals (§10.x);
  //              direction is category-aware (incomes floor, others ceil)
  "approximations": {
    "income":  50000,   // round incomes down to nearest $50,000 CLP
    "expense": 30000,   // round expenses & provisions up to nearest $30,000 CLP
    "minimum": 10000    // smoothing unit for Resumen subtotals
  },

  // Monthly variation rates (decimal: 0.004 = 0.4%).
  // Used to project future months' exchange rates when no API data is available.
  "monthly_variation": {
    "CLF": 0.004,
    "USD": 0.0
  },

  // Bank surcharge added on top of API exchange rates (CLP per unit of foreign currency).
  // Reflects real-world cost of foreign purchases on Chilean credit cards.
  "exchange_surcharges": {
    "USD": 30,    // +$30 CLP per USD
    "CLF": 0
  }
}
```

System defaults (defined in code; used when ledger overrides are null):

```jsonc
{
  "approximations":     { "income": 50000, "expense": 30000, "minimum": 10000 },
  "monthly_variation":  { "CLF": 0.004, "USD": 0.0 },
  "exchange_surcharges":{ "USD": 30, "CLF": 0 }
}
```

Rationale for these three groups:

- **`approximations`** — three rounding units in CLP. `income` and `expense` are the per-item planned-amount rounding units (§9). `minimum` is a separate smoothing unit applied to Resumen category subtotals (§10.x) to keep the headline totals on clean boundaries even when actuals (which are never rounded) drag a sum onto a fractional value.
- **`monthly_variation`** projects exchange rates beyond the latest API data (§6.3).
- **`exchange_surcharges`** accounts for real-world bank fees on foreign purchases (§6.3).

Direction of `income` vs `expense` rounding is hardcoded by category: `income` rounds DOWN, `essential` / `variable` / `provision` round UP. The `minimum` smoothing follows the same direction rule. This is the conservative-by-default principle and is not configurable per item or per ledger.

---

## 6. Currency

### 6.1 Supported currencies

`CLP`, `CLF`, `USD`. CLP is the base; CLF and USD are foreign currencies converted to CLP for all aggregation.

### 6.2 CLF vs UF terminology

- **`CLF`** is the canonical currency code used everywhere in code, data, enums, and API contracts. This matches the ISO-4217-style code used in the original sheets.
- **`UF`** (Unidad de Fomento) is the human-readable label shown to users in the Spanish-language UI. In other locales, the UI may show `CLF` directly or another label as appropriate.
- The mapping is purely a display concern; **`CLF` and `UF` refer to the same currency**.

### 6.3 Exchange rates

#### Sources

- **Primary:** `mindicador.cl` (free, no auth required). Endpoints:
  - `https://mindicador.cl/api/uf/<dd-mm-yyyy>` for UF (canonical: CLF)
  - `https://mindicador.cl/api/dolar/<dd-mm-yyyy>` for USD
- **Fallback:** manual entry by user.

#### Bank surcharge for USD

Real-world USD purchases on Chilean credit cards typically cost more than the published exchange rate due to bank fees, foreign-transaction surcharges, and spread. The system applies a **configurable surcharge** to the API-fetched USD rate to better reflect actual cost.

- **Default:** $30 CLP per USD (added to the API rate). This default lives in code as a system-wide constant.
- **Per-ledger override:** `LedgerConfig.exchange_surcharges.USD` (decimal, in CLP).
- The surcharge is applied to **USD only** by default; the model accommodates other currencies if needed in the future.
- The effective rate stored for each (month, USD) pair is `api_rate + surcharge`. The raw API value is also retained for audit, so the surcharge can be recalculated retroactively if its value changes (only for open months — closed snapshots keep the rate at close time).

CLF does not have a surcharge by default because it's already an officially-published value used in domestic transactions.

#### Storage and conversion convention

For each (month, currency), store the effective rate as "CLP per unit." A month's rate is the rate for the **1st day of that month** (matching how the sheets work: "marzo, 2026 | $39.955 | $870").

If the API returns a value for the exact date, use it. If not (e.g. weekend, holiday), use the closest preceding business day's value.

#### Future-month rate projection

For months past the latest available API data:

```
projected_rate(month_n) = projected_rate(month_{n-1}) × (1 + monthly_variation[currency])
```

starting from the most recent known rate. When the API later provides a real rate for that month, the projected rate is replaced and any cached month views invalidated.

#### Conversion

```
amount_clp(amount, currency, month) = amount × rate(currency, month)
```

For CLP, rate is always 1.

---

## 7. Cross-ledger transfers

### 7.1 Model

A **Transfer** is a logical entity that links two `CatalogItem` rows:

- A **source leg** in ledger A (typically a Gasto in the family ledger).
- A **target leg** in ledger B (typically an Ingreso in the personal ledger).

Both legs are normal catalog items in their respective ledgers, with `transfer_link_id` pointing to the same `TransferLink` record.

### 7.2 Behaviors

- Editing structural fields on either leg can be configured to propagate to the other. Default behavior: **synchronized** (changing one updates the other). UI exposes an "unlink" action that breaks the connection.
- **Revisions and transfers:** when the user adds a new `CatalogItemRevision` to the source leg of a linked transfer, the system creates a matching revision on the target leg with the **same `effective_from_month`** and the **same `amount_real`**. The `fuente` is copied independently (the source's fuente is typically an outgoing expense from a credit card or cash, while the target's fuente is the receiving account; they may differ but most commonly are both `CASH`). The user is prompted before the auto-creation: "Esta revisión también se aplicará a `<target item>` en `<target ledger>`. ¿Continuar?"
- If the user declines, the source's revision is created alone and the legs become out of sync. The UI flags the unsynced state with a visual indicator on both legs until either resolved (a manual matching revision is added) or the link is removed.
- Marking the source leg paid in month N can offer to also mark the target leg received in month N (and vice versa) — a confirmation prompt, not automatic.
- Variances on either leg are independent. If source pays $550K but target receives $545K, both ledgers reflect their own truth.
- Unlinking does not delete past revisions; both items retain their full revision history.

### 7.3 UI

When creating a catalog item, a "This is a transfer" option lets the user pick the partner ledger and matching item (or create a new matching item). A small visual indicator (link icon) appears on linked items in both catalog and month views.

---

## 8. Catalog query — the core derivation rule

This is the central business logic, replacing the sheets' `QUERY` formulas.

### 8.1 Input

- A `ledger_id`
- A target month `M` (date, 1st of month)
- A category (or all categories)

### 8.2 Algorithm

For each `CatalogItem` in the ledger and category, the item produces a planned entry for month `M` if **all** of the following hold:

1. `M >= start_month`
2. `M <= end_month` *(end_month is derived; see §5.1.1)*
3. `month_number(M)` is in `valid_months` *(valid_months is derived; see §5.1.1)*
4. A `CatalogItemRevision` exists with `effective_from_month <= M`. The **active revision** is the one with the maximum such `effective_from_month`. Its `amount_real` and `fuente` are used for this month's derivation.
5. The item still has installments remaining as of month `M`:
   - If `total_installments` is null (∞), this check always passes.
   - Otherwise: condition 2 already enforces this — once `M > end_month`, the item is exhausted.
6. Prepago handling:
   - If `prepago_month` is null, no special handling.
   - If `prepago_month == M`, the item appears as a combined regular+prepago entry (see §8.3) — a single line for the user, since this typically reflects one consolidated payment.
   - If `prepago_month` is set and `M > prepago_month`, the item does **not** appear in subsequent months (it was paid off in the prepago_month).
   - If `prepago_month` is set and `M < prepago_month`, regular processing — the item appears normally.

### 8.3 Prepago combined amount

When `prepago_month == M`, the item produces a **single combined entry** representing the regular installment for month M plus all remaining installments paid in a lump. This is one line because users typically make one consolidated payment.

Using the **active revision** at month M and the derived `prepaid_installments` (§5.1.1):

```
remaining_after_M     = total_installments − prepaid_installments(item) − installment_index(M)
combined_installments = 1 + remaining_after_M           // regular installment for M + the rest as lump
combined_amount       = active_revision.amount_real × combined_installments
```

Where `installment_index(M)` is the count of months between `start_month` (inclusive) and `M` (inclusive) that fall on `valid_months`.

The combined entry is presented with a name like `"<Name> (prepago)"` in code-canonical English; the UI translates this label to the user's locale.

A tooltip or detail view on the item should break the combined amount down: "1 cuota normal de $X + N cuotas restantes de $X = total $Y".

### 8.4 Output

A list of derived `PlannedItem` records, each with:

- Reference to source `CatalogItem` and the active `CatalogItemRevision` used.
- The month's currency rate applied: `planned_amount_clp = round(active_revision.amount_real, currency) × rate(currency, M)` (rounding rules in §9).
- The active revision's `fuente`.
- Default `actual` is null until the user fills it.

### 8.5 Edge cases

- **Frequency `H` (half-yearly):** produces `valid_months` of two months 6 apart, anchored on `start_month`.
- **Frequency `CUSTOM`:** the user must populate `custom_months` with any subset of {1..12}. Used for items that don't follow a canonical schedule.
- **Yearly items where `start_month` falls late:** e.g. `Y` with `start_month=2025-12-01` produces `valid_months = {12}`. The item appears every December starting from December 2025.
- **`total_installments` exhausted mid-year:** e.g. an `M` item with `total_installments=3` and `start_month=2025-03-01` has a derived `end_month=2025-05-01` and does not appear from June 2025 onwards.
- **Catalog item with all installments exhausted before today:** does not appear in current/future months. Appears in closed-month snapshots for the months it was active.

---

## 9. Rounding

### 9.1 Principle

**Real values are never rounded.** This is a load-bearing rule of the app.

- `amount_real` on a catalog item (and per revision) — the user-entered native-currency value — is preserved exactly as entered.
- `actual_amount_original` on a paid item — the user-entered native-currency value of what they actually paid — is preserved exactly as entered.
- These values, and their CLP conversions (`Original CLP`, `Actual CLP`), are the **truth**. They never go through rounding.

Rounding produces only one output: the **Planificado** value — the budgeted/forecasted amount the app shows alongside the real amounts. Planificado is a derived view of `amount_real`, useful for forecasting future months without per-cent variation noise.

### 9.2 Rounding rule

Given a catalog item (or one-off item) and a target month:

```
original_clp(item, month) = item.amount_real × rate(item.currency, month)

unit(category, config) =
  category == income                              → config.approximations.income
  category in { essential, variable, provision }  → config.approximations.expense

direction(category) =
  category == income                              → floor
  category in { essential, variable, provision }  → ceil

planned_clp(item, month) = direction(item.category)( original_clp(item, month) / unit(item.category, config) )
                          × unit(item.category, config)
```

Worked examples (using defaults `income: 50000`, `expense: 30000`, with March 2026 rates UF=$39,955 USD=$870):

| Item | Currency | Original | × rate | Original CLP | Category | Unit | Direction | Planificado CLP |
|---|---|---|---|---|---|---|---|---|
| Salary | CLP | $1,230,000 | 1 | $1,230,000 | income | 50,000 | floor | $1,200,000 |
| Combustible | CLP | $100,000 | 1 | $100,000 | variable | 30,000 | ceil | $120,000 |
| Suscripciones | USD | $40 | 870+30 | $36,000 | variable | 30,000 | ceil | $60,000 |
| Seg. Banco Chile | CLF | 1.20 | 39,955 | $47,946 | provision | 30,000 | ceil | $60,000 |

(The USD example uses the rate including the $30 surcharge from §6.3.)

### 9.3 Where rounding is applied

Rounding is applied in exactly two places:

1. **Catalog query (§8)** — every derived planned item runs through the rounding pipeline at read time, using the target month's exchange rate.
2. **One-off entry (§10.3)** — when the user adds a one-off, they enter Original + Currency and the app converts and rounds the same way to produce Planificado.

In both cases, Original (un-rounded native), Original CLP (un-rounded converted), and Planificado (rounded CLP) are stored or derived together. The Original values remain available for verification.

### 9.4 What rounding does NOT apply to

- **Actual values** (Actual original, Actual CLP) — real payments, never rounded.
- **Native-currency amounts** — rounding only happens in CLP after conversion. A $40 USD subscription is not rounded to "$40"; it's the CLP equivalent that gets rounded.
- **Resumen subtotals** — these use a separate `minimum` smoothing rule (§10.x), not the per-item `income`/`expense` rule.

### 9.5 User override of Planificado

For one-off items only, the user may override the auto-rounded Planificado with an explicit value (e.g. a one-off ajuste of exactly $250,000 CLP). The override is preserved on the OneOffItem and used as the Planificado in all calculations and displays. Catalog items do not support per-item Planificado override — to deviate from rounding, the user would create a one-off instead.

---

## 10. Month view

This section defines the UI and behavior of a single month's reconciliation surface.

### 10.1 Layout

A month view contains:

1. **Header:** ledger name, month label, status badge (`Abierto` / `Cerrado`), exchange rates for the month (UF, USD).
2. **Balance block** (computed; see §10.2): four fields.
3. **Card payments block:** two rows — "Tarjeta nacional" and "Tarjeta internacional" — each showing the sum of planned TC items in scope (nacional = CLP + CLF, internacional = USD), and an action button **"Pagar tarjeta"** that triggers the bulk-payment flow described under §10.3 → "Pay credit card". When all TC items in a scope are already paid, the button is replaced with the paid amount and a "Reabrir pago" link that reverses the bulk action.
4. **Real vs Ideal block** (§10.7).
5. **Resumen table:** four rows (one per category), columns Total / Pendiente.
6. **Category tables (×4):** Ingresos, Gastos esenciales, Gastos variables, Previsión (Spanish labels for the Spanish UI). Each table lists planned + one-off items. Visible columns: **Pagado**, **Nombre**, **Fuente**, **Divisa**, **Planificado**, **Actual**. Additional fields (Original, Original CLP, Variance, installment index, source reference) are available on row expansion or in a detail panel — they're not part of the default view because they were only relevant as helper columns in the spreadsheet. The expanded detail must let the user verify the math (real amount, currency conversion, rounding, variance) when needed.
7. **One-off entry buttons** below each category table.
8. **Month-close button** (only on the current open month with the smallest date; future months can't be closed first).

### 10.2 Balance block

Four fields, in this order:

| Field | Definition |
|---|---|
| Monto en cuenta | Manual override if `monto_en_cuenta_override` is set, otherwise the computed close balance of the previous month (carry-over). For the very first month of a ledger, defaults to 0 with a UI prompt to set the opening balance. |
| Ahorro inicial | The running savings balance as of this month, in CLP. Computed as: starting from 0, walk forward through every prior closed month and add `Σ actual_amount_clp` for items with `is_saving = true` (signed: contributions positive, retirements negative), then add that month's `SavingsAdjustment.delta_clp` if one exists. See §11.2.1 for the formal definition. |
| Ahorro presupuestado | The sum of `planned_amount_clp` for items in the current month with `is_saving = true`. |
| Remanente estimado | `Monto en cuenta + Σ income − Σ expense − provision_non_saving − Ahorro presupuestado`, using actuals where present and planned otherwise. May be negative; see §11. |

### 10.3 Item interactions

#### Marking an item as paid

User clicks the "Pagado" checkbox on a planned item.

- If `actual_amount_original` is **null**: the checkbox click opens an inline editor for the actual amount. The user must enter a value to confirm.
- If `actual_amount_original` is **already filled**: the checkbox flips to true immediately.
- A confirmation toast may appear with an "Undo" affordance.

#### Unmarking an item

Clicking a checked "Pagado" box unchecks it. The `actual_amount_original` value **persists** unless the user explicitly clears it through a separate "Clear actual" action.

#### Editing a planned item

- For catalog-derived items: the planned amount is derived from the catalog. To change it, the user is sent to the catalog edit screen.
- For one-off items: planned amount is editable inline.

#### Adding a one-off

A "+ Agregar puntual" button below each category table opens a form: **name**, **original amount**, **currency**, **fuente**, optional notes.

The one-off can be in **any supported currency** (CLP, CLF, USD), independent of any catalog item. This is important for cases like an unexpected USD purchase abroad ("Farmacia USA $40 USD") or a CLF refund that doesn't correspond to a recurring item.

When saved, the app runs the value through the same rounding pipeline as catalog items (§9): converts Original → Original CLP at the month's rate (including any surcharge for foreign currencies), then rounds to Planificado using the category's direction and unit.

The user may **override** the auto-computed Planificado with an explicit value. The override is preserved as-is and used in all displays and calculations. Original and Original CLP remain available for verification.

The one-off is created as a `OneOffItem` in the current month and category.

#### Skipping an item

The user can mark a pending item as **Skipped** via a "Saltar" action on the row. Opens a small dialog: "¿Por qué saltas este item?" with a required text field. On confirm, the item moves to status `skipped` with the reason stored. Skipped items remain visible in the category table with a distinct visual treatment (e.g. struck-through, muted), but contribute zero to Resumen totals.

Unskipping an item (also from the row's menu) clears `skipped` and `skip_reason`, returning the item to Pending.

#### Moving an item to next month

From any **Pending** or **Skipped** item in the current open month, the user can choose **"Mover al próximo mes"**. Available cases:

- A pending payment that the user has decided to defer ("Atraso Mac Nino" — the salary adjustment didn't arrive this month, but will next month).
- A skipped item that turned out to need to be paid after all, but next month.

Effect:

1. A new `OneOffItem` is created in `month + 1` with:
   - Same name, category, currency, fuente.
   - `planned_amount_clp` = the original item's effective Planificado.
   - `planned_override_clp` set to that same value (preserving the carried-over Planificado regardless of catalog edits).
   - `actual_*` = null, `paid = false`, `skipped = false`.
   - `rollover_from_month = current_month`.
   - `rollover_source` = audit snapshot of the original item.
2. The original item in the current month is marked **Skipped** with `skip_reason = "moved to next month"` (system-set, not user-edited). The original therefore stops contributing to the current month's Resumen and balance, while remaining visible for traceability.

The "Move to next month" action is available **mid-month**, independently of the month-close rollover. It is essentially the close-time rollover (§10.5) applied to a single item, available at any time.

Items in **Paid** status cannot be moved — once paid, the transaction is settled and the right correction is the amend workflow (§10.6) if the user wants to retroactively change history, or simply marking the corresponding next-month item as paid when it comes.

Catalog-derived items can be moved just like one-offs: the original derivation gets a paired `ActualEntry` with `skipped = true, skip_reason = "moved to next month"`, and a new `OneOffItem` lands in the next month.

#### Pay credit card (bulk payment action)

Most TC items are settled together as a single consolidated payment when the credit card bill arrives. Rather than marking each TC item individually, the user invokes the **"Pay credit card"** action.

There are **two separate actions** corresponding to the two card bills users typically pay separately:

- **"Pagar tarjeta nacional"** — covers all `fuente = TC` items in the month whose currency is `CLP` or `CLF` (denominated in the national currency).
- **"Pagar tarjeta internacional"** — covers all `fuente = TC` items in the month whose currency is `USD` (international purchases).

Both live in the card-payments block at the top of the month view (§10.1).

##### Flow

1. User clicks one of the two actions.
2. A modal opens listing every **unpaid TC item** in the relevant scope (catalog-derived + one-offs), with each item's Planificado pre-filled as the proposed actual.
3. User can **override per-item actuals** before confirming (useful if they know specific items differed from the plan).
4. User enters the **consolidated actual amount paid** (single CLP value, taken from the bank statement).
5. User confirms.

##### Effect

On confirm, transactionally:

1. Every item in the modal is marked as **Paid**, with its `actual_amount_original` set to the (possibly user-overridden) value displayed in the modal, and `actual_amount_clp` recomputed.
2. The sum of those per-item actual CLP amounts is computed: `sum_of_item_actuals`.
3. The difference is computed: `delta = user_entered_consolidated_amount − sum_of_item_actuals`.
4. If `delta ≠ 0`, a single `OneOffItem` is created in the current month with:
   - `category = variable`
   - `name = "Ajuste tarjeta nacional"` or `"Ajuste tarjeta internacional"` (depending on which action)
   - `original_amount = delta` (in CLP for nacional, in USD for internacional — original currency of the bill)
   - `planned_amount_clp = 0` (this isn't a planned item — it's a reconciliation)
   - `planned_override_clp = 0`
   - `actual_amount_original = delta`, `actual_amount_clp = delta_in_clp`
   - `currency = CLP` or `USD` accordingly
   - `fuente = TC`
   - `paid = true`
   - `tc_adjustment = true`
   - Notes set to a system-generated message describing the reconciliation
5. The `tc_adjustment` flag enables the negative value: this is the *only* path through which a negative `actual_amount_original` and `actual_amount_clp` can exist in the system.

##### Notes

- If `delta = 0` (the consolidated bill matches the sum of per-item actuals exactly), no adjustment one-off is created.
- A positive `delta` means the consolidated bill was *more* than expected (e.g. interest, late fees) — the adjustment is a positive expense.
- A negative `delta` means the consolidated bill was *less* than expected (e.g. promotional credit, a planned item didn't actually post) — the adjustment is the negative one-off.
- The adjustment one-off counts as a normal `variable` expense in the Resumen totals — it's not special-cased except for the negative-value permission.
- If the user later realizes the adjustment was inaccurate, they can edit the per-item actuals on the underlying items and re-run "Pay credit card" — or, if the month is closed, use the amend workflow.

##### What if no TC items exist?

The action is disabled when there are no unpaid TC items in scope. The user can still create one-off TC items normally and use the action once it has something to process.

#### Retire from savings

When the user needs to draw money out of their accumulated savings (to cover an unexpected expense, to make a large purchase, or to spend some of the buffer they built up), they invoke the **"Retirar de ahorros"** action. This is the v1 mechanism for savings withdrawals; a richer "tracked bucket" version is deferred to v2 (§16, item 3).

##### Where it lives

A "Retirar de ahorros" action is available on the month view, in or near the balance block (next to `Ahorro inicial`). Available only in the current open month (and any prior open historical month, if there are still un-closed past months).

##### Flow

1. User clicks the action.
2. A modal opens showing:
   - Current `Ahorro inicial` (the running savings balance as of this month).
   - An amount input (in CLP).
   - A required `name` / reason field (free text), e.g. "Cubrir pasajes a Chicago".
3. User enters the amount and reason and confirms.

##### Effect

A new `OneOffItem` is created in the current month with:

- `category = provision`
- `is_saving = true`
- `name` = user-entered reason
- `original_amount = −amount` (negative CLP value)
- `planned_amount_clp = −amount`, `planned_override_clp = −amount`
- `actual_amount_original = null`, `actual_amount_clp = null` (user marks paid when the withdrawal actually completes)
- `currency = CLP`
- `fuente = CASH`
- `paid = false`, `skipped = false`
- `savings_retirement = true` (new flag on OneOffItem — see below)

The `savings_retirement` flag enables the negative value. Like `tc_adjustment`, this is one of the named, structured operations that can produce negative amounts. Direct user entry of negative numbers in the regular one-off form is rejected (§10.4).

##### Validation

- The retirement amount must be **positive in the form input** (the user enters $200K, the system stores it as −$200K internally).
- The retirement amount must be **≤ the current `Ahorro inicial`**. If the user tries to retire more than they have, the action is rejected with a message: "No puedes retirar más de lo que tienes ahorrado (disponible: $X)."
- `Ahorro inicial` is the closed-month accumulation; in-month planned/actual savings contributions and prior in-month retirements **do not** count toward what's available to retire in the same month (rationale: the money isn't actually in the savings account yet — it's a plan).
- If multiple retirements exist in one open month, each is validated against `Ahorro inicial − Σ prior retirements in this month`.

##### Effect on the month math

Per §11.2, the retirement (with negative `is_saving = true` amount) flows into `ahorro_presupuestado` as a negative number, which adds cash to `net_movement`. The user gets the cash this month and the closed-month accumulation decreases on close, reducing `Ahorro inicial` going forward.

##### Marking as paid

When the user actually performs the bank transfer (savings → cash), they mark the retirement entry as Paid with an `actual_amount_original`. The actual is also negative; the form should pre-fill it with the planned amount and accept user override (e.g. if a small fee made the actual `−$199,500` instead of `−$200,000`).

If the user wants to cancel a retirement they entered but haven't paid yet, they delete the one-off (deletion of one-offs is a normal capability not covered by the spec elsewhere — implicit).

#### Adjust savings

The user's running `Ahorro inicial` (§10.2, §11.2.1) is a **cost-basis** number — it tracks contributions minus retirements at the value each had at the time of the transaction. It does not reflect the **market value** of the savings, which may differ due to investment returns, interest accrual, currency moves, or losses.

The **"Ajustar ahorros"** action lets the user reconcile cost basis to actual market value. It exists for cases like:

- "Fintual showed me a +$15K quarterly gain — my real savings are higher than my cost basis says"
- "Banco Estado paid $4K interest"
- "The market dropped and my emergency fund is worth $20K less"

##### Where it lives

In or near the balance block on the month view, alongside "Retirar de ahorros". Available only in the **current open month**. Each open month can have at most one SavingsAdjustment; recording a new one in a month that already has an adjustment replaces the existing one.

##### Flow

1. User clicks **"Ajustar ahorros"**.
2. A modal opens showing:
   - Current cost-basis `Ahorro inicial` for this month (read-only, for reference).
   - An input asking for the **new total balance** the user wants to assert (CLP).
   - The computed **delta** preview (signed): `new_total − current Ahorro inicial`.
   - An optional `note` field for context ("Ganancia trimestre Fintual", etc.).
3. User confirms.

##### Effect

A `SavingsAdjustment` is created (or replaced) for the current open month, with:

- `asserted_total_clp` = the new total the user entered
- `delta_clp` = computed
- `note` = optional user text

##### What it does NOT do

- It does **not** create a `OneOffItem`.
- It does **not** affect the current month's Resumen, balance block (other than what's described next), or any per-item totals.
- It does **not** require a Paid status — it's effective immediately on save (it's an assertion, not a transaction).

##### What it DOES affect

- The current month view's balance block updates: a small line "Ajuste de ahorros: ±$X" appears below `Ahorro inicial` while the month is open, showing the pending adjustment.
- On month close, the adjustment is captured into the `MonthSnapshot.savings_adjustment` field and from there it permanently feeds into `Ahorro_inicial(M+1)` for all future months (per §11.2.1).
- It does NOT contribute to `net_movement` or `close_balance`. The cash side of the month is unaffected.

##### Validation

- `asserted_total_clp >= 0`. The user cannot assert negative savings.
- The form should warn (not block) if `delta_clp` is unusually large relative to the current balance (e.g. > 50%), since this is often a typo. The warning is "¿Estás seguro? El cambio es de ±$X (Y% del saldo actual)."

##### Editing or deleting

The user can edit or delete the open month's adjustment at any time while the month is open. Once the month closes, the adjustment is part of the immutable snapshot. To correct an adjustment in a closed month, use the amend workflow (§10.6) — though as with all amends, only the most recently closed month can be amended.

### 10.4 Validation rules

#### Item status

An item is in one of three states:

- **Pending** (`paid = false`, `skipped = false`) — default; awaiting payment.
- **Paid** (`paid = true`) — the user paid/received it. Requires a non-zero **positive** `actual_amount_original`.
- **Skipped** (`skipped = true`) — the user decided not to pay this item this month. Requires a `skip_reason` string explaining why (free text, but mandatory and non-empty). The skipped item does not contribute to the Resumen totals.

Skipped and paid are mutually exclusive.

#### No negative amounts

**Negative values are forbidden in all per-item fields** (`actual_amount_original`, `actual_amount_clp`, `planned_amount_*` on one-offs, `original_amount` on one-offs, etc.). This is a deliberate constraint to keep the data model unambiguous.

There are exactly **two situations** where a negative amount may legitimately exist in the system, and both are reached through structured, named operations — never through direct entry of a negative number:

1. **Savings retirements** — produced by the "Retire from savings" action (§10.3 → "Retire from savings"). The system generates a one-off with `savings_retirement = true`, `category = provision`, `is_saving = true`, and a negative `original_amount`.
2. **TC consolidation adjustments** — produced automatically by the "Pay credit card" action (§10.3 → "Pay credit card") when the consolidated bill differs from the sum of planned TC items. The system generates a single one-off in the `variable` category labeled as a TC adjustment, which may carry a negative value.

If the user wants to skip an item or defer it ("I'm not paying Mac Nino this month"), they use the **Move to next month** operation (§10.3.4) or mark the item as Skipped — not a negative actual.

#### Required fields per status

| Status | `actual_amount_original` | `skip_reason` |
|---|---|---|
| Pending | null or filled (preserved on unmarking) | null |
| Paid | required, > 0 | null |
| Skipped | null | required |

Notes:

- `$0` actual is **not allowed**. If the user genuinely paid $0 (rare), they should use Skipped with a reason like "no charge this period".
- The user cannot mark items in future months as paid or skipped (only the current month and historical open months).
- The system itself may write negative values into one-offs only via the TC adjustment flow; direct user entry of negative numbers is rejected at the API layer.

### 10.5 Month close

#### Trigger

User clicks **"Cerrar mes"** on the currently-open earliest month.

#### Validation phase

The system collects all planned items in the month (derived + one-offs) and classifies each:

- `paid = true` and actual filled → **resolved (paid)**.
- `skipped = true` with reason → **resolved (skipped)**.
- Otherwise → **pending**.

#### Confirmation

A confirmation dialog is always shown before closing — even when there are no pending items — because closing is irreversible without the amend workflow.

**Case A: All items resolved.**

> "Estás a punto de cerrar el mes de `<month>`. Esta acción es permanente: una vez cerrado, los cambios solo pueden hacerse mediante la opción Amend, y no podrás re-abrir el mes. ¿Continuar?"
>
> [Cancelar] [Cerrar mes]

**Case B: Pending items exist.**

> "Este mes tiene N items pendientes. Para cerrar, los items pendientes se moverán al próximo mes como puntuales (rollover). Esta acción es permanente. ¿Continuar?"
>
> [Cancelar] [Mover y cerrar]

The dialog lists all pending items so the user can review.

The rollover action is all-or-nothing: either all pending items move forward, or close is aborted. The user cannot pick which items move (v2 may add per-item selection).

#### Close phase (transactional)

1. For each pending item, create a `OneOffItem` in `month + 1` with:
   - Same name, category, fuente, currency.
   - `planned_amount_*` = the pending item's planned values.
   - `actual_amount_*` = null.
   - `paid = false`.
   - `rollover_from_month = M`.
   - `rollover_source = { type: source_type, id: source_id, original_name, ... }`.
2. Materialize the `MonthSnapshot`:
   - Compute final exchange rates (use stored if any, otherwise fetch).
   - Snapshot the ledger config.
   - For each item still in the month (i.e., paid items + items that didn't move), create a `MonthSnapshotItem`.
   - If a `SavingsAdjustment` exists for this month, copy it into `MonthSnapshot.savings_adjustment` (and recompute its `delta_clp` against the final closed `Ahorro inicial`).
   - Compute `resumen` and `balance` and write to snapshot.
3. Update `MonthState.status = closed`, set `closed_at`, `closed_by_user_id`.
4. Invalidate all derived caches for months ≥ `M+1` in this ledger.

#### Post-close immutability

Once closed:

- No `CatalogItem` edits affect the snapshot.
- No `ExchangeRate` updates affect the snapshot.
- The month view renders entirely from the snapshot.
- The only way to change a closed month is the **amend workflow** (§10.6).

### 10.6 Amend workflow

The amend workflow is available **only on the most recently closed month**. Older closed months are read-only: their carry-overs have already cascaded into multiple downstream months and amending them would require re-validating every subsequent close, which adds complexity without much real-world benefit. If the user discovers an error two or more months back, the practical fix is to amend the latest closed month with a compensating entry.

#### Workflow

1. From the most recently closed month's view, an "Amend" action is available.
2. Opens a guided form to specify the change: e.g. "Add a missed payment to item X with actual amount Y", "Correct actual amount on item X from A to B".
3. The change is applied to the `MonthSnapshot` directly, AND appended to the `audit_log` with: timestamp, user, before/after values, free-text reason (required).
4. Downstream open months' carry-overs may change. After amend, all open months' caches are invalidated.

This preserves immutability-by-default (no random edits) while allowing audited corrections for the most recent close.

#### Why not older closed months

Allowing amends arbitrarily far back creates two problems:

1. The carry-over chain has to be recomputed for every month between the amended one and the current month, and any of those intermediate months may itself have had data that depended on the carry-over (e.g. a "use leftover balance" decision the user made at the time).
2. Audit trails get harder to reason about — the question "what did this month look like when I closed it?" becomes ambiguous if past closes can be edited.

If a major correction is needed in an older month, the user should make a compensating adjustment in the latest open month (or amend the latest closed month) with a note explaining the historical mistake.

### 10.7 Real vs Ideal block

The Real vs Ideal block compares planned spending to budget targets per category. The "Ideal" values are pulled from a separate per-category budget setting (in LedgerConfig or a separate `CategoryBudget` table — implementation choice). This is informational only and matches the sheets' existing block.

| Category | Real | Ideal |
|---|---|---|
| Esenciales | sum of category items (actual ?? planned) | configured target |
| Variables | ... | ... |
| Previsión | ... | ... |

If `Ideal` is unconfigured for a category, display "—".

### 10.8 Resumen aggregation rule

The Resumen table sits at the top of the month view: four rows (one per category), with columns **Total** and **Pendiente**.

**Substitution rule (per item):**

For each item in a category, contribute `actual_amount_clp` if non-null, otherwise `planned_amount_clp`. Skipped items contribute zero.

**Smoothing rule (Resumen subtotals):**

Because actuals are never rounded (§9.1), summing rounded planned values with un-rounded actuals can produce category totals on fractional CLP values. To keep the headline Resumen on clean boundaries, the **subtotal** of each category is smoothed using `config.approximations.minimum` as the unit, with the same direction rule as item rounding:

```
category_subtotal(category) =
  raw = Σ (actual_amount_clp ?? planned_amount_clp) over non-skipped items in category

  unit      = config.approximations.minimum
  direction = (category == income) ? floor : ceil   // expenses & provisions round up

  return direction(raw / unit) × unit
```

The `Pendiente` column applies the same smoothing to the subtotal of unpaid items only.

This means the Resumen displays clean totals (always multiples of `minimum`, e.g. $10,000 CLP), while the underlying per-item Originals and Actuals remain unchanged in the category tables. The two will not exactly reconcile by simple addition — that's intentional. The detail panel on each Resumen row can show the un-smoothed raw sum for verification.

The four category rows are computed independently; there is no cross-category smoothing.

---

## 11. Variance, carry-over, and deficit handling

### 11.1 Variance

Per item: `variance = actual_amount_clp − planned_amount_clp`, defined only when actual is non-null.

Per category, per month: sum of item variances.

Variance is displayed per-item in the category tables. The Resumen does not show a separate variance column — the Total already reflects actuals via the substitution rule defined in §10.8 (and then smoothed by `minimum`).

### 11.2 Net month close balance

The close balance uses the **raw** per-item sums (substitution rule, no Resumen smoothing). Smoothing is only for display in the Resumen; the carry-over chain must use exact values to remain self-consistent.

```
provision_non_saving(month) = Σ provision items where is_saving = false (actual ?? planned)
ahorro_presupuestado(month) = Σ provision items where is_saving = true (actual ?? planned)

net_movement(month) = Σ income (actual ?? planned)
                    − Σ expense (actual ?? planned)
                    − provision_non_saving(month)
                    − ahorro_presupuestado(month)

close_balance(month) = monto_en_cuenta(month) + net_movement(month)
```

Skipped items contribute zero.

Provision items split into two groups by their `is_saving` flag:

- **Non-saving provisions** (insurance, planned future expenses, AFP, etc.) — counted in `provision_non_saving`. These reduce available cash like any other expense.
- **Saving provisions** (Ahorro Fintual, APV, emergency-fund contributions, savings retirements) — counted in `ahorro_presupuestado`. These also reduce available cash, but they don't disappear — they accumulate into the running savings balance tracked in `Ahorro inicial` (§10.2).

**Why the split:** if savings were summed into both `Σ provision` and `ahorro_presupuestado`, they would be double-counted. Splitting ensures every provision item is counted exactly once, in the right bucket.

Savings retirement entries (§10.3 → "Retire from savings") are `is_saving = true` with a **negative** amount. Under the formula above, a retirement of −$200K contributes `ahorro_presupuestado = -$200K`, which flips the sign in `net_movement` to produce `+$200K` of newly-available cash. The closed-month actual then flows into next month's `Ahorro inicial`, decreasing it.

Note that `ahorro_presupuestado` is subtracted (not added) because savings are committed-out of available cash. A negative `ahorro_presupuestado` therefore *adds* cash back — which is exactly what a retirement should do.

### 11.2.1 Ahorro inicial — running savings balance

`Ahorro inicial` for a month `M` is the user's accumulated savings balance entering that month. Formally:

```
Ahorro_inicial(M) =
  Σ over each prior closed month K < M:
    Σ actual_amount_clp for items in K where is_saving = true
    + (K.savings_adjustment.delta_clp if a SavingsAdjustment exists for K, else 0)
```

The first month of the ledger has `Ahorro_inicial = 0` unless the user sets it explicitly via the opening-balance prompt (in which case the user-set value is the seed and subsequent months derive from there).

Important properties:

- **Cost-basis + adjustments.** Without `SavingsAdjustment`, this is a pure cost-basis calculation (contributions minus retirements, all at the value they had at the time of the transaction). `SavingsAdjustment` lets the user reconcile that cost basis to the actual market value of their savings whenever they choose.
- **Open months don't contribute.** Only closed months feed into `Ahorro_inicial(M)`. In-month planned/actual is_saving items, in-month retirements, and the in-month `SavingsAdjustment` are not included until the month closes.
- **Adjustment is applied at the month it was recorded.** If the user records an adjustment in March 2026 saying "my savings are now $615K", that $615K becomes the new baseline for April 2026's `Ahorro inicial` (assuming March closes with no further is_saving activity).
- **Validation for retirements (§10.3) uses this same `Ahorro inicial`.** A retirement in month M cannot exceed `Ahorro_inicial(M) − Σ prior retirements in this same open month`.

The computation is part of the cascade chain (§11.4) and is invalidated whenever any prior month's data, adjustment, or amend operation changes.

### 11.3 Carry-over

For any month N+1:

```
monto_en_cuenta(N+1) = override(N+1) ?? close_balance(N)
```

This applies signed — negatives propagate.

### 11.4 Cascade computation

Because future months derive their `Monto en cuenta` from prior months' `close_balance`, computing month N requires computing **every prior open month** in order.

Algorithm to compute month N:

1. Find `earliest_open_month` = the month immediately after the latest closed month for this ledger (or the ledger's start month if nothing is closed).
2. For each month M in `[earliest_open_month, N]` (in order):
   a. Derive planned items from catalog query.
   b. Apply actuals overlay (for the current month and any open historical months).
   c. Apply one-offs.
   d. Compute `close_balance(M)`.
3. Cache each month's computed values keyed by `(ledger_id, month, catalog_version)`.

`catalog_version` is a monotonic counter incremented on any write to the catalog, ledger config, exchange rates, actuals, or one-offs that could affect open months. Cache entries with a stale version are evicted on next read.

### 11.5 Deficit detection and flagging

A month is in **deficit** if `close_balance < 0` OR `monto_en_cuenta < 0` at any point during the month.

For each month with status `open` (current or future):

- Compute `close_balance`.
- If negative, find the **root cause month**: walk backwards through prior open months to find the earliest month whose net movement made the cumulative carry-over go negative.
- Display a warning banner on the month view: "⚠ Déficit proyectado: -$X. Origen: <month_name>." with a link to the root-cause month.
- Every deficit month shows the warning (not just the first), and each displays a link back to the same root-cause month.

Also compute a **rolling minimum** across all open months: `min(close_balance(N))` for N in [current_month, current_month + horizon]. Display prominently on a dashboard view (see §12).

### 11.6 Forecasting horizon

The default horizon for "future months" is the maximum month any catalog item is still active in, capped at 24 months for performance. Configurable per ledger.

---

## 12. Dashboard (cross-month overview)

The dashboard is the app's landing screen after ledger selection. It provides:

- **Selector:** which ledger.
- **Mini-stats:** current month close projection, rolling minimum balance (highlighted red if negative), ahorro acumulado.
- **Timeline chart:** monthly close balance over the next 12 months, with the rolling-minimum line and deficit-month markers.
- **Quick links:** current month view, catalog editor, ledger settings.

A multi-month timeline of catalog item activity (Gantt-style) is a nice-to-have but not required for v1.

---

## 13. Catalog editor

A screen showing all four catalog tables for a ledger, with rows matching the source spreadsheet structure.

### 13.1 Columns

**Stored fields (editable):** Nombre, Monto (current), Divisa, Frecuencia, Fuente (current), Mes inicial, Cuotas (=total_installments), Mes prepago, [Saving?]*, [Linked?]*, [Historial]

**Derived fields (read-only, shown for verification):** Mes final, Cuotas prepagadas, Meses válidos.

\* "Saving?" only shown for Previsión table. "Linked?" indicates transfer linkage. "Historial" opens the revision history (§13.5).

If `Frecuencia = CUSTOM`, an additional editable field appears: **Meses válidos personalizados** (multi-select for months 1..12).

The Monto and Fuente columns display the **current active revision's** values. To see or edit historical values, the user opens the revision history.

### 13.2 Inline editing

Stored fields are editable inline (with the exception of Monto/Fuente, which go through revisions — see §13.5). Changes save on blur, with optimistic UI.

Derived fields are never edited directly; changing the stored fields that they depend on updates them automatically.

### 13.3 Validation

- `start_month` must be a valid year-month.
- `total_installments > 0` or null (for ∞).
- `prepago_month`, if set, must be `>= start_month` and `<= end_month` (where `end_month` is derived).
- `prepago_month`, if set, must itself fall on a valid month per the item's frequency (i.e. `month_number(prepago_month) ∈ valid_months`).
- `frequency = CUSTOM` requires `custom_months` to be non-empty and a subset of {1..12}.
- `frequency != CUSTOM` requires `custom_months` to be null.
- A catalog item must have at least one revision with `effective_from_month <= start_month`.

### 13.4 Edit propagation

- Edits to a catalog item's identity/structure fields invalidate cached views for all open months containing that item.
- Adding or editing a revision invalidates cached views for all open months ≥ `effective_from_month`.
- Closed months are unaffected by any of these edits (immutability).

### 13.5 Revision workflow

This is the mechanism for evolving an item over time (e.g. annual salary raises) without creating duplicate items.

#### Adding a new revision

From the catalog editor, the user clicks "Nueva revisión" on an item. The form asks:

- **Effective from month** — defaults to next month, but can be any past or future month.
- **New amount** — defaults to current revision's amount.
- **New fuente** — defaults to current revision's fuente.
- **Note** — free-text, optional.

When saved, a new `CatalogItemRevision` is created.

If `effective_from_month` falls in or before a **closed month**, the new revision still records correctly but **does not retroactively change closed snapshots**. The UI should display a notice: "Esta revisión empieza en un mes ya cerrado. Los meses cerrados conservan sus valores originales. Para corregir un mes cerrado, usa Amend (§10.6)."

If `effective_from_month` falls in an **open month** (current or future), the revision takes effect immediately on next derivation.

#### Viewing revision history

A timeline view per item listing all revisions in chronological order:

| Effective from | Amount | Fuente | Note | Created |
|---|---|---|---|---|
| 2025-03-01 | $7.450.000 CLP | CASH | "Sueldo 2025" | 2024-12-15 |
| 2026-03-01 | $7.750.000 CLP | CASH | "Aumento 2026" | 2026-02-10 |
| 2027-03-01 | $8.050.000 CLP | CASH | "Aumento 2027" | (future, draft) |

#### Editing or deleting a revision

- A revision can be **edited** if all months ≥ its `effective_from_month` (up to the next revision's `effective_from_month`) are still open. If any are closed, edits are blocked and the user is directed to Amend.
- A revision can be **deleted** under the same rule, with one exception: the earliest revision cannot be deleted (the item must always have at least one revision covering its `start_month`).

#### Migration mapping

When importing from the sheets, items like "Sueldo 2025" and "Sueldo 2026" should be **consolidated into a single "Sueldo" item with two revisions** (effective 2025-03-01 and 2026-03-01 respectively). The migration wizard (§15.2) should detect probable consolidations (same name pattern with a year suffix, same currency, contiguous date ranges) and offer them as suggestions.

---

## 14. Ledger settings

A settings screen per ledger:

- **General:** name, archive.
- **Members:** list, invite by email, revoke.
- **Rounding:** per-currency overrides (with "use system default" toggle).
- **Approximations:** minimum balance threshold, income/expense targets.
- **Variation rates:** UF and USD monthly variation.
- **Category budgets:** for Real vs Ideal targets.

---

## 15. Migration from sheets

### 15.1 Process

1. User creates ledgers (e.g. "Familia", "Ricardo personal").
2. User chooses a starting month (e.g. "Junio 2026").
3. User opens the catalog editor and re-enters catalog items from the source sheets. (No automated import; the sheets' formulas and structure make a clean export impractical.)
4. User sets the opening `monto_en_cuenta` for the starting month.
5. User configures `LedgerConfig` (rounding, variation rates, thresholds).
6. User invites their partner to the family ledger.
7. The first month becomes the current month; the system derives planned items and shows the month view.

### 15.2 Migration aids

- A "Migration helper" wizard walks through the steps above.
- Sample data import: a JSON template file the user can fill (e.g. via a script that scrapes their sheets) and upload, mapping rows to catalog items.
- **Consolidation suggestions:** the wizard detects probable consolidations (items with names like "Sueldo 2025", "Sueldo 2026" — same root name, year suffix, same currency, contiguous date ranges) and offers to merge them into a single item with multiple revisions. The user can accept, edit, or reject each suggestion.

### 15.3 Validation against sheets

After entry, the user can pick any historical month from the sheets and compare the new app's derived planned table against it. Discrepancies usually indicate:

- A wrong `valid_months` value.
- A miscounted installment.
- A CLF/UF confusion in one of the original sheets.

---

## 16. Open questions & deferred decisions

| # | Item | Status |
|---|---|---|
| 1 | Currency `CLF` = UF. Confirmed. | Resolved |
| 2 | "Gastos especiales" rows in the sheets: confirmed to be a stale typo. The actual `AA12` formula in the family sheet is: `= { IFERROR(QUERY(Prevision!$A$2:$K;"select A "&$B$20)); IFERROR("Prepago "&QUERY('Gastos esenciales'!$A$2:$K;"select A "&$B$23);"N/A en Gastos especiales"); IFERROR("Prepago "&QUERY('Gastos variables'!$A$2:$K;"select A "&$B$23);"N/A en Gastos variables"); IFERROR("Prepago "&QUERY(Prevision!$A$2:$K;"select A "&$B$23);"N/A en Prevision") }` — the `"N/A en Gastos especiales"` string is the IFERROR fallback for a Prepago query against `'Gastos esenciales'`. The typo is purely a display label and doesn't affect data. | Resolved |
| 3 | **Tracked savings buckets.** v1 supports savings retirements (§10.3 → "Retire from savings") against a single un-segmented pool — the running `Ahorro inicial`. The sheets model this the same way. A v2 enhancement could partition savings into named buckets (Fintual, APV, emergency fund, etc.) with per-bucket balances, so retirements can name their source and reports can show per-bucket history. | Deferred |
| 4 | Notifications: alerts when an unpaid item is overdue, or when projected deficit exceeds X. Deferred to v2. | Deferred |
| 5 | Mobile app / PWA: deferred to v2; v1 is desktop web only (responsive). | Deferred |
| 6 | Per-item rounding overrides: not in v1; rounding is per-currency per-ledger only. | Deferred |
| 7 | Per-item carry-over flags: not in v1; carry-over is always signed and applied. | Deferred |
| 8 | Per-item rollover selection at month close: v1 is all-or-nothing. (Individual mid-month moves are supported via "Move to next month" — §10.3.) | Deferred |
| 9 | Bank integration: out of scope. | Won't do |
| 10 | Tax reporting: out of scope. | Won't do |
| 11 | **API contract validation.** Generate an OpenAPI schema from the backend and use it to produce typed frontend API wrappers, so a missing or mistyped endpoint fails at compile time rather than at runtime. | Post-v1 |

---

## 17. Functional requirements checklist

A compressed checklist for self-verification during build:

### Catalog & derivation

- [ ] Catalog items in four categories with all fields from §5.1.
- [ ] Three derived fields per §5.1.1 (`end_month`, `prepaid_installments`, `valid_months`) computed correctly and not stored.
- [ ] `CUSTOM` frequency supported with `custom_months` array.
- [ ] Catalog item revisions: time-versioned `amount_real` and `fuente`.
- [ ] Revision resolution: active revision at month M is the one with the maximum `effective_from_month` ≤ M.
- [ ] At least one revision required, covering the item's `start_month`.
- [ ] Catalog query (§8) produces correct planned items for any open month, using the active revision and derived fields.
- [ ] Installment counting respects derived `valid_months`.
- [ ] Prepago month behavior (§8.2 and §8.3), using derived `prepaid_installments`.
- [ ] Frequency `H` supported as first-class.
- [ ] Adding a revision with `effective_from_month` in a closed month does not retroactively change snapshots.
- [ ] Migration wizard detects "Sueldo 2025" / "Sueldo 2026" patterns and offers consolidation.

### Currency

- [ ] CLP, CLF, USD supported on the server-side. UI displays "UF" for CLF in Spanish locale.
- [ ] mindicador.cl integration for CLF and USD, with manual fallback.
- [ ] Future-month projection using monthly variation rates.

### Rounding

- [ ] **Real values (Original, Actual) are never rounded** — load-bearing rule.
- [ ] Planificado is derived from Original by converting to CLP and rounding per category.
- [ ] Rounding units (`income`, `expense`) live in `LedgerConfig.approximations`, in CLP.
- [ ] Direction is hardcoded: income floor, expenses & provisions ceil.
- [ ] Rounding happens only in CLP (after currency conversion). No per-currency rounding units.
- [ ] One-offs run through the same pipeline (Original + currency → Planificado).
- [ ] One-offs support all three currencies (CLP, CLF, USD), independent of catalog items.
- [ ] One-offs support an explicit `planned_override_clp` for custom Planificado values.
- [ ] Resumen subtotals smoothed by `approximations.minimum` (income floor, others ceil).
- [ ] Carry-over computation uses raw (un-smoothed) sums, not Resumen-smoothed values.
- [ ] Original / Original CLP / Planificado / Actual / Actual CLP all available per item (Original CLP in detail panel, others in main view).

### Planned vs Actual

- [ ] `paid = true` requires non-null actual.
- [ ] **Negative amounts disallowed** in all per-item fields by default.
- [ ] **Only two exceptions** allowing negative values: TC adjustment one-offs and savings retirement one-offs. Both are system-generated through structured actions; direct user entry of negatives is rejected.
- [ ] Unmarking preserves actual unless explicitly cleared.
- [ ] Resumen totals use actual ?? planned (substitution rule).
- [ ] Per-item variance visible in category tables.
- [ ] Skipped items have a required `skip_reason` and contribute zero.
- [ ] **Move to next month** action available on Pending or Skipped items mid-month, creating a rollover one-off in `month + 1` and marking the original as Skipped with system-set reason.
- [ ] **Pay credit card** bulk action: two flavors (nacional / internacional), pre-fills per-item actuals from planned, accepts a consolidated amount, and creates a `tc_adjustment` one-off in `variable` category for any non-zero delta.
- [ ] **Retire from savings** action: takes a positive amount from the user, validates `≤ Ahorro inicial − Σ prior retirements this month`, creates a `savings_retirement` one-off in `provision` category with `is_saving = true` and negative original amount.
- [ ] **Adjust savings** action: one `SavingsAdjustment` per (ledger, month) at most. User asserts new total; system computes delta. Affects `Ahorro inicial` from the next month onward; does not affect Resumen, cash flow, or paid status.
- [ ] `SavingsAdjustment` materialized into `MonthSnapshot.savings_adjustment` on close.
- [ ] `Ahorro inicial` formula per §11.2.1: prior closed-month is_saving sums + closed-month adjustment deltas.
- [ ] Net month close balance (§11.2) splits provision into `is_saving = false` and `is_saving = true` to avoid double-counting; savings flow only through `ahorro_presupuestado`.

### Month lifecycle

- [ ] Open months derive views on demand.
- [ ] Cache invalidates on any upstream write (via `catalog_version` counter).
- [ ] Cascade computation: month N triggers computation of all prior open months.
- [ ] Closing materializes a `MonthSnapshot`.
- [ ] Pending-items dialog on close (all-or-nothing rollover).
- [ ] Rollover one-offs flagged with `rollover_from_month`.
- [ ] Closed months are immutable except via amend workflow.
- [ ] Amend workflow appends to audit log with required reason.

### Carry-over & deficit

- [ ] Signed carry-over to next month's Monto en cuenta.
- [ ] Override field on MonthState respected.
- [ ] Deficit flag on every month with negative close_balance.
- [ ] Root-cause month identified and linked in the warning.
- [ ] Rolling minimum on dashboard.

### Multi-user

- [ ] Owner + member roles per ledger.
- [ ] Invite by email.
- [ ] Concurrent edit handling (optimistic UI + reconciliation).
- [ ] Server-side lock during close.

### Transfers

- [ ] `TransferLink` model.
- [ ] Synchronized amounts by default, unlink action available.
- [ ] Variance per leg is independent.

### UI

- [ ] Dashboard with timeline & deficit indicators.
- [ ] Month view with all blocks from §10.
- [ ] Catalog editor with inline editing and validation.
- [ ] Ledger settings (general, members, rounding, variation, budgets).
- [ ] Migration helper wizard.

---

## Appendix A — Mapping from sheets to spec

| Sheet concept | Spec concept |
|---|---|
| Top config block ("Aproximaciones", "Variaciones mensuales") | `LedgerConfig.approximations` (income/expense/minimum), `LedgerConfig.monthly_variation`, `LedgerConfig.exchange_surcharges` |
| Catalog tables (4 of them) | `CatalogItem` with `category` enum |
| Per-month sheets (e.g. "03-26") | `MonthState` + derived view OR `MonthSnapshot` if closed |
| `QUERY` formulas | Catalog query algorithm (§8) |
| Ingresos/Gastos/Previsión tables in monthly sheets | Derived planned items by category |
| `Ingresos puntuales` etc. tables | `OneOffItem` records |
| Checkboxes (TRUE/FALSE) | `paid` field on items |
| `Resumen` Total/Pendiente | Computed totals in month view (§10) |
| `Pago nacional/Internacional tarjeta` | Computed card payment block in month view |
| `Real vs Ideal` | Real vs Ideal block in month view |
| `Monto en cuenta`, `Ahorro inicial`, `Ahorro estimado/Retiro estimado` (family) | Personal-style balance block: `Monto en cuenta`, `Ahorro inicial`, `Ahorro presupuestado`, `Remanente estimado` |
| `Hoja mes anterior` reference | Implicit: carry-over rule (§11) |
| `Ajuste ingreso` / per-item `Ajuste` one-off rows | Mostly eliminated: variance is now per-item (paid items record their actual). For deferred payments, use the "Move to next month" action (§10.3). |
| `Ajuste TC` / `Cuadratura TC` one-off rows | Produced automatically by the "Pay credit card" bulk action (§10.3 → "Pay credit card") as `tc_adjustment = true` one-offs in the `variable` category. |
| `Retiro` (negative provision) / `Reposición` (positive provision) one-off pairs | Replaced by the "Retire from savings" action (§10.3 → "Retire from savings"), which produces a single negative `savings_retirement` one-off in provision. The matching positive `Reposición` is no longer needed because `Ahorro inicial` naturally decreases via the closed-month is_saving sum. Tracked per-bucket retirements are deferred to v2 (§16, item 3). |
| Manual changes to `Ahorro inicial` in the sheets (e.g. reflecting investment gains/losses or interest income) | First-class `SavingsAdjustment` entity (§5.1) recorded via the "Adjust savings" action (§10.3 → "Adjust savings"). One per month, asserts a new total balance, computes the delta, feeds into `Ahorro inicial` from the next month onwards without touching cash flow. |
| `Gastos Eve` / `Gastos Ricardo` matching rows | `TransferLink` between family and personal ledger catalog items |
| Frequency codes M/Q/Y/H | `frequency` enum; adds `CUSTOM` for irregular patterns |
| `Meses válidos` regex `(1\|2\|3\|...)` | Derived from `frequency` + `start_month` (or `custom_months` for CUSTOM); not stored |
| `Mes final` | Derived from `start_month` + `total_installments` + `frequency`; not stored |
| `Cuotas prepagadas` | Derived from `start_month` + `prepago_month`; not stored |
| "Sueldo 2025" + "Sueldo 2026" + ... as separate rows | Single `CatalogItem` (e.g. "Salary") with multiple `CatalogItemRevision` records, one per annual change |

---

## Appendix B — Worked example: a single month derivation

Inputs (simplified):

- Ledger: "Familia", currency rounding `CLP: 10000`, monthly variation UF `0.4%`.
- Target month: `2026-04-01`.
- Exchange rates for 2026-04: UF = 39,955; USD = 870 (from API).
- Catalog items (subset):
  - "Salary": income, currency CLP, frequency `M`, start 2025-03-01, total_installments=24. Revisions:
    - effective 2025-03-01 → $7,450,000 CLP, CASH
    - effective 2026-03-01 → $7,750,000 CLP, CASH
  - "Combustible": variable, $100,000 CLP, frequency `M`, TC, start 2024-08-01, total_installments=null (∞). Single revision.
  - "Permiso circulación": essential, $230,000 CLP, frequency `Y`, CASH, start 2025-03-01, total_installments=null. Single revision.
  - "Aseo municipal 1ra cuota": essential, $65,000 CLP, frequency `Y`, CASH, start 2026-04-01, total_installments=null. Single revision.

Derived fields (for reference, not stored):

- "Salary": `valid_months = {1..12}`, `end_month = 2027-02-01`, `prepaid_installments = 0`.
- "Combustible": `valid_months = {1..12}`, `end_month = ∞`, `prepaid_installments = 0`.
- "Permiso circulación": `valid_months = {3}`, `end_month = ∞`, `prepaid_installments = 0`.
- "Aseo municipal 1ra cuota": `valid_months = {4}`, `end_month = ∞`, `prepaid_installments = 0`.

For target month 2026-04:

| Item | Active revision | Passes conditions? | Original CLP | Planificado |
|---|---|---|---|---|
| Salary | effective 2026-03-01 → $7,750,000 | 1✓ 2✓ 3✓ 4✓ | $7,750,000 | $7,750,000 (income, floor to $50K) |
| Combustible | effective 2024-08-01 → $100,000 | All ✓ | $100,000 | $120,000 (variable, ceil to $30K) |
| Permiso circulación | effective 2025-03-01 → $230,000 | 3✗ (4 ∉ {3}) | — | does not appear |
| Aseo municipal 1ra cuota | effective 2026-04-01 → $65,000 | All ✓ | $65,000 | $90,000 (essential, ceil to $30K) |

Note that:

- The Salary revision dated 2026-03-01 takes effect for the April 2026 derivation, replacing the earlier $7,450,000 figure that applied in March 2025 through February 2026.
- "Combustible" $100,000 (already on a $30K boundary? no — $100K / $30K = 3.33, ceiling = 4 → $120K) shows how aggressive the conservative-by-default rule can be. The user can either set a `expense` unit they're more comfortable with, or accept that the budget is intentionally pessimistic.
- The Resumen "Esenciales" row would sum Combustible Planificado of $120K + Aseo Planificado of $90K = $210K (raw), then smooth to nearest $10K (ceil for expenses) = $210K. No change because it's already on a clean boundary.

---

## Appendix C — Proposed implementation order

This is a suggested build order. Each phase delivers something testable and stands on the previous phase's foundation. Phases can be split into smaller iterations; the order matters more than the granularity.

### Phase 0 — Foundations (1–2 weeks)

- Project scaffolding: framework choice, TypeScript config, lint/format, CI.
- Database schema for `User`, `Ledger`, `LedgerMember`, `CatalogItem`, `CatalogItemRevision`.
- Auth (sign up, sign in, sessions).
- Skeleton API: create/read ledgers, invite member (manual, no email yet), accept invite.
- Skeleton UI: ledger list, ledger create/edit, member management.

**Exit criteria:** can create a ledger as User A, invite User B, both log in and see the ledger.

### Phase 1 — Catalog kernel (1–2 weeks)

- Full `CatalogItem` + `CatalogItemRevision` CRUD with all validations from §13.3.
- Catalog editor UI (§13).
- Revision workflow UI (§13.5).
- No month views yet; this phase is just about getting the catalog right.

**Exit criteria:** can enter all catalog items from the source sheets, including multi-revision items like "Sueldo".

### Phase 2 — Catalog query + currency engine (1–2 weeks)

- Catalog query algorithm (§8), implemented as a pure function: `(ledgerId, month, revisions, items) → PlannedItem[]`.
- Exchange rate model: storage, mindicador.cl integration with daily fetch job, manual override fallback.
- Future-month rate projection via variation rates.
- Rounding engine (§9).
- Unit tests covering the worked example in Appendix B and other edge cases (prepago, installment exhaustion, valid_months filtering, revision selection).

**Exit criteria:** a CLI or admin tool can request "what does month X look like?" and produce the expected planned items, matching the source sheets.

### Phase 3 — Month view (read-only) (1 week)

- Month view UI (§10.1) rendering derived planned items.
- Balance block, card payments block, Real vs Ideal, Resumen (all read-only).
- Cascade computation (§11.4): visiting month N triggers derivation of all prior open months.
- Caching with `catalog_version` keying.

**Exit criteria:** can navigate to any open month and see a complete, accurate view that matches the source sheets for that month.

### Phase 4 — Actuals + one-offs (1 week)

- `ActualEntry` model and "marked paid" workflow (§10.3, §10.4).
- `OneOffItem` CRUD inline within the month view.
- Variance display per item.
- Resumen substitution (actual ?? planned).

**Exit criteria:** can mark items paid with actual amounts; Resumen reflects actuals; variances visible.

### Phase 5 — Carry-over + deficit (1 week)

- Carry-over computation (§11.2, §11.3).
- Deficit detection, root-cause identification, warning banners (§11.5).
- Rolling minimum.
- `monto_en_cuenta_override` on `MonthState`.

**Exit criteria:** opening any future month shows correct cumulative balance and deficit warnings.

### Phase 6 — Month close + immutability (1–2 weeks)

- Close workflow (§10.5): pending-items dialog, all-or-nothing rollover, snapshot materialization.
- `MonthSnapshot` model and storage.
- Closed month view (renders from snapshot, not derivation).
- Server-side close lock.

**Exit criteria:** can close a month; subsequent catalog edits don't affect the closed month.

### Phase 7 — Amend workflow (1 week)

- Amend UI from closed month view (§10.6).
- Audit log on `MonthSnapshot`.
- Downstream cache invalidation after amend.

**Exit criteria:** can correct a mistake in a closed month with a required reason, and downstream months reflect the corrected carry-over.

### Phase 8 — Dashboard (1 week)

- Dashboard layout (§12): mini-stats, timeline chart, deficit indicators.
- Cross-month navigation.

**Exit criteria:** the dashboard is the natural entry point and shows the 12-month outlook at a glance.

### Phase 9 — Cross-ledger transfers (1 week)

- `TransferLink` model.
- Catalog editor "this is a transfer" UI.
- Synchronized amount propagation, unlink action.
- Paid-on-one-side prompt to mark the other side.

**Exit criteria:** can set up a transfer between family and personal ledgers; changes propagate; both ledgers reconcile correctly.

### Phase 10 — Migration helper (1 week)

- JSON import format spec.
- Migration wizard UI (§15).
- Consolidation suggestions (multi-revision item detection from name patterns).
- Validation flow: pick a historical month from sheets, compare with new derivation.

**Exit criteria:** can migrate a real ledger from a sheets export in under an hour, with discrepancies surfaced for review.

### Phase 11 — Polish + multi-user hardening (1–2 weeks)

- Concurrent edit handling (optimistic UI, stale-data warnings).
- Email-based invitation flow.
- Responsive layout (mobile-friendly, even if not mobile-first).
- Error states, loading states, empty states across the app.
- Settings screen completeness (§14).

**Exit criteria:** the app is usable end-to-end by two non-technical users for their real budget.

### Estimated total: 12–17 weeks

For a self-build at a part-time pace, plan on roughly 4 months of focused evenings/weekends. The phases that benefit most from upfront test coverage are Phases 2, 5, and 6 — the math and state-machine logic. UI phases can move faster with less rigorous testing if you accept the rework cost.

### Recommended skips for a v0.5 / personal-use-only release

If the goal is to get off the sheets as soon as possible, the following can be deferred without breaking the core value:

- Phase 9 (cross-ledger transfers): can be approximated with manual mirrored items short-term.
- Phase 10 (migration wizard): can be replaced by a one-off seed script.
- Phase 11 multi-user hardening (other than basic auth): you and Eve can coordinate manually for a while.

Phases 0–8 are the irreducible core.

---

*End of spec v1.9.*
