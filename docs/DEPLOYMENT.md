# Deployment Architecture & CI/CD Plan

## Context

modo-pato is a personal/family budget app (Django + Vue 3 + PostgreSQL). The goal is to deploy it with minimal cost (~$4/month) while maintaining data safety and DDoS protection. This plan validates the chosen architecture and defines a CI/CD pipeline with all manual and automated steps.

- **Domain:** `rsantos.cl` (already on Cloudflare DNS)
- **Frontend URL:** `modo-pato.rsantos.cl`
- **API URL:** `api.modo-pato.rsantos.cl`
- **VPS:** Hetzner CAX11 (ARM, ~€3.79/mo)

## Final Architecture

```
                    Cloudflare Network
                   ┌─────────────────────────────────────────────┐
                   │                                             │
User (Chile) ──────┤  Cloudflare Pages ── modo-pato.rsantos.cl   │
                   │  (Vue 3 SPA)                                │
                   │                                             │
                   │  Cloudflare Tunnel ── api.modo-pato.rsantos.cl │
                   │       │                                     │
                   └───────┼─────────────────────────────────────┘
                           │ (outbound tunnel, no open ports)
                           │
                   ┌───────▼─────────────────────────────────────┐
                   │  Hetzner VPS (Ashburn, US-East)              │
                   │  ┌─────────────┐  ┌──────────────────┐      │
                   │  │ cloudflared │  │ Docker            │      │
                   │  │ (systemd)   │  │  └─ gunicorn      │      │
                   │  └─────────────┘  │     (Django API)  │      │
                   │                   └──────────────────┘      │
                   │  ┌──────────────────────────────────┐       │
                   │  │ Cron: pg_dump → rclone → R2      │       │
                   │  └──────────────────────────────────┘       │
                   └─────────────────────────────────────────────┘
                           │
                   ┌───────▼─────────────────────────────────────┐
                   │  Neon PostgreSQL (AWS us-east-1)             │
                   │  Free tier, ~2-4ms from Hetzner Ashburn      │
                   └─────────────────────────────────────────────┘

Backups: Cloudflare R2 (free, 10GB)
Registry: GitHub Container Registry (free)
CI/CD: GitHub Actions
```

**Monthly cost: ~€3.79 / ~$4 (Hetzner CAX11 ARM only). Everything else is free.**

---

## Phase 1: Manual Platform Setup (one-time)

These steps must be done manually before any automation works.

### 1.1 Neon (Database)

1. Go to https://neon.tech → Sign up / Log in
2. Create a new project:
   - Name: `modo-pato`
   - Region: **AWS us-east-1 (N. Virginia)** — co-located with Hetzner Ashburn
   - Postgres version: 16
3. Copy the connection string. It looks like:
   ```
   postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/modopato?sslmode=require
   ```
   **Important:** `?sslmode=require` is mandatory — Neon rejects non-SSL connections.
4. Save this as your production `DATABASE_URL`.

### 1.2 Hetzner (VPS)

1. Go to https://console.hetzner.cloud → Sign up / Log in
2. Create a new project: `modo-pato`
3. Add your SSH public key (Settings → SSH Keys)
4. Create a server:
   - Location: **Ashburn** (US-East)
   - Image: **Debian 12** (lighter and more stable than Ubuntu — fewer surprise updates, same Docker/cloudflared compatibility)
   - Type: **CAX11** (ARM, 2 vCPU, 4GB RAM, 40GB SSD, ~€3.79/mo)
   - SSH key: select the one you added
   - Name: `modo-pato`
5. Note the server's public IP (needed for SSH and initial tunnel setup)

### 1.3 Cloudflare (DNS, Tunnel, Pages, R2)

**Prerequisites:** You already have a Cloudflare account with `rsantos.cl` configured for DNS.

#### 1.3.1 Cloudflare Tunnel

1. Go to **Zero Trust** → **Networks** → **Tunnels**
2. Click **Create a tunnel** → Select **Cloudflared**
3. Name: `modo-pato`
4. Copy the tunnel token (a long string starting with `eyJ...`)
5. Skip the connector install step (we'll do it on the VPS later)
6. Add a **Public Hostname**:
   - Subdomain: `api.modo-pato`
   - Domain: `rsantos.cl`
   - Service: `http://localhost:8000`
7. Save the tunnel

This creates a DNS CNAME record for `api.modo-pato.rsantos.cl` automatically.

#### 1.3.2 Cloudflare Pages (Frontend)

1. Go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select the `modo-pato` repository
3. Configure build:
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `frontend`
4. Add environment variable:
   - `VITE_API_BASE_URL` = `https://api.modo-pato.rsantos.cl`
5. Deploy (it will build and deploy the current `main` automatically)
6. Add custom domain: `modo-pato.rsantos.cl` (Pages will guide you through DNS — since `rsantos.cl` is already on Cloudflare, this is automatic)

**No GitHub Actions workflow is needed for frontend** — Cloudflare Pages has native GitHub integration and auto-deploys on push.

#### 1.3.3 Cloudflare R2 (Backup Storage)

1. Go to **Storage & Databases** → **R2** → **Create bucket**
2. Name: `modo-pato-backups`
3. Location: **Automatic** (or US East if available)
4. Go to **R2** → **Manage R2 API Tokens** → **Create API Token**
   - Permissions: **Object Read & Write**
   - Scope: bucket `modo-pato-backups` only
5. Save the **Access Key ID** and **Secret Access Key** (needed for rclone config on VPS)
6. Note the **S3 endpoint** (looks like `https://<account-id>.r2.cloudflarestorage.com`)

### 1.4 GitHub (Secrets)

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → add these secrets:

| Secret | Value | Used by |
|--------|-------|---------|
| `VPS_HOST` | Hetzner server IP | Backend deploy workflow |
| `VPS_SSH_KEY` | Private SSH key (the pair of what you added to Hetzner) | Backend deploy workflow |
| `VPS_USER` | `deploy` (we'll create this user on the VPS) | Backend deploy workflow |

---

## Phase 2: VPS One-Time Provisioning

SSH into the Hetzner VPS as root and run the setup. This is a one-time operation.

All deployment configs (docker-compose.prod.yml, backup.sh, provisioning script) are tracked in the repo under `deploy/` so the VPS is reproducible if it needs to be rebuilt.

### 2.1 Create deploy user

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
```

### 2.2 Harden SSH

Edit `/etc/ssh/sshd_config`:
```
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers deploy
```
Then: `systemctl restart sshd`

**Update `VPS_HOST` in GitHub secrets if you change the SSH port** (the workflow uses port 2222).

### 2.3 Configure Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp   # SSH
# NO ports 80/443 — all HTTP traffic goes through Cloudflare Tunnel
ufw enable
```

### 2.4 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
```

### 2.5 Install and configure cloudflared

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflared-signing.key | gpg --dearmor -o /usr/share/keyrings/cloudflared-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflared-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared bookworm main" > /etc/apt/sources.list.d/cloudflared.list
apt update && apt install -y cloudflared
```

Configure the tunnel:
```bash
mkdir -p /etc/cloudflared
cat > /etc/cloudflared/config.yml << 'EOF'
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/credentials.json
ingress:
  - hostname: api.modo-pato.rsantos.cl
    service: http://localhost:8000
  - service: http_status:404
EOF
```

Install the token (from step 1.3.1):
```bash
cloudflared service install <TUNNEL_TOKEN>
systemctl enable cloudflared
systemctl start cloudflared
```

### 2.6 Install rclone (for backups)

```bash
curl https://rclone.org/install.sh | bash
```

Configure R2 remote:
```bash
mkdir -p /home/deploy/.config/rclone
cat > /home/deploy/.config/rclone/rclone.conf << EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = <R2_ACCESS_KEY_ID>
secret_access_key = <R2_SECRET_ACCESS_KEY>
endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
acl = private
no_check_bucket = true
EOF
chown -R deploy:deploy /home/deploy/.config
```

### 2.7 Create production environment file

```bash
mkdir -p /home/deploy/modo-pato
cat > /home/deploy/modo-pato/.env << EOF
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/modopato?sslmode=require
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
DEBUG=False
ALLOWED_HOSTS=api.modo-pato.rsantos.cl
CORS_ALLOWED_ORIGINS=https://modo-pato.rsantos.cl
CSRF_TRUSTED_ORIGINS=https://api.modo-pato.rsantos.cl
EOF
chown deploy:deploy /home/deploy/modo-pato/.env
chmod 600 /home/deploy/modo-pato/.env
```

### 2.8 Create production docker-compose

```bash
cat > /home/deploy/modo-pato/docker-compose.prod.yml << 'EOF'
services:
  backend:
    image: ghcr.io/<GITHUB_USER>/modo-pato-backend:latest
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:8000:8000"
    command: >
      gunicorn config.wsgi:application
      --bind 0.0.0.0:8000
      --workers 2
      --timeout 120
      --access-logfile -
      --error-logfile -
EOF
chown deploy:deploy /home/deploy/modo-pato/docker-compose.prod.yml
```

Note: port binds to `127.0.0.1` only — accessible to cloudflared but not from the internet.

### 2.9 Set up backup cron

```bash
cat > /home/deploy/backup.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

source /home/deploy/modo-pato/.env

DATE=$(date +%Y/%m/%d)
FILENAME="modopato-$(date +%Y%m%d-%H%M%S).dump.gz"

pg_dump "$DATABASE_URL" -Fc | gzip | rclone rcat "r2:modo-pato-backups/${DATE}/${FILENAME}"

# Keep only last 30 days of daily backups (skip 1st-of-month files = monthly forever)
rclone delete "r2:modo-pato-backups" --min-age 30d \
  --exclude "**/01/**" \
  2>/dev/null || true

echo "[$(date)] Backup complete: ${DATE}/${FILENAME}"
SCRIPT

chmod +x /home/deploy/backup.sh
chown deploy:deploy /home/deploy/backup.sh
```

Install `postgresql-client` for `pg_dump`:
```bash
apt install -y postgresql-client-16
```

Add to deploy user's crontab:
```bash
su - deploy -c 'crontab -l 2>/dev/null; echo "0 2 * * * /home/deploy/backup.sh >> /home/deploy/backup.log 2>&1"' | crontab -u deploy -
```

#### Restore procedure (test this!)

```bash
# Download a backup from R2
rclone copy "r2:modo-pato-backups/2026/05/23/modopato-20260523-020000.dump.gz" /tmp/

# Decompress
gunzip /tmp/modopato-20260523-020000.dump.gz

# Restore to Neon (will drop and recreate objects)
pg_restore --clean --if-exists --no-owner \
  -d "$DATABASE_URL" /tmp/modopato-20260523-020000.dump
```

---

## Phase 3: Code Changes Required

These modifications prepare the codebase for production deployment.

### 3.1 Add gunicorn dependency

**File: `backend/pyproject.toml`** — add `gunicorn>=22.0` to `[project.dependencies]`.

### 3.2 Add whitenoise for static files

**File: `backend/pyproject.toml`** — add `whitenoise>=6.5` to `[project.dependencies]`.

**File: `backend/config/settings.py`** — changes:
- Add `STATIC_ROOT = BASE_DIR / 'staticfiles'`
- Add `'whitenoise.middleware.WhiteNoiseMiddleware'` after `SecurityMiddleware`
- Add `STORAGES` config for whitenoise compressed manifest
- Add `CSRF_TRUSTED_ORIGINS` env var support

### 3.3 Update backend Dockerfile for production

**File: `backend/Dockerfile`** — add:
- `RUN python manage.py collectstatic --noinput` at build time
- Expose port 8000
- Default CMD with gunicorn

### 3.4 Frontend API base URL

**File: `frontend/src/api.js`** (new) — create a small API client that reads `import.meta.env.VITE_API_BASE_URL` for the base URL. In dev this falls back to empty string (proxy handles it), in production it points to `https://api.modo-pato.rsantos.cl`.

### 3.5 Update .env.example

**File: `.env.example`** — add production-relevant vars:
```
CSRF_TRUSTED_ORIGINS=https://api.modo-pato.rsantos.cl
```

---

## Phase 4: GitHub Actions Backend Workflow

**File: `.github/workflows/deploy-backend.yml`**

Only one workflow needed — Cloudflare Pages handles the frontend automatically.

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'deploy/**'
      - '.github/workflows/deploy-backend.yml'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/modo-pato-backend

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up QEMU (for ARM cross-build)
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push Docker image (ARM64)
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          push: true
          platforms: linux/arm64
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

      - name: Copy deploy files to VPS
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: 2222
          source: "deploy/docker-compose.prod.yml,deploy/backup.sh"
          target: "/home/deploy/modo-pato"
          strip_components: 1

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: 2222
          script: |
            cd /home/deploy/modo-pato
            echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker image prune -f
```

---

## Phase 5: Verification Checklist

After everything is deployed, verify each layer:

### 5.1 Tunnel + Backend
```bash
curl https://api.modo-pato.rsantos.cl/api/v1/health/
# Expected: {"status":"ok"}
```

### 5.2 Frontend
- Open `https://modo-pato.rsantos.cl` in browser
- Check browser DevTools → Network tab: API calls should go to `api.modo-pato.rsantos.cl`

### 5.3 Firewall (from any external machine)
```bash
nmap <HETZNER_IP>
# Expected: only port 2222 (SSH) open. No 80, 443, 8000.
```

### 5.4 Backup
```bash
# On VPS, as deploy user:
./backup.sh
rclone ls r2:modo-pato-backups
# Should show today's dump file

# Test restore against a local Postgres:
rclone copy "r2:modo-pato-backups/2026/05/23/<filename>" /tmp/
gunzip /tmp/<filename>
pg_restore --clean --if-exists --no-owner -d "postgresql://local_user:pass@localhost/test_restore" /tmp/<file>
```

### 5.5 CI/CD
- Push a change to `backend/` → GitHub Actions should build, push image, SSH deploy
- Push a change to `frontend/` → Cloudflare Pages should auto-build and deploy
- Verify both complete successfully

---

## Summary of Files to Create/Modify

### Code changes
| File | Action | Purpose |
|------|--------|---------|
| `backend/pyproject.toml` | Modify | Add gunicorn, whitenoise |
| `backend/Dockerfile` | Modify | Add collectstatic, CMD with gunicorn |
| `backend/config/settings.py` | Modify | Add whitenoise, STATIC_ROOT, CSRF_TRUSTED_ORIGINS |
| `frontend/src/api.js` | Create | API base URL from env var |
| `.env.example` | Modify | Add production vars |

### Deployment files (tracked in repo under `deploy/`)

**`deploy/docker-compose.prod.yml`** — production compose file (backend only, no DB):
```yaml
services:
  backend:
    image: ghcr.io/<GITHUB_USER>/modo-pato-backend:latest
    restart: unless-stopped
    env_file: .env                    # reads secrets from VPS-local .env (never tracked)
    ports:
      - "127.0.0.1:8000:8000"        # localhost only — cloudflared proxies to this
    command: >
      gunicorn config.wsgi:application
      --bind 0.0.0.0:8000
      --workers 2
      --timeout 120
      --access-logfile -
      --error-logfile -
```

**`deploy/backup.sh`** — daily pg_dump → R2 script:
```bash
#!/bin/bash
set -euo pipefail
source /home/deploy/modo-pato/.env   # reads DATABASE_URL from VPS-local .env
DATE=$(date +%Y/%m/%d)
FILENAME="modopato-$(date +%Y%m%d-%H%M%S).dump.gz"
pg_dump "$DATABASE_URL" -Fc | gzip | rclone rcat "r2:modo-pato-backups/${DATE}/${FILENAME}"
rclone delete "r2:modo-pato-backups" --min-age 30d --exclude "**/01/**" 2>/dev/null || true
echo "[$(date)] Backup complete: ${DATE}/${FILENAME}"
```

**`deploy/cloudflared.yml`** — tunnel ingress config (tunnel ID is injected on the VPS, not stored here):
```yaml
# Copied to /etc/cloudflared/config.yml on the VPS
# tunnel: <set during provisioning>
# credentials-file: <set during provisioning>
ingress:
  - hostname: api.modo-pato.rsantos.cl
    service: http://localhost:8000
  - service: http_status:404
```

**`deploy/provision.sh`** — one-time VPS setup script. Contains:
- Create `deploy` user + SSH key setup
- Harden SSH (port 2222, key-only, no root login)
- Configure UFW firewall (allow SSH only, no HTTP ports)
- Install Docker, enable service
- Install cloudflared via apt
- Install rclone via install script
- Install postgresql-client-16 for pg_dump
- Create directory structure (`/home/deploy/modo-pato/`)
- Set up backup cron (daily at 2am)
- Placeholder prompts for secrets (DATABASE_URL, SECRET_KEY, tunnel token, R2 keys) that the operator fills in manually

**`deploy/.env.example`** — documents required production env vars (no real values):
```
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
SECRET_KEY=generate-a-random-secret-key
DEBUG=False
ALLOWED_HOSTS=api.modo-pato.rsantos.cl
CORS_ALLOWED_ORIGINS=https://modo-pato.rsantos.cl
CSRF_TRUSTED_ORIGINS=https://api.modo-pato.rsantos.cl
```

**`.github/workflows/deploy-backend.yml`** — CI/CD pipeline (detailed in Phase 4 above)

### Never tracked (secrets — live only on VPS or in GitHub Secrets)

| Data | Where it lives |
|------|---------------|
| `DATABASE_URL` (Neon connection string with password) | VPS `/home/deploy/modo-pato/.env` |
| `SECRET_KEY` (Django signing key) | VPS `.env` |
| Cloudflare tunnel token | VPS systemd service config |
| R2 API keys (access key + secret) | VPS rclone config |
| SSH private key | GitHub Secrets + local machine |
| VPS IP address | GitHub Secrets (`VPS_HOST`) |
