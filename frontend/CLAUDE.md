# Frontend

## Purpose & Scope

Vue 3 + TypeScript SPA for the budget app UI.

Handles: all user-facing rendering, API calls to backend, locale formatting.
Does NOT handle: domain logic, currency conversion, rounding — all server-side.

## Entry Points & Contracts

- `src/main.ts` — mounts `App.vue` on `#app`. All SFCs use `<script setup lang="ts">`.
- `vite.config.ts` — no dev proxy. Browser calls API directly via `VITE_API_BASE_URL`. CORS handles cross-origin.
- `src/lib/api.ts` — all backend calls go through here. 401s auto-retry once after token refresh; on second 401 calls `auth.logout()` and redirects to `/login`. Views never handle 401s.
- Styling: **Pico.css** (classless, semantic HTML). Custom CSS only when Pico's defaults don't cover a case.
- Type-checking via `vue-tsc --noEmit` (`npm run type-check`); runs in CI.

## Usage Patterns

**Views / tests:** `src/views/` mirrors backend apps (`auth/` ↔ accounts, `ledgers/` ↔ ledgers, `catalog/` ↔ catalog). `tests/` mirrors `src/` one-to-one. Note: `auth/` not `accounts/` — frontend only exposes auth flows.

**Breadcrumbs:** each route declares its own `meta.breadcrumbs: BreadcrumbFn`. `App.vue` evaluates generically — never add route-specific logic there. Omit on routes with no breadcrumb (auth pages, `/ledgers`).

**View template structure:**
- `<main>` and `<dialog>` are direct siblings in the body — never nest `<dialog>` inside `<main>`.
- `<section>` — thematic group, always has a heading. `<article>` — self-contained unit (a form that IS the page → `<main><article>`).
- `<fieldset class="grid">` — side-by-side form fields.
- Dialog footers sit outside `<form>`: cancel uses `class="secondary"`, submit needs `form="formId"`.

**Loading states:** `aria-busy` on the data container (not the section). `const loading = ref(true)` → set to `false` in `onMounted` `try/finally`. Never render loading text.

## Anti-patterns

- Don't implement rounding or carry-over math client-side; backend is authoritative (SPEC.md §9.1).
- Don't hardcode `UF` — use `CLF` in code; `UF` is a Spanish-locale display label only (SPEC.md §6.2).
- Don't reintroduce the Vite `/api` proxy — removed for prod parity (see [[HIDDEN-CONTRACTS.md]]). Always use `VITE_API_BASE_URL`.
- Don't add component frameworks (Vuetify, Quasar, Element Plus). Semantic HTML + Pico.css is intentional.

## Downlinks

[HIDDEN-CONTRACTS.md]: HIDDEN-CONTRACTS.md (non-obvious store behaviors, router guard, and CSS overrides — read before modifying stores, router, or app.css)
