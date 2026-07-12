# Production database deployment and recovery runbook

## Status boundary

This runbook defines the target operational procedure. The repository CI proves the procedure on isolated PostgreSQL with synthetic data. It does **not** prove that production migration, provider backup, PITR, failover, RTO or RPO have been accepted in a live environment.

## Non-negotiable rules

1. Database migrations are forward-only and additive.
2. Application rollback uses a previous application image against a forward-compatible schema.
3. Tenant RLS remains enabled and forced during deployment, rollback and incident recovery.
4. Database rollback means restore/PITR into an isolated target, validation, then controlled cutover. It is never an in-place removal of policies or protection.
5. `DATABASE_URL` and `AUTH_DATABASE_URL` use separate `NOINHERIT` PostgreSQL roles with no role memberships.
6. Migration credentials are separate from runtime credentials and are not stored in the application environment.
7. Every step produces immutable evidence: commit SHA, migration list, backup checksum, timestamps, principal proof, schema drift result and smoke-test output.
8. `infra/sql/postgresql-deal-authority-policies.sql` is applied immediately after the base RLS artifact; applying only the base file would restore the legacy pre-deal basis restriction and block PostgreSQL-authoritative creation.

## Required roles

| Principal | Required capability | Forbidden capability |
|---|---|---|
| Migration owner | Apply Prisma migrations, create/alter schema, apply canonical RLS | Application runtime use |
| Deal runtime | CRUD required business tables under `ENABLE + FORCE RLS` | SUPERUSER, BYPASSRLS, table ownership, role memberships |
| Auth runtime | Identity/auth tables and `BYPASSRLS` for pre-context identity lookup | Any privilege on `public.deals`, SUPERUSER, role memberships |
| Backup operator | Provider backup/PITR or `pg_dump` under controlled operations | Application runtime use |

## Release evidence package

The release owner creates one evidence directory containing:

- release commit SHA and container image digest;
- `prisma migrate status` output;
- migration SQL diff and forward-only gate output;
- current protected-table RLS/policy/function/trigger inventory, including the deal-authority overlay;
- deal/auth principal capability snapshots;
- backup identifier and SHA-256 where exportable;
- backup start/completion timestamps;
- migration start/completion timestamps;
- post-deploy smoke/acceptance logs;
- rollback decision and approver identity;
- measured restore duration from the latest rehearsal.

## Preflight

Stop the release if any item fails.

1. Confirm approved release SHA and immutable image digest.
2. Confirm maintenance owner, release owner, security observer and rollback authority.
3. Confirm production connection strings are injected from the secrets manager and are different for deal/auth runtime.
4. Run the forward-only migration gate:

```bash
node scripts/platform-v7-forward-only-migration-check.mjs
```

5. Run `prisma migrate status` with migration-owner credentials.
6. Run `prisma migrate diff` from the target database to `schema.prisma`; unexplained drift blocks release.
7. Verify the runtime principal boundary using the production startup checks in a read-only preflight process.
8. Verify provider backup/PITR health and available storage.
9. Confirm that the previous application image is available for application rollback.
10. Confirm post-deploy smoke tests and observability dashboards are ready.

## Backup before migration

Preferred production mechanism: managed PostgreSQL snapshot plus PITR/WAL retention. `pg_dump` is supplementary evidence, not a substitute for provider-level recovery where the database is large.

For exportable backups:

```bash
pg_dump "$MIGRATION_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="predeploy-${RELEASE_SHA}.backup"
sha256sum "predeploy-${RELEASE_SHA}.backup" > "predeploy-${RELEASE_SHA}.backup.sha256"
sha256sum --check "predeploy-${RELEASE_SHA}.backup.sha256"
```

Record the provider snapshot/PITR identifier and backup completion timestamp. Migration must not start until backup completion is confirmed.

## Apply migration

1. Put only incompatible write paths into controlled maintenance/read-only mode. Do not disable tenant RLS.
2. Apply migrations with the migration owner:

```bash
DATABASE_URL="$MIGRATION_DATABASE_URL" \
  pnpm --filter @pc/api exec prisma migrate deploy --schema prisma/schema.prisma
```

3. Apply the canonical RLS policy artifacts in this order:

```bash
psql "$MIGRATION_DATABASE_URL" \
  -X --set ON_ERROR_STOP=1 \
  --file infra/sql/production-rls-policies.sql

psql "$MIGRATION_DATABASE_URL" \
  -X --set ON_ERROR_STOP=1 \
  --file infra/sql/postgresql-deal-authority-policies.sql
```

4. Verify all of the following against the release SHA:
   - `public.app_deal_basis_deal_visible`, `public.app_deal_basis_participant_allowed` and `public.enforce_single_deal_per_basis` are `SECURITY DEFINER`;
   - `PUBLIC` has no `EXECUTE` privilege on those functions;
   - final `deals_select`, `deals_insert`, `integration_events_select`, `organizations_select` and `deal_participants_insert` policies are installed;
   - trigger `public.deals_single_basis` is enabled on `public.deals`;
   - a direct Deal insert without a confirmed basis fails, and reuse of one tenant/lot/winner basis fails with the single-use constraint.
5. Validate schema drift, migration history, RLS inventory and principal capabilities.
6. Start one application instance with production boundary enforcement.
7. Run authentication, tenant isolation, participant-scoped deal create/read and signed callback smoke checks.
8. Increase traffic gradually while observing errors, latency, connection pools, locks, replication lag and outbox processing.

## Application rollback

Use when the database migration succeeded but the new application build is unhealthy and the schema remains forward-compatible.

1. Stop traffic increase.
2. Redeploy the previous immutable application image.
3. Keep the migrated schema and all RLS protections in place.
4. Run the previous-version compatibility smoke suite.
5. Continue incident investigation without destructive reverse SQL.

A migration that prevents the previous application image from starting is not eligible for normal application rollback and must not pass the forward-only release gate without an explicitly approved expand/migrate/contract plan.

## Database recovery / PITR

Use only for corruption, destructive operator action or unrecoverable migration failure.

1. Freeze writes and preserve evidence.
2. Select a recovery point from provider backup/PITR metadata.
3. Restore into a new isolated database/cluster. Never overwrite the damaged database first.
4. Restore/recreate least-privilege runtime grants.
5. Validate:
   - backup checksum or provider restore identity;
   - migration history;
   - source/recovery fingerprints where the source remains readable;
   - deal/auth runtime principal startup;
   - `ENABLE + FORCE RLS`, policy/function/trigger inventory and deal-authority overlay;
   - cross-tenant visibility equals zero;
   - persistent login/session verification;
   - deal, participant, document, bank-operation, ledger, audit and outbox reconciliation.
6. Obtain release owner, security and business approval.
7. Cut over connection strings atomically.
8. Re-run smoke/acceptance and monitor before reopening writes.
9. Preserve the old database until incident closure and retention approval.

## RTO and RPO

No production RTO or RPO is claimed by this repository.

- Rehearsal records measured backup and restore durations for synthetic data.
- Production RTO must be measured with production-sized data, network, encryption, provider restore and application cutover.
- Production RPO must be derived from the approved backup/PITR cadence and WAL retention, then verified by recovery exercises.
- Until those exercises are completed, RTO/RPO status is `not established`.

## CI rehearsal

The isolated rehearsal runs after the complete 12-role/19-command flow:

```bash
bash scripts/platform-v7-database-dr-rehearsal.sh
```

It proves:

- forward-only migration gate;
- custom-format backup and checksum;
- restore into a separate PostgreSQL database;
- exact source/recovery fingerprint equality;
- successful Prisma migration history;
- eight protected tables retain enabled and forced RLS;
- persistent deal creation works under a restricted `NOBYPASSRLS` principal using a seller-scoped confirmed basis;
- direct unbacked Deal insert and duplicate basis reuse fail at PostgreSQL level;
- auth runtime cannot read deals;
- deal runtime has zero cross-tenant visibility;
- persistent login works after restore;
- canonical deal remains `CLOSED` with 12 participants, 19 events/audits, two bank operations and two ledger entries.

This is a CI rehearsal, not production or DR acceptance.
