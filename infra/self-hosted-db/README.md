# Self-hosted database — the easy path (no cloud account, no Terraform)

This runs the whole database layer — **PostgreSQL 16 + PgBouncer + Redis** — on
any one machine that has Docker, with a single command. It is the same
connection topology proven end-to-end for this platform
(application → PgBouncer transaction pooling → PostgreSQL, plus Redis cache).

Use this when you just want a working database now and do not have (or do not
want) a managed cloud account. For automatic failover and read replicas across
machines, use the managed-cloud path in `infra/terraform/postgresql` instead.

## What you need

- A server (or your own computer) with **Docker** installed. That's it.
- Nothing to learn about databases — the two steps below are the whole thing.

## Start it (2 steps)

```bash
cd infra/self-hosted-db
cp .env.example .env          # step 1: open .env, set two strong passwords
docker compose up -d          # step 2: start everything
```

Check it's healthy:

```bash
docker compose ps             # all services should say "healthy"
```

## Point the application at it

Set these in the API environment (or the k8s secret `grainflow-api-secrets`):

```
DATABASE_URL=postgresql://grainflow_app:<POSTGRES_PASSWORD>@localhost:6432/grainflow?pgbouncer=true&connection_limit=10&pool_timeout=10
REDIS_URL=redis://:<REDIS_PASSWORD>@localhost:6379
```

Replace `localhost` with the server's address if the app runs elsewhere. Then
run the database migrations once (from the repo root):

```bash
pnpm --filter @pc/api prisma migrate deploy
```

## Everyday commands

| Do this | Command |
|---|---|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Stop and erase all data | `docker compose down -v` |
| See logs | `docker compose logs -f` |
| Back up the database | `docker compose exec postgres pg_dump -U grainflow_app grainflow > backup.sql` |

Data survives restarts in the `pgdata` volume. `down -v` is the only command that
deletes it.
