#!/usr/bin/env bash
# One-time bring-up of the full platform on a single paid server.
#
# Prereqs: a fresh Ubuntu host, and a GitHub read-only token (classic PAT with
# read:packages) so the host can pull the private images.
#
# Usage (run on the server, as root):
#   export GHCR_USER=<github-username>
#   export GHCR_TOKEN=<github-PAT-with-read:packages>
#   curl -fsSL https://raw.githubusercontent.com/pachaninm-lab/pachanin-demo/main/infra/single-server/bootstrap.sh | bash
# (or copy this repo folder to /opt/grainflow and run it there)
set -euo pipefail

APP_DIR=/opt/grainflow

echo "==> Installing Docker (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Fetching deployment files"
install -d "$APP_DIR"
cd "$APP_DIR"
for f in docker-compose.yml Caddyfile init-roles.sh .env.example; do
  curl -fsSL "https://raw.githubusercontent.com/pachaninm-lab/pachanin-demo/main/infra/single-server/$f" -o "$f"
done
chmod +x init-roles.sh
[ -f .env ] || cp .env.example .env

echo "==> Logging in to GitHub Container Registry"
: "${GHCR_USER:?export GHCR_USER=<github-username>}"
: "${GHCR_TOKEN:?export GHCR_TOKEN=<github PAT with read:packages>}"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

echo
echo "==> EDIT $APP_DIR/.env NOW (set SITE_ADDRESS and all passwords), then run:"
echo "      cd $APP_DIR && docker compose pull && docker compose up -d"
echo
echo "    Check status:   docker compose ps"
echo "    App health:     curl -s http://localhost/health"
echo "    Watchtower then auto-updates images as CI publishes them."
