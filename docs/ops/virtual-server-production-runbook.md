# Virtual-server production runbook

## 1. Authority and inventory

Production endpoint: `https://процент-агро.рф`

Current recorded hosting inventory:

- provider: REG.RU;
- public IPv4: `195.19.12.120`;
- OS: Ubuntu;
- runtime: Docker Compose;
- edge: Caddy with automatic HTTPS;
- application: Next.js `web` container and API/data services managed by the production Compose contour;
- registry: GHCR;
- source authority: GitHub `main`.

The domain is authoritative for routing. Verify its current A record before SSH access. Do not assume that the recorded IP is immutable.

## 2. Protected values

The following values must be obtained from protected operations storage and must not be committed or pasted into tickets, PRs or chat:

- `PC_PROD_SSH_USER`;
- SSH private key or Termius credential;
- `PC_PROD_DIR` — server working directory;
- `PC_PROD_COMPOSE` — production Compose filename/path;
- production `.env` and secret-store values;
- GHCR credentials when required.

The examples below intentionally use variables instead of real credentials.

```bash
export PC_PROD_HOST=195.19.12.120
export PC_PROD_DOMAIN=xn----8sbjf4befbjgs9b.xn--p1ai
export PC_TARGET_SHA=<full-main-commit-sha>
export PC_PROD_SSH_USER=<from-protected-inventory>
export PC_PROD_DIR=<from-protected-inventory>
export PC_PROD_COMPOSE=<from-protected-inventory>
```

## 3. Pre-deploy checks

Before touching the server:

1. Confirm `PC_TARGET_SHA` exists in `main`.
2. Confirm required CI, security and unit checks passed.
3. Confirm the canonical GHCR image was published for the target SHA.
4. Confirm the image build used `infra/docker/Dockerfile.web` or the appropriate canonical Dockerfile.
5. Confirm the domain currently resolves to the expected server.
6. Classify the change:
   - application image only;
   - Compose/Caddy/environment;
   - database migration/provisioning;
   - mixed release.
7. Record the currently accepted running revision for rollback.

The root `docker-compose.yml` in the repository is local-development infrastructure. Do not use it as the production Compose file.

## 4. Connect and inspect

```bash
ssh "${PC_PROD_SSH_USER}@${PC_PROD_HOST}"
cd "${PC_PROD_DIR}"
docker compose -f "${PC_PROD_COMPOSE}" ps
```

Confirm that the expected services are present and that Caddy is healthy before changing anything.

For the current web container:

```bash
WEB_ID="$(docker compose -f "${PC_PROD_COMPOSE}" ps -q web)"
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${WEB_ID}"
docker inspect --format '{{ .Config.Image }}' "${WEB_ID}"
```

Save the revision and image reference as the rollback baseline.

## 5. Application-image deployment

The canonical image workflow publishes API and web images with SHA and `latest` tags. The server currently has an automatic image updater, but automatic polling is not release evidence.

For a web-only change, prefer a targeted update:

```bash
docker compose -f "${PC_PROD_COMPOSE}" pull web
docker compose -f "${PC_PROD_COMPOSE}" up -d --no-deps web
```

For an API-only change, use the equivalent targeted `api` update. Do not restart PostgreSQL, Redis, MinIO or Caddy for a UI-only release.

After recreation:

```bash
docker compose -f "${PC_PROD_COMPOSE}" ps web
WEB_ID="$(docker compose -f "${PC_PROD_COMPOSE}" ps -q web)"
ACTUAL_SHA="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${WEB_ID}")"
test "${ACTUAL_SHA}" = "${PC_TARGET_SHA}"
```

If the revision does not match, the release is not deployed even when the container is healthy.

## 6. Compose, Caddy or environment deployment

Image polling does not apply infrastructure changes. For a change to the server-side Compose definition, Caddy configuration or environment:

```bash
cd "${PC_PROD_DIR}"
git fetch --prune origin
git checkout main
git pull --ff-only origin main
docker compose -f "${PC_PROD_COMPOSE}" config --quiet
docker compose -f "${PC_PROD_COMPOSE}" up -d
```

Use a narrower service list when possible. Review `docker compose config` without exposing resolved secret values in logs.

For Caddy changes, validate routing and inspect recent logs:

```bash
docker compose -f "${PC_PROD_COMPOSE}" ps caddy
docker compose -f "${PC_PROD_COMPOSE}" logs --tail=100 caddy
```

## 7. Migration releases

When migrations are part of the release:

1. take the required backup/snapshot before mutation;
2. run the production one-shot migration service defined by the server Compose contour;
3. require a successful exit code;
4. run provisioning/RLS/grant reconciliation when specified;
5. start or recreate API/web only after migration acceptance;
6. never use destructive schema rollback as an emergency shortcut.

Migration and provisioning service names must be taken from the active production Compose configuration, not guessed from local development files.

## 8. Live verification

Run the VPS checklist in `docs/platform-v7/vps-post-deploy-checklist.md`.

Minimum command-line checks:

```bash
curl -fsSIL "https://процент-агро.рф/platform-v7" | sed -n '1,20p'
curl -fsS "https://процент-агро.рф/robots.txt" >/dev/null
curl -fsS "https://процент-агро.рф/sitemap.xml" >/dev/null
```

For a UI release, verify the actual mobile viewport and the exact changed element. A 200 response alone is insufficient.

## 9. Rollback

Rollback uses the previously accepted immutable image reference or digest.

1. Restore the previous image reference for the affected service using the protected production procedure.
2. Recreate only the affected service.
3. Confirm the running OCI revision equals the rollback SHA.
4. Re-run Caddy and live-domain smoke checks.
5. Record the incident, failed target SHA and restored SHA.

Do not roll back database schemas destructively. Use a forward recovery or an approved restore procedure.

## 10. Release record

Every production release record must contain:

- target Git SHA;
- image tag and digest when available;
- running OCI revision;
- affected services;
- server deployment time;
- live smoke result;
- operator;
- rollback revision;
- unresolved limitations.

## 11. Completion language

Allowed before server verification:

- code merged;
- checks passed;
- image published;
- VPS deployment pending.

Allowed only after server and live-domain verification:

- deployed to production;
- live on `процент-агро.рф`.
