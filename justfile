# List all commands
help:
  @just --list

# ── Docker ────────────────────────────────────────────────────────────────────

# Start all services in the background
up:
  docker compose up -d

# Stop all services
down:
  docker compose down

# Rebuild all images (or a specific one: just build backend)
build service="":
  docker compose build {{ service }}

# Follow logs for all services (or a specific one: just logs backend)
logs service="":
  docker compose logs -f {{ service }}

# Open shell of a specific service
ssh service:
  docker compose run --rm {{ service }} /bin/bash

# ── Backend ───────────────────────────────────────────────────────────────────

# Run backend tests with branch coverage
test-backend:
  docker compose run --rm backend uv run pytest

# Run Django makemigrations
makemigrations app:
  docker compose run --rm backend python manage.py makemigrations {{ app }}

# Run Django migrations
migrate app="":
  docker compose run --rm backend python manage.py migrate {{ app }}

# Create a Django superuser
createsuperuser:
  docker compose run --rm backend python manage.py createsuperuser

# Open Django shell
shell:
  docker compose run --rm backend python manage.py shell

# ── Frontend ──────────────────────────────────────────────────────────────────

# Run frontend tests with branch coverage
test-frontend:
  docker compose run --rm frontend sh -c "npm run type-check && npm run test:coverage"

# ── Combined ──────────────────────────────────────────────────────────────────

# Run all tests (backend + frontend)
test: test-backend test-frontend
