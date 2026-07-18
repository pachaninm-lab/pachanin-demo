# Single-server production deployment

Runs the **whole platform** on one paid server, pulling images built by CI. The
host never builds anything (no RAM-heavy builds), and **Watchtower auto-updates**
it whenever CI publishes new images — so after this one-time setup, releasing is
just merging code to `main`.

## Topology

```
                 ┌── Caddy (:80/:443, auto-HTTPS) ──┐
   internet ───► │  /api/* → API   others → Web      │
                 └───────────┬──────────────┬────────┘
                        API (NestJS)     Web (Next.js)
                             │
                        PgBouncer ──► PostgreSQL 16
                             │
                           Redis
   Watchtower ── polls GHCR every 2 min, pulls + restarts on new images
```

Images (built by `.github/workflows/docker-publish.yml`):
`ghcr.io/pachaninm-lab/grainflow-{api,web,migrations}`.

## Server size

This is the real platform, not a demo — give it room. Start with **4 vCPU /
8 GB RAM / 80 GB SSD**; scale up as load grows. (When the load outgrows one box,
migrate to the managed-Kubernetes path in `infra/helm` + `infra/terraform`.)

## One-time bring-up

1. Create a GitHub read-only token (Settings → Developer settings → **classic
   token**, scope `read:packages`) so the host can pull the private images.
2. On the server (as root):
   ```bash
   export GHCR_USER=<github-username>
   export GHCR_TOKEN=<the read:packages token>
   curl -fsSL https://raw.githubusercontent.com/pachaninm-lab/pachanin-demo/main/infra/single-server/bootstrap.sh | bash
   ```
3. Edit `/opt/grainflow/.env` — set `SITE_ADDRESS` and every password.
4. Start it:
   ```bash
   cd /opt/grainflow && docker compose pull && docker compose up -d
   docker compose ps
   curl -s http://localhost/health
   ```

Migrations run automatically (the `migrations` service) before the API starts.

## Everyday operations

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f api` |
| Manual update | `docker compose pull && docker compose up -d` |
| Stop | `docker compose down` |

Continuous delivery is automatic: push to `main` → CI builds images → Watchtower
rolls them out here within ~2 minutes. No server access needed to ship.
