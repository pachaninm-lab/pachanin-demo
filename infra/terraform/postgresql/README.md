# Managed PostgreSQL (Yandex Cloud) — Terraform

Provisions the production database for the platform: a **highly available
Yandex Managed Service for PostgreSQL** cluster (3 hosts across 3 zones, automatic
failover), the `grainflow` database, a least-privilege runtime user and a
separate DDL/migration user, encrypted backups with point-in-time recovery, and
a firewall that only admits the in-cluster PgBouncer.

This is the "cloud database", expressed as reproducible infrastructure rather
than console clicks. Applying it **spends real money on your Yandex Cloud
account** — that step is yours to run with your credentials and billing.

## What it creates

| Resource | Purpose |
|---|---|
| `yandex_mdb_postgresql_cluster` | HA PostgreSQL 16, 3 hosts/3 zones, autofailover, Odyssey pooler (transaction mode) |
| `yandex_mdb_postgresql_database` | `grainflow` DB with `uuid-ossp`, `pgcrypto` |
| `yandex_mdb_postgresql_user` ×2 | `grainflow_ddl` (migrations, owner) and `grainflow_app` (runtime, least privilege) |
| `yandex_vpc_security_group` | Ingress only from the k8s subnets running PgBouncer |

## Prerequisites

- Terraform ≥ 1.5 and the `yc` CLI, authenticated to your cloud.
- An existing VPC network + one subnet per zone (the k8s cluster's network).
- Credentials exported out-of-band (never in code):
  ```bash
  export YC_TOKEN="$(yc iam create-token)"      # or YC_SERVICE_ACCOUNT_KEY_FILE=./sa-key.json
  export TF_VAR_ddl_password='<strong-random>'
  export TF_VAR_app_password='<strong-random>'
  ```

## Apply

```bash
cd infra/terraform/postgresql
cp terraform.tfvars.example terraform.tfvars   # fill cloud/folder/network/subnet ids
terraform init
terraform plan -out tf.plan                    # review carefully
terraform apply tf.plan
```

## Wire the application

`terraform output` gives the FQDNs:

- `master_fqdn` (`…​.rw.…`) — always the current master; **PgBouncer upstream**.
- `replica_fqdn` (`…​.ro.…`) — load-balanced replicas; read-only reporting.

Set these so the tiers connect through PgBouncer, not directly:

1. `infra/helm/grainflow/values-production.yaml` → `pgbouncer.upstream.host = <master_fqdn>`.
2. Secret `grainflow-api-secrets` → `DATABASE_URL` pointing at the **PgBouncer
   Service** with `?pgbouncer=true&connection_limit=10&pool_timeout=10&sslmode=verify-full`.
3. Secret `grainflow-migration-secrets` → DDL user, connecting **directly** to
   `master_fqdn:5432` (migrations must not run through a transaction pooler).

## Safety

- `deletion_protection = true` blocks accidental `terraform destroy`.
- State holds secrets — keep it in the Object Storage backend (see `versions.tf`),
  never in git. `.gitignore` already excludes state and filled tfvars.
- Rotate `TF_VAR_*_password` via `terraform apply`; the users update in place.
