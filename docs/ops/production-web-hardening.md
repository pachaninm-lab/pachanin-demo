# Production web hardening

## Status boundary

This document defines the target operational contour for the public Next.js `web` service on the canonical REG.RU VPS. It does not claim that a change is active in production until the exact running OCI revision, Docker health state and live-domain acceptance are recorded.

## Decisions

1. Production releases are exact-SHA operations. `latest`, registry polling and an automatic updater are not release authority.
2. Watchtower is retired from the active production profile. It must be stopped with restart policy `no`; it may remain as a stopped container only for forensic continuity until the next approved infrastructure cleanup.
3. The `web` service must not have a fixed `container_name`. Compose-generated names and canonical `com.docker.compose.*` labels are required.
4. The active `web` container must expose a Docker healthcheck. A successful process start without `healthy` state is not accepted.
5. A web-only release must not recreate API, PostgreSQL, Redis, MinIO, Caddy or any unrelated service.
6. A post-deploy failure must restore the previous immutable web image automatically when the previous exact revision is known.

## Persistent server override

The release authority installs the repository file
`infra/compose/production-web-hardening.override.yml` beside the protected production Compose file as:

`compose.production-hardening.override.yml`

All production Compose operations must include both files, in this order:

```bash
docker compose \
  --project-directory "$PC_PROD_DIR" \
  -f "$PC_PROD_COMPOSE" \
  -f "$PC_PROD_DIR/compose.production-hardening.override.yml" \
  config --quiet
```

The override:

- resets any inherited fixed `web.container_name`;
- supplies restart, init, shutdown and healthcheck policy;
- places `watchtower` in the inactive `retired-watchtower` profile;
- prevents an ordinary production Compose reconciliation from starting Watchtower.

Docker Compose `2.24.4` or later is required so the merged model can use `!reset` safely.

## Exact-SHA release authority

Canonical workflow:

`.github/workflows/production-web-exact-sha.yml`

Canonical server operation:

`scripts/production-web-exact-sha.sh`

Supported actions:

```bash
scripts/production-web-exact-sha.sh audit
scripts/production-web-exact-sha.sh deploy <full-main-sha>
scripts/production-web-exact-sha.sh rollback <full-main-sha>
```

The workflow is automatically invoked only for the hardening image transition. Future deployments use `workflow_dispatch` and require:

- `deploy` + `DEPLOY-EXACT-SHA`; or
- `rollback` + `ROLLBACK-EXACT-SHA`.

The target must be a full 40-character commit SHA reachable from `main`. The server pulls `grainflow-web:sha-<7>`, verifies `org.opencontainers.image.revision`, then recreates only `web`.

## Legacy-container adoption

The first hardened release may encounter a running web container without Compose labels. The release script may adopt it only when exactly one running container uses a `grainflow-web` image.

Before removing that legacy container, the script records:

- current image reference;
- immutable image ID;
- OCI revision when present;
- current container name and runtime state.

It then creates a canonical Compose-managed replacement. Ambiguous candidates fail closed.

## Acceptance

A successful release requires all of the following:

- merged Compose model has no fixed `web.container_name`;
- new web container is `healthy`;
- running OCI revision equals the requested full SHA;
- canonical Compose project and service labels are present;
- all non-web, non-Watchtower running container IDs are unchanged;
- Watchtower is stopped and its restart policy is `no`;
- readiness endpoint returns the exact revision;
- deployment manifest returns the exact revision;
- RU, EN and ZH public routes return HTTP 200;
- robots and sitemap remain reachable.

Evidence is stored as a checksummed GitHub Actions artifact for 90 days.

## Failure behavior

An internal deployment failure triggers automatic rollback to the previously running image ID. A failure discovered by public live acceptance triggers an explicit exact-revision rollback when the baseline revision is available.

Database schema rollback, non-web restart, Caddy mutation, environment rewriting and secret disclosure are prohibited in this workflow.
