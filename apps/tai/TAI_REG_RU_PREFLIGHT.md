# TAI Agro OS — REG.RU read-only preflight

**Authority baseline:** `551ab5bf087ed710baca6483d70da11dc311a68a`  
**Hosting:** existing REG.RU infrastructure only  
**New recurring cost:** 0 RUB  
**Mode:** `READ_ONLY_PREFLIGHT`  
**Production mutation:** forbidden

## Purpose

The preflight inventories whether the independent TAI runtime can be introduced into the current REG.RU production contour without changing the running platform. It is an evidence step, not a deployment step.

The exact-main trigger chain is source-controlled and sequential:

1. a main push that changes the TAI runtime or any REG.RU preflight authority path triggers `Build & Publish Canonical Docker Images`;
2. that workflow publishes canonical API, web, TAI and migration images bound to the exact main SHA;
3. only a successful main-push publication triggers `TAI REG.RU Preflight` through `workflow_run`;
4. the preflight checks that the workflow-run SHA still equals current exact main before connecting to REG.RU;
5. the result is emitted as redacted evidence and the commit status `TAI REG.RU Preflight`.

The workflow can also be started manually by the repository owner with the phrase `PREFLIGHT-TAI-REG-RU`. Automatic blocked inventory is preserved as a failed commit status but does not make the evidence workflow masquerade as a deployment. Manual strict execution fails when any blocker remains.

## Evidence collected

The redacted report records only status codes, counts, immutable image references and resource totals. It does not contain production paths, secret values, database URLs, model endpoints, prompts, tenant data or user data.

The preflight checks:

- exact current-main target;
- canonical `grainflow-tai` image digest, OCI revision and rootless user;
- production Compose authority discovered from running container labels;
- the canonical standalone TAI override when present, including root ownership and mode 0600;
- API, web, migration and TAI topology rendered from the protected base files plus the standalone override;
- current API/web health, rollback revisions and exact-main equality;
- available Docker disk and host memory;
- existing API-to-private-model health without revealing credentials or endpoint;
- required TAI relations in PostgreSQL schema `public`;
- exactly one active governed knowledge generation;
- active model profiles bound to the configured model identity;
- accepted admission evidence bound to every active profile artifact digest;
- TAI service health, exact revision, immutable repository digest, image ID and rootless identity;
- absence of published TAI ports;
- read-only root filesystem and `no-new-privileges`;
- root-owned mode-0600 TAI environment and required variable names;
- dedicated `tai_runtime` PostgreSQL principal;
- zero elevated PostgreSQL attributes, `NOINHERIT`, zero role memberships and zero effective access to non-`tai_*` business relations, including `PUBLIC` privileges;
- readiness status `ready` with tools `disabled-safe`;
- stable container inventory and protected Compose hashes before and after inspection.

PostgreSQL inventory executes inside explicit read-only transactions and performs only catalog and governed authority reads.

## Pre-deployment result

Before the independent service is materialized, deployment may proceed only when every blocker is a member of this exact allowlist:

- `TAI_SERVICE_NOT_MATERIALIZED`;
- `TAI_DEDICATED_ENV_NOT_MATERIALIZED`;
- `TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED`.

The list may be empty or contain any subset of these materialization blockers. Any additional blocker—stale API/web revisions, insufficient resources, missing relations, absent knowledge, model mismatch, admission failure, private-model failure, SSH ambiguity, invalid override protection or detected mutation—stops deployment.

## Post-deployment result

After successful materialization, all TAI-specific checks must switch to PASS:

- `TAI_OVERRIDE_PROTECTED`;
- `TAI_SERVICE_DECLARED`;
- `TAI_RUNTIME_HEALTHY`;
- `TAI_RUNTIME_EXACT_MAIN`;
- `TAI_RUNTIME_ISOLATED`;
- `TAI_DEDICATED_ENV_MATERIALIZED`;
- `TAI_DEDICATED_DB_PRINCIPAL_ATTESTED`;
- `TAI_READINESS_READY`.

The final report must have an empty blocker list and `passed: true`. Otherwise the deployment workflow invokes rollback.

## Mutation prohibition

The preflight script must not execute:

- `docker compose up`, `down`, `restart`, `pull`, `create` or `rm`;
- container start, stop, restart, kill, remove, run or update;
- PostgreSQL DDL, DML, migrations, grants, revokes or role changes;
- `systemctl` mutations;
- writes to protected production files;
- package installation;
- secret generation, rotation, persistence or disclosure;
- model-service changes;
- public TAI port publication.

It snapshots stable container identifiers, image digests, running state, restart counts and labels. It hashes every protected Compose file, including the standalone override when present, before and after inspection. Any difference returns `PRODUCTION_MUTATION_DETECTED`.

## Evidence contract

The artifact schema is `tai.reg-ru.preflight.v1` and contains:

- exact target SHA;
- canonical image reference and digest;
- mode `READ_ONLY_PREFLIGHT`;
- `productionMutationAllowed: false`;
- named checks with `PASS` or `BLOCKED`;
- deduplicated blocker codes;
- final `passed` boolean.

The workflow uploads the artifact before enforcing a manual strict result. It also writes a redacted exact-SHA commit status named `TAI REG.RU Preflight`, allowing the current blocker count to be checked without retrieving secrets or production logs.

## Separation from deployment

A green pull-request contract proves only that the preflight mechanism is syntactically valid, read-only and fail-closed. Live preflight proves only the observed prerequisites at one exact SHA.

Materialization is performed by the separate rollback-bound `TAI REG.RU Deployment` authority. The preflight itself never mutates production.
