# TAI Agro OS — REG.RU read-only preflight

**Baseline:** `6bbff3549be8eee81c248d53c2e8e93a0bab9d81`  
**Hosting:** existing REG.RU infrastructure only  
**New recurring cost:** 0 RUB  
**Mode:** `READ_ONLY_PREFLIGHT`  
**Production mutation:** forbidden

## Purpose

The preflight inventories whether the independent TAI runtime can be introduced into the current REG.RU production contour without changing the running platform. It is an evidence step, not a deployment step.

The workflow runs automatically after a successful exact-main canonical image publication and can also be started manually by the repository owner with the phrase `PREFLIGHT-TAI-REG-RU`. Automatic blocked inventory is preserved as a failed `TAI REG.RU Preflight` commit status but does not make the evidence workflow itself masquerade as a deployment. Manual strict execution fails when any blocker remains.

## Evidence collected

The redacted report records only status codes, counts, immutable image references and resource totals. It does not contain production paths, secret values, database URLs, model endpoints, prompts, tenant data or user data.

The preflight checks:

- exact current-main target;
- canonical `grainflow-tai` image digest, OCI revision and rootless user;
- production Compose authority discovered from running container labels;
- API, web and migration topology;
- whether a dedicated `tai` service is declared;
- current API/web health, rollback revisions and exact-main revision equality;
- available Docker disk and host memory;
- existence of local-model configuration names in the API container;
- API-to-private-model health without revealing credentials or endpoint;
- required TAI relations in the `public` PostgreSQL schema;
- exactly one active governed knowledge generation;
- active model profiles bound to the configured local-model identity;
- accepted model-admission evidence bound to every active profile's exact artifact digest;
- dedicated TAI production environment and database-principal attestation;
- stable container inventory and protected Compose file hashes before and after inspection.

PostgreSQL inventory executes inside an explicit read-only transaction. It performs only catalog and governed authority reads.

## Expected current result

Until the independent TAI service is materially added to the protected production Compose authority, the preflight is expected to return `BLOCKED`, including at least:

- `TAI_SERVICE_NOT_MATERIALIZED`;
- `TAI_DEDICATED_ENV_NOT_MATERIALIZED`;
- `TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED`.

Additional blockers may identify stale API/web revisions, missing TAI relations, active knowledge, model identity or artifact-bound admission evidence. These codes are deployment prerequisites. They are not converted into warnings and are not suppressed.

A blocked report is useful evidence: it defines the exact next implementation scope without modifying production.

## Mutation prohibition

The production script must not execute:

- `docker compose up`, `down`, `restart`, `pull`, `create` or `rm`;
- container start, stop, restart, kill, remove, run or update;
- PostgreSQL DDL, DML, migrations, grants, revokes or role changes;
- `systemctl` mutations;
- writes to protected production files;
- package installation;
- secret generation, rotation, persistence or disclosure;
- model-service changes;
- public TAI port publication.

The script snapshots stable container identifiers, image digests, running state, restart counts and labels. It also hashes every protected Compose file before inspection. It repeats both snapshots before emitting evidence. Any difference returns `PRODUCTION_MUTATION_DETECTED`.

## Evidence contract

The artifact schema is `tai.reg-ru.preflight.v1` and contains:

- exact target SHA;
- canonical image reference and digest;
- mode `READ_ONLY_PREFLIGHT`;
- `productionMutationAllowed: false`;
- named checks with `PASS` or `BLOCKED` status;
- deduplicated blocker codes;
- final `passed` boolean.

The workflow uploads the artifact before enforcing a manual strict result. It also writes a redacted exact-SHA commit status named `TAI REG.RU Preflight`, allowing the current blocker count to be checked without retrieving secrets or production logs.

## Separation from deployment

A green pull-request contract proves only that the preflight mechanism is syntactically valid, read-only and fail-closed.

An automatic or manually executed live preflight proves only the observed production prerequisites at that exact SHA. It does not deploy the TAI service, apply migrations, create a database principal, activate model evidence or change routing.

TAI Stage 1 may be called deployed only after a later protected scope performs exact-main REG.RU materialization, rollback-safe migrations and grants, service creation, private-network admission, health checks, RU/EN/ZH inference, overload/recovery tests and live acceptance.
