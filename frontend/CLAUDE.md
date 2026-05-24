# Frontend

## Purpose & Scope

Vue 3 + TypeScript SPA for the budget app UI. Scaffold only — no router, store, API client, or i18n wired yet.

Handles: all user-facing rendering, API calls to backend, locale formatting.
Does NOT handle: domain logic, currency conversion, rounding — all server-side.

## Entry Points & Contracts

- `src/main.ts` — mounts `App.vue` on `#app`. All SFCs use `<script setup lang="ts">`.
- `vite.config.ts` — no dev proxy. The browser calls the API directly via `VITE_API_BASE_URL` (e.g. `http://localhost:8000` in dev, `https://api.modo-pato.rsantos.cl` in prod). CORS handles cross-origin.
- Styling: **Pico.css** (classless, semantic HTML). Custom CSS only when Pico's defaults don't cover a case.
- Type-checking via `vue-tsc --noEmit` (`npm run type-check`); runs in CI.

## Anti-patterns

- Don't implement rounding or carry-over math client-side; backend is authoritative (SPEC.md §9.1).
- Don't hardcode `UF` — use `CLF` in code; `UF` is a Spanish-locale display label only (SPEC.md §6.2).
- Don't reintroduce the Vite `/api` proxy — it was removed to match production URL semantics. Always use `VITE_API_BASE_URL`.
- Don't add component frameworks (Vuetify, Quasar, Element Plus). Semantic HTML + Pico.css is intentional.
