# Modo Pato

A personal/family budget app: multi-user, multi-currency (CLP / CLF / USD), with catalog-driven monthly projections and planned-vs-actual reconciliation. Built to replace two long-lived Google Sheets without losing any of their automation.

> **Status:** pre-`1.0.0`. The product is being built phase by phase per [`docs/ROADMAP.md`](docs/ROADMAP.md). No user-facing release yet.

## Stack

- **Backend:** Django + Django REST Framework, PostgreSQL 16, `pytest` + `pytest-django` for tests.
- **Frontend:** Vue 3 + TypeScript + [Pico.css](https://picocss.com/), Vue Router, vue-i18n (bilingual `en` / `es-CL`), Vitest for tests.
- **Dev environment:** Docker Compose — one Postgres, two Django services (`backend` for the API on `:8000`, `admin` for Django admin on `:8001`), and Vite for the frontend on `:5173`.
- **Production target:** Hetzner CAX11 (ARM) behind Cloudflare Tunnel, Cloudflare Pages for the SPA, Neon Postgres, R2 for backups. Full plan in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Quick start (local development)

Prerequisites: Docker Desktop (or Docker Engine + Compose v2).

```bash
git clone <repo-url>
cd modo-pato
cp .env.example .env       # adjust DB password if you like
docker compose up --build
```

Once the stack is up:

| Service                    | URL                                | Notes                                 |
| -------------------------- | ---------------------------------- | ------------------------------------- |
| Frontend (Vite dev server) | <http://localhost:5173>            | Vue 3 SPA                             |
| API                        | <http://localhost:8000/v1/health/> | Returns `{"status":"ok"}`             |
| Django admin               | <http://localhost:8001/>           | Mounted at root (no `/admin/` prefix) |
| PostgreSQL                 | `localhost:5432`                   | Credentials from `.env`               |

The `backend` and `admin` containers run from the same image; the URL configuration is selected by the `DJANGO_URLCONF` environment variable. The browser calls the API directly via `VITE_API_BASE_URL`; there is no Vite proxy.

### Common commands

```bash
# Backend tests
docker compose exec backend pytest

# Frontend type-check + tests
docker compose exec frontend npm run type-check
docker compose exec frontend npm run test

# Frontend production build
docker compose exec frontend npm run build

# Create a Django superuser to log into admin
docker compose exec backend python manage.py createsuperuser
```

## Where to read next

- **What's coming and when:** [`docs/ROADMAP.md`](docs/ROADMAP.md).
- **Why the app behaves the way it does:** [`docs/SPEC.md`](docs/SPEC.md). The design contract for every domain rule, validation, and algorithm.
- **How production is wired:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- **Per-phase implementation checklist (for contributors and AI agents):** [`V1-IMPLEMENTATION-PLAN.md`](V1-IMPLEMENTATION-PLAN.md).
- **AI agent context:** root-level `CLAUDE.md` and per-directory `backend/CLAUDE.md` / `frontend/CLAUDE.md` capture intent and anti-patterns.

## Contributing

This is a personal project, but the workflow assumes standard PR-based development from `0.1.0` onward:

- `main` is protected. All changes land via pull request.
- CI runs backend `pytest` and frontend Vitest + `vue-tsc` on every PR. Both must pass before merge.
- Backend and frontend versions move in lockstep — every PR that bumps one bumps the other.

## License

MIT — see [`LICENSE`](LICENSE).
