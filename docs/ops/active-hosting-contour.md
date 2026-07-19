# Active hosting contour

Date: 2026-07-19

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

DNS is the routing authority. The recorded IP must be confirmed before operational access because it can change.

## Server services

The current single-server contour includes Caddy and containerized application services. Operational inventory records the following service classes: PostgreSQL 16, Redis, MinIO, one-shot migrations/provisioning, API, web, Caddy and Watchtower. The exact production Compose file, working directory, SSH identity and environment are protected operational data and are not stored in this document.

The repository root `docker-compose.yml` is for local development and is not production authority.

## Release interpretation

- A merge to `main` updates source authority.
- The canonical image workflow publishes GHCR artifacts for application changes.
- The virtual server must pull and run the intended artifact.
- Watchtower may perform the pull automatically, but its activity is not proof of deployment.
- Infrastructure changes require an explicit server-side Git/config update and Compose reconciliation.
- Production is accepted only after the running container revision matches the intended Git SHA and the live domain passes smoke checks.

## Retired hosting

- Netlify is retired and is not production.
- Vercel is retired and is not production.
- Deno Deploy is legacy and is not production.
- Deploy previews or commit statuses from any retired provider must be ignored as release gates.

## Operational rule

Never report a change as live merely because it was merged, built or published to a registry. Without evidence from the virtual server and `https://процент-агро.рф`, the correct state is **deployment pending**.

See `CANONICAL_DEPLOY.md` and `docs/ops/virtual-server-production-runbook.md`.
