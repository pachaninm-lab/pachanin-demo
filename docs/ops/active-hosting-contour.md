# Active hosting contour

Date: 2026-07-23

## Canonical production

`процент-агро.рф` is served from the project virtual server.

| Item | Active value |
|---|---|
| Provider | REG.RU |
| Current recorded public IPv4 | `195.19.12.120` |
| Network | AS197695 / AS-REGRU |
| Server OS | Ubuntu |
| Edge | Caddy, automatic HTTPS, ports 80/443 |
| Runtime | Docker Compose |
| Web path | Internet → Caddy → `web` container → Next.js |
| Source authority | GitHub `main` |
| Image registry | GHCR |
| Web release authority | Exact-SHA workflow and immutable OCI revision |

DNS is the routing authority. The recorded IP must be confirmed before operational access because it can change.

## Server services

The current single-server contour includes Caddy and containerized application services. Operational inventory records PostgreSQL 16, Redis, MinIO, one-shot migrations/provisioning, API, web and Caddy.

Watchtower is retired from the active production profile. A stopped Watchtower container may temporarily remain for forensic continuity, but it must have restart policy `no` and must not participate in releases.

The exact protected production Compose file, working directory, SSH identity and environment are not stored in this document. The persistent server hardening override is required for every production Compose operation.

The repository root `docker-compose.yml` is for local development and is not production authority.

## Release interpretation

- A merge to `main` updates source authority.
- The canonical image workflow publishes GHCR artifacts for application changes.
- The virtual server must pull and run the intended exact-SHA artifact.
- `latest`, registry polling and automatic updater activity are not release authority.
- Infrastructure changes require an explicit protected server-side configuration update and Compose reconciliation.
- Production is accepted only after the running container revision matches the intended Git SHA, Docker state is `healthy`, canonical Compose labels are present and the live domain passes smoke checks.
- The `web` service must not use a fixed `container_name`.

## Retired hosting and release mechanisms

- Netlify is retired and is not production.
- Vercel is retired and is not production.
- Deno Deploy is legacy and is not production.
- Watchtower is retired and is not production release authority.
- Deploy previews, registry tags or commit statuses from retired providers must be ignored as release gates.

## Operational rule

Never report a change as live merely because it was merged, built or published to a registry. Without evidence from the REG.RU virtual server and `https://процент-агро.рф`, the correct state is **deployment pending**.

See `CANONICAL_DEPLOY.md`, `docs/ops/virtual-server-production-runbook.md` and `docs/ops/production-web-hardening.md`.
