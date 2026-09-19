# Production cutover — REG.RU virtual server

## Hosting boundary

The only production contour for `процент-агро.рф` is the project Ubuntu virtual server at REG.RU. The current recorded public IPv4 is `195.19.12.120`. Caddy terminates HTTPS and routes requests to Docker Compose services.

Netlify and Vercel are retired. Do not set production variables there, wait for their deploys, use their previews, or treat their statuses as release evidence.

## Fail-closed secrets

In `NODE_ENV=production`, the API must not start without required production secrets. These values belong in the protected server environment or approved secret store, never in the repository.

Required security values include:

| Variable | Purpose | Requirement |
|---|---|---|
| `JWT_SECRET` | Access-token signing and verification | at least 32 random characters |
| `BANK_HMAC_SECRET` | Bank callback verification | at least 32 random characters |
| `FGIS_WEBHOOK_SECRET` | FGIS webhook verification | at least 32 random characters |
| `EDO_WEBHOOK_SECRET` | EDO webhook verification | at least 32 random characters |
| `PC_CABINET_LOCK_USER` | Cabinet login | protected operational value |
| `PC_CABINET_LOCK_PASSWORD` | Cabinet password | strong, at least 16 characters |
| `PC_CABINET_SESSION_SECRET` | Cabinet-session signing | explicit secret or approved JWT-secret fallback |

Do not enable demo-user seeding in production.

## Cutover sequence

1. Identify the exact target Git SHA in `main`.
2. Confirm required CI/security checks succeeded.
3. Confirm the canonical GHCR image exists for that SHA.
4. Confirm DNS for `процент-агро.рф` resolves to the expected virtual-server endpoint.
5. Access the server using credentials from protected operations storage.
6. For application code, pull and recreate only the affected Compose service. For infrastructure/configuration, update the protected server checkout and reconcile the affected Compose contour.
7. Confirm migrations/provisioning jobs completed when the release requires them.
8. Inspect the running container OCI revision and require an exact match with the target Git SHA.
9. Confirm Caddy and the affected services are healthy.
10. Run the checks in `docs/ops/vps-post-deploy-checklist.md` against the real domain.
11. Record target SHA, image reference/digest, deployment time, smoke result and rollback reference.

Watchtower may automatically refresh `:latest` application images. It is not a substitute for steps 8–11.

## Rollback

1. Select the previously accepted immutable image tag or digest.
2. Recreate only the affected service unless the incident requires a wider rollback.
3. Do not roll back a database migration destructively. Use the documented forward-recovery procedure for schema changes.
4. Verify container revision, Caddy routing and live routes after rollback.
5. Record the incident and the active rollback revision.

## Completion rule

Until the virtual server and live domain are verified, report the release as **merged / artifact built / VPS deployment pending**. Do not report it as deployed or live.
