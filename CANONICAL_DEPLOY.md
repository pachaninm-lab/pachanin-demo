# Canonical deploy

## Production authority

Production is the project virtual server, not a serverless hosting provider.

- Public endpoint: `https://процент-агро.рф`
- Current recorded public IPv4: `195.19.12.120`
- Provider/network: REG.RU, AS197695
- Server class: Ubuntu virtual server
- Edge: Caddy on ports 80/443 with automatic HTTPS
- Runtime: Docker Compose
- Web workload: Next.js container behind Caddy
- Source repository: `pachaninm-lab/pachanin-demo`
- Source authority: `main`

The public IP is operational inventory, not a permanent identifier. Resolve the domain and confirm the destination before any server operation.

**Netlify and Vercel are retired.** Their deploys, previews, commit statuses and URLs are not production and must never be used as release evidence or gates.

## Build authority

`.github/workflows/docker-publish.yml` builds canonical API and web images from changes merged to `main` and publishes them to GHCR with both an exact-SHA tag and `latest`. The images carry the source commit in the OCI label `org.opencontainers.image.revision`.

A successful image build means an artifact exists. It does not mean the virtual server has pulled or started it.

## Deployment paths

### Application code

1. Merge the approved change to `main`.
2. Wait for the canonical GHCR image build to succeed.
3. Let the server-side updater pull the new image or perform a targeted Compose pull/recreate for the affected service.
4. For a web-only change, update only `web` unless the change requires another service.
5. Verify the running container revision and the live domain.

The server currently includes Watchtower for automatic `:latest` image refresh. Watchtower is a convenience mechanism, not authoritative deployment evidence. If it does not advance the container, use the manual procedure in `docs/ops/virtual-server-production-runbook.md`.

### Infrastructure or configuration

Changes to the server Compose definition, Caddy configuration, production environment, volumes, networks, migrations or service topology do not become active merely because code was merged or an image was published. They require an explicit server-side update from the protected operations directory followed by `docker compose up` for the affected contour.

The repository root `docker-compose.yml` is local-development infrastructure and is not the production Compose file.

## Definition of deployed

A release may be called **deployed** only when all of the following are true:

1. the target commit is present in `main`;
2. required GitHub checks and the canonical image build have succeeded;
3. the intended container is running on the REG.RU virtual server;
4. `org.opencontainers.image.revision` on that container equals the target Git SHA;
5. Caddy is healthy and routes `процент-агро.рф` to the intended service;
6. live route, mobile and functional smoke checks pass;
7. the result and rollback reference are recorded.

A merge, PR close, green CI result, registry push or third-party preview alone is never sufficient.

## Protected operational values

The SSH username, private key, server working directory, production Compose filename and environment values belong in protected operations storage. They must not be committed, copied into issues, or printed in chat and CI logs.

## Runbooks

- Deployment and rollback: `docs/ops/virtual-server-production-runbook.md`
- Post-deploy acceptance: `docs/platform-v7/vps-post-deploy-checklist.md`
- Current hosting contour: `docs/ops/active-hosting-contour.md`
