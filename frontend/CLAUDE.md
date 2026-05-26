# Frontend

## Purpose & Scope

Vue 3 + TypeScript SPA for the budget app UI.

Handles: all user-facing rendering, API calls to backend, locale formatting.
Does NOT handle: domain logic, currency conversion, rounding — all server-side.

## Entry Points & Contracts

- `src/main.ts` — mounts `App.vue` on `#app`. All SFCs use `<script setup lang="ts">`.
- `vite.config.ts` — no dev proxy. The browser calls the API directly via `VITE_API_BASE_URL` (e.g. `http://localhost:8000` in dev, `https://api.modo-pato.rsantos.cl` in prod). CORS handles cross-origin.
- Styling: **Pico.css** (classless, semantic HTML). Custom CSS only when Pico's defaults don't cover a case.
- Type-checking via `vue-tsc --noEmit` (`npm run type-check`); runs in CI.

## Usage Patterns

### Views structure

`src/views/` is organized by domain subdirectory, mirroring backend Django apps as closely as possible:

- `auth/` ↔ `accounts` app — login, signup
- `ledgers/` ↔ `ledgers` app — ledger list, detail, members

When a new backend app ships, create a matching subdirectory under `src/views/`. The `auth` exception (vs `accounts`) is intentional: the frontend only exposes authentication flows, not account management.

### Test structure

`tests/` mirrors `src/` directly — same subdirectory structure:

- `tests/views/auth/`, `tests/views/ledgers/` — view tests, mirroring `src/views/`
- `tests/stores/` — store tests, mirroring `src/stores/`
- `tests/lib/` — lib tests, mirroring `src/lib/`
- `tests/router/` — router tests, mirroring `src/router/`
- `tests/App.test.ts` — mirrors `src/App.vue`

When a new `src/<dir>/` is added, create a matching `tests/<dir>/`.

### View template structure

Body has two direct children: `<header>` (rendered by `App.vue`) and `<main>` (rendered by each view). Never add wrapper `<div>`s.

Inside `<main>`, content is grouped by semantic element:

- **`<section>`** — thematic grouping. Always has a heading at the appropriate outline level (`<h2>` for top-level, `<h3>` for subsections within a section).
- **`<article>`** — self-contained unit that could stand alone: a form that is the entire purpose of the page, a card. A form that IS the page → `<main><article>`; a form that is one part of a page → `<article>` inside a `<section>`.
- **`<fieldset class="grid">`** — groups side-by-side form fields within a form.
- Form submission: `<input type="submit" :value="t('...')">` and `<input type="reset" :value="t('...')" @click="...">` — never `<button type="submit">`.

### Loading states

Use Pico.css's `aria-busy` pattern — never render loading text. Add `const loading = ref(true)` in `<script setup>`, wrap the fetch in `onMounted` with `try/finally` to guarantee `loading.value = false` even on error, and bind `:aria-busy="loading"` on a `<div>` wrapping only the data-dependent content (not the section heading). Gate content inside with `v-if="!loading"`.

## Anti-patterns

- Don't implement rounding or carry-over math client-side; backend is authoritative (SPEC.md §9.1).
- Don't hardcode `UF` — use `CLF` in code; `UF` is a Spanish-locale display label only (SPEC.md §6.2).
- Don't reintroduce the Vite `/api` proxy — it was removed to match production URL semantics. Always use `VITE_API_BASE_URL`.
- Don't add component frameworks (Vuetify, Quasar, Element Plus). Semantic HTML + Pico.css is intentional.
