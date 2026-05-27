# Frontend — Hidden Contracts

## Purpose & Scope

Non-obvious behaviors and workarounds that aren't expressed in code. Read before modifying stores, router, or `app.css`.

## Entry Points & Contracts

**`fetchMembers(id)` sets `activeLedger` as a side effect.** It calls `fetchOne(id)` first if `activeLedger` doesn't match. Views must rely on this — never call `fetchOne` separately before `fetchMembers`. `activeLedger` is guaranteed set after `fetchMembers` returns.

**`meta: { public: true }` opts a route out of the auth guard.** All routes without it redirect to `/login` when unauthenticated. New public routes (e.g. invite accept) must set this flag.

**Vite proxy removal was intentional for prod parity.** Re-adding it would cause dev/prod divergence in CORS and cookie behavior — dev and prod both hit the backend directly via `VITE_API_BASE_URL`.

## Usage Patterns

**Non-credential inputs need `data-1p-ignore`.** 1Password injects autofill into any text input it heuristically identifies as a credential field. `autocomplete="off"` is ignored by 1Password by design. Add `data-1p-ignore` directly on the `<input>` element (field-level only — the attribute on `<form>` has no effect).

**`app.css` Pico specificity override.** `article > footer button[type=submit] { width: auto }` overrides Pico's `button[type=submit] { width: 100% }`. Pico's rule has specificity (0,1,1); the override must include the attribute selector to reach (0,1,3) and win. Do not remove — dialog footer submit buttons go full-width without it.
