# Virtual-server production runbook

## 1. Authority and inventory

Production endpoint: `https://процент-агро.рф`

Current recorded hosting inventory:

- provider: REG.RU;
- public IPv4: `195.19.12.120`;
- OS: Ubuntu;
- runtime: Docker Compose;
- edge: Caddy with automatic HTTPS;
- application: Next.js `web` container and API/data services managed by the protected production Compose contour;
- registry: GHCR;
- source authority: GitHub `main`.

The domain is authoritative for routing. Verify its current A record before SSH access. Do not assume that the recorded IP is immutable.

Watchtower is retired from release authority. Registry polling, `latest` and automatic updater activity are not accepted production deployment mechanisms or evidence.

## 2. Protected values

The following values must be obtained from protected operations storage and must not be committed or pasted into tickets, PRs or chat:

- `PC_PROD_SSH_USER`;
- SSH private key or Termius credential;
- `PC_PROD_DIR` — server working directory;
- `PC_PROD_COMPOSE` — protected production Compose filename/path;
- `PC_PROD_PROJECT` — explicit Compose project name when the active project does not derive from the directory;
- production `.env` and secret-store values;
- GHCR credentials when required.

Examples intentionally use variables instead of real credentials:

```bash
export PC_PROD_HOST=195.19.12.120
export PC_PROD_DOMAIN=xn----8sbjf4befbjgs9b.xn--p1ai
export PC_TARGET_SHA=<full-main-commit-sha>
export PC_PROD_SSH_USER=<from-protected-inventory>
export PC_PROD_DIR=<from-protected-inventory>
export PC_PROD_COMPOSE=<from-protected-inventory>
export PC_PROD_PROJECT=<from-protected-inventory-if-required>
export PC_HARDENING_OVERRIDE="$PC_PROD_DIR/compose.production-hardening.override.yml"
```

## 3. Pre-deploy checks

Before touching the server:

1. Confirm `PC_TARGET_SHA` is a full 40-character commit reachable from `main`.
2. Confirm required CI, security and unit checks passed.
3. Confirm canonical image `ghcr.io/pachaninm-lab/grainflow-web:sha-${PC_TARGET_SHA:0:7}` exists.
4. Confirm its OCI label `org.opencontainers.image.revision` equals `PC_TARGET_SHA`.
5. Confirm the image build used `infra/docker/Dockerfile.web`.
6. Confirm the domain currently resolves to the expected REG.RU VPS.
7. Classify the change as application image, protected Compose/Caddy/environment, migration, or mixed release.
8. Record the current running web image ID and exact revision for rollback.

The root `docker-compose.yml` in the repository is local-development infrastructure. Do not use it as production authority.

## 4. Canonical Compose model

Every production web operation must include the persistent hardening override:

```bash
DC=(
  docker compose
  --project-directory "$PC_PROD_DIR"
)
if [ -n "${PC_PROD_PROJECT:-}" ]; then
  DC+=(--project-name "$PC_PROD_PROJECT")
fi
DC+=(
  -f "$PC_PROD_COMPOSE"
  -f "$PC_HARDENING_OVERRIDE"
)

"${DC[@]}" config --quiet
"${DC[@]}" config --services
```

Required merged-model properties:

- `web.container_name` is absent;
- `web` has restart, graceful-stop and healthcheck policy;
- `watchtower` is in the inactive `retired-watchtower` profile;
- Docker Compose version is at least `2.24.4`.

Do not run the protected base Compose file alone after the hardening transition.

## 5. Connect and inspect

```bash
ssh "${PC_PROD_SSH_USER}@${PC_PROD_HOST}"
cd "$PC_PROD_DIR"
"${DC[@]}" ps
```

For the current web container:

```bash
WEB_ID="$("${DC[@]}" ps -q web)"
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$WEB_ID"
docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$WEB_ID"
docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$WEB_ID"
docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$WEB_ID"
```

The accepted state is one Compose-managed `web` container with exact OCI revision and `healthy` Docker state.

## 6. Application-image deployment

Primary authority:

- workflow: `.github/workflows/production-web-exact-sha.yml`;
- server operation: `scripts/production-web-exact-sha.sh`;
- persistent override: `infra/compose/production-web-hardening.override.yml`;
- detailed contract: `docs/ops/production-web-hardening.md`.

The workflow supports:

- `audit`;
- `deploy` with `DEPLOY-EXACT-SHA`;
- `rollback` with `ROLLBACK-EXACT-SHA`.

For a web-only release, only service `web` may be recreated. API, PostgreSQL, Redis, MinIO and Caddy container IDs must remain unchanged.

The release script:

1. validates the merged Compose model;
2. records current web image/revision;
3. verifies the exact target image OCI revision;
4. adopts one unambiguous legacy unlabeled web container when necessary;
5. recreates only `web`;
6. requires `healthy` state and canonical Compose labels;
7. retires Watchtower by stopping it and setting restart policy `no`;
8. restores the previous web image automatically on an internal failure.

A registry push or available `latest` tag does not mean production changed.

## 7. Compose, Caddy or environment deployment

Image deployment authority does not authorize infrastructure changes. For a protected Compose, Caddy or environment change:

1. use a separately approved change record;
2. back up the protected file before mutation;
3. validate the merged Compose model without printing resolved secrets;
4. apply the narrowest service list possible;
5. preserve the hardening override;
6. confirm Caddy and unrelated container IDs did not change unexpectedly.

For Caddy changes, validate routing and inspect recent logs:

```bash
"${DC[@]}" ps caddy
"${DC[@]}" logs --tail=100 caddy
```

## 8. Migration releases

When migrations are part of the release:

1. take the required backup/snapshot before mutation;
2. run the production one-shot migration service defined by the protected Compose contour;
3. require a successful exit code;
4. run provisioning/RLS/grant reconciliation when specified;
5. start or recreate API/web only after migration acceptance;
6. never use destructive schema rollback as an emergency shortcut.

Migration and provisioning service names must be taken from the active protected Compose configuration, not guessed from local development files.

## 9. Live verification

Run `docs/ops/vps-post-deploy-checklist.md` against the real domain.

Minimum checks:

```bash
curl -fsS "https://процент-агро.рф/api/health/ready"
curl -fsSIL "https://процент-агро.рф/platform-v7?lang=ru" | sed -n '1,20p'
curl -fsSIL "https://процент-агро.рф/platform-v7?lang=en" | sed -n '1,20p'
curl -fsSIL "https://процент-агро.рф/platform-v7?lang=zh" | sed -n '1,20p'
curl -fsS "https://процент-агро.рф/robots.txt" >/dev/null
curl -fsS "https://процент-агро.рф/sitemap.xml" >/dev/null
```

Readiness response and `manifest-pc-deploy.json` must contain the exact target revision. A 200 response without exact revision evidence is insufficient.

For a UI release, verify the actual mobile viewport and the exact changed element. Command-line smoke checks do not replace live visual QA.

## 10. Rollback

Rollback is an exact-image deployment to the previously accepted full revision:

```text
action: rollback
target_sha: <previous-full-sha>
confirmation: ROLLBACK-EXACT-SHA
```

After rollback:

1. confirm Docker state is `healthy`;
2. confirm running OCI revision equals the rollback SHA;
3. confirm Compose project/service labels are present;
4. rerun live route and Caddy checks;
5. confirm Watchtower remains stopped;
6. record failed target SHA and restored SHA.

Do not roll back database schemas destructively. Use forward recovery or an approved restore procedure.

## 11. Release record

Every production release record must contain:

- target Git SHA;
- image tag and digest when available;
- running OCI revision;
- Docker health state;
- Compose project/service labels;
- affected services;
- deployment time;
- live RU/EN/ZH smoke result;
- operator or workflow run;
- rollback revision;
- Watchtower retirement state;
- unresolved limitations.

## 12. Completion language

Allowed before server verification:

- code merged;
- checks passed;
- image published;
- VPS deployment pending.

Allowed only after server and live-domain verification:

- deployed to production;
- live on `процент-агро.рф`;
- exact running revision accepted.
