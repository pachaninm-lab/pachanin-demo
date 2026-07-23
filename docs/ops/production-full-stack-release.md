# Production full-stack exact-SHA release

## Authority

This runbook covers only the REG.RU Docker Compose production contour for a release that requires all three actions in order:

1. forward-only database migration;
2. exact API image deployment;
3. exact web image deployment and live organization-intake acceptance.

The source authority is GitHub `main`. The evidence authority is issue #3072 plus the checksummed workflow artifact.

## Immutable components

For one target SHA, the workflow requires these exact tags and verifies each OCI `org.opencontainers.image.revision` label:

- `ghcr.io/pachaninm-lab/grainflow-api:sha-<7>`;
- `ghcr.io/pachaninm-lab/grainflow-web:sha-<7>`;
- `ghcr.io/pachaninm-lab/grainflow-migration:sha-<7>`.

No image is built, retagged or modified on the production VPS. `latest` is never an accepted input.

## Pre-mutation gates

The workflow stops before SSH or server mutation unless:

- target is the exact current `main` SHA;
- all three images exist and carry the target revision;
- the canonical domain resolves to the recorded REG.RU VPS;
- an unencrypted protected private key is valid;
- the VPS host key uniquely matches `PC_PROD_SSH_HOST_FINGERPRINT`;
- the SSH principal is the protected root release principal;
- active Compose labels resolve one protected project with `api`, `web` and exactly one migration service;
- a backup authority exists.

Backup authority is either:

- an automatic custom-format `pg_dump` from the one unambiguous Compose PostgreSQL service, stored root-only under `/var/lib/pc-release-authority/backups`; or
- a protected external backup evidence file referenced by `PC_PROD_BACKUP_EVIDENCE_FILE` and containing `STATUS=PASS`.

## Deployment order

The remote executor:

1. records current API/web images and revisions;
2. records unrelated running container IDs;
3. pulls and verifies exact images;
4. creates the backup evidence;
5. writes a root-only exact-image override;
6. executes the protected one-shot migration service;
7. recreates only `api` and verifies `/ready` inside its network namespace;
8. recreates only `web` and requires Docker `healthy`;
9. retires Watchtower;
10. verifies unrelated container IDs are unchanged;
11. returns exact running API/web revisions.

Caddy, protected environment, volumes, networks, PostgreSQL configuration, Redis, MinIO and other services are not changed.

## Live acceptance

After server acceptance, the runner verifies:

- RU, EN and ZH public routes;
- exact web readiness revision;
- the public organization connection form route;
- a server-issued request number;
- exact replay returns the same request and is marked as replay;
- changed-payload replay with the same key returns HTTP 409.

The synthetic request is bound to the exact release SHA and contains no real person or company data.

## Rollback

Database down-migration is prohibited. The migration is forward-only and must remain compatible with the previous application images.

If API/web readiness or live acceptance fails, the executor restores the previously recorded API and web images through the persistent exact-image override. The release evidence records both baseline revisions and whether rollback was attempted.

## External credential boundary

The repository cannot create or repair production SSH credentials. A missing or invalid protected private key stops the workflow before SSH. Private key material must never be pasted into GitHub issues, PRs, Actions logs or chat.
