#!/usr/bin/env bash
# One-command bring-up of the full platform on a fresh/upgraded Ubuntu server.
# Generates all secrets itself, pulls CI-built images, runs migrations, starts
# everything behind Caddy. Re-runnable (keeps an existing .env).
#
# Usage on the server (as root):
#   export SITE_ADDRESS=195.19.12.120        # or your domain
#   # optional, only if the GHCR images are private:
#   #   export GHCR_USER=<github-username> GHCR_TOKEN=<PAT read:packages>
#   curl -fsSL https://raw.githubusercontent.com/pachaninm-lab/pachanin-demo/refs/heads/claude/cabinet-design-audit-2jbv6f/infra/single-server/bootstrap.sh | bash
set -euo pipefail

BRANCH=claude/cabinet-design-audit-2jbv6f
SRC=/opt/pachanin
APP="$SRC/infra/single-server"

echo "==> Docker"
command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh

echo "==> Source (public repo, branch $BRANCH)"
if [ -d "$SRC/.git" ]; then git -C "$SRC" fetch --depth 1 origin "$BRANCH" && git -C "$SRC" reset --hard FETCH_HEAD
else git clone --depth 1 -b "$BRANCH" https://github.com/pachaninm-lab/pachanin-demo "$SRC"; fi
cd "$APP"
chmod +x init-roles.sh

echo "==> Secrets (.env) — generated once, kept on re-run"
if [ ! -f .env ]; then
  gen() { openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | head -c 32; }
  cat > .env <<EOF
SITE_ADDRESS=${SITE_ADDRESS:?export SITE_ADDRESS=<server-ip-or-domain>}
IMAGE_PREFIX=ghcr.io/pachaninm-lab/grainflow
DDL_PASSWORD=$(gen)
APP_PASSWORD=$(gen)
AUTH_PASSWORD=$(gen)
STORAGE_PASSWORD=$(gen)
REDIS_PASSWORD=$(gen)
PG_SHARED_BUFFERS=1GB
JWT_SECRET=$(openssl rand -hex 32)
RATE_LIMIT_KEY_PEPPER=$(openssl rand -hex 24)
BANK_HMAC_SECRET=$(openssl rand -hex 24)
FGIS_WEBHOOK_SECRET=$(openssl rand -hex 32)
EDO_WEBHOOK_SECRET=$(openssl rand -hex 32)
MINIO_ROOT_USER=grainflow
MINIO_ROOT_PASSWORD=$(gen)
BANK_PARTNER_ID=safe-deals
BANK_HMAC_KEY_ID=primary
AUTH_TEST_ACCOUNTS_ENABLED=0
ALLOW_RUNTIME_MUTATION=0
EOF
  echo "   .env created (secrets saved in $APP/.env)"
fi

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "==> GHCR login"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:?}" --password-stdin
fi

echo "==> Pull + start"
docker compose pull
docker compose up -d
sleep 5
docker compose ps
echo
echo "==> Done. Health in ~30-60s:  curl -s http://localhost/health"
