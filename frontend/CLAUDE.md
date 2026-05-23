# Frontend

## Purpose & Scope

Vue 3 SPA for the budget app UI. Scaffold only — no router, store, API client, or i18n wired yet.

Handles: all user-facing rendering, API calls to backend, locale formatting.
Does NOT handle: domain logic, currency conversion, rounding — all server-side.

## Entry Points & Contracts

- `src/main.js` — mounts `App.vue` on `#app`
- `vite.config.js` — dev proxy: `/api` → `http://backend:8000`
- Production API base URL via `VITE_API_BASE_URL` env var (not yet consumed)

## Anti-patterns

- Don't implement rounding or carry-over math client-side; backend is authoritative (SPEC.md §9.1).
- Don't hardcode `UF` — use `CLF` in code; `UF` is a Spanish-locale display label only (SPEC.md §6.2).
