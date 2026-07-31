# TAI Agro OS — REG.RU read-only preflight

**Authority baseline:** `551ab5bf087ed710baca6483d70da11dc311a68a`  
**Hosting:** existing REG.RU infrastructure only  
**New recurring cost:** 0 RUB  
**Mode:** `READ_ONLY_PREFLIGHT`  
**Production mutation:** forbidden  
**Transport:** outbound-only local self-hosted runner

## Purpose

The preflight inventories whether the independent TAI runtime can be introduced into the current REG.RU production contour without changing the running platform. It is an evidence step, not a deployment step.

The production connection model is local and outbound-only. GitHub-hosted runners no longer open an inbound SSH session to REG.RU. A repository-scoped runner installed on the existing production VPS polls GitHub over HTTPS, accepts only the labels `pc-prod` and `tai-readonly`, checks out exact current main, and executes the read-only inventory on the host itself.

This removes the confirmed dependency on a publicly reachable SSH port and does not require a new server, VPN, tunnel, SaaS product or recurring payment.

## Exact-main trigger chain

1. a main push that changes the TAI runtime or any REG.RU preflight authority path triggers `Build & Publish Canonical Docker Images`;
2. that workflow publishes canonical API, web, TAI and migration images bound to the exact main SHA;
3. only a successful main-push publication triggers `TAI REG.RU Preflight` through `workflow_run`;
4. the hosted contract job validates the read-only mechanism without accessing production;
5. the live job is routed only to `[self-hosted, linux, x64, pc-prod, tai-readonly]`;
6. the live job verifies that the workflow-run SHA still equals current exact main;
7. the result is emitted as redacted evidence and the commit status `TAI REG.RU Preflight`.

The workflow can also be started manually by the repository owner with the phrase `PREFLIGHT-TAI-REG-RU`. Automatic blocked inventory is preserved as a failed commit status but does not make the evidence workflow masquerade as a deployment. Manual strict execution fails when any blocker remains.

## One-time runner installation

The repository contains `scripts/install-pc-prod-actions-runner.sh`. Run it only from the REG.RU serial/VNC console with a short-lived repository runner registration token:

```bash
sudo env RUNNER_REGISTRATION_TOKEN='<SHORT_LIVED_TOKEN>' \
  bash scripts/install-pc-prod-actions-runner.sh
```

The installer:

- pins GitHub Actions Runner `2.336.0` and verifies its official SHA-256 checksum;
- runs the official dependency installer from the verified runner archive;
- creates the dedicated unprivileged `pcactions` account;
- assigns only `pc-prod,tai-readonly` custom labels;
- installs a systemd service with process and kernel hardening;
- grants the runner access to the existing Docker daemon through the existing `docker` group;
- writes a root-owned local authority marker;
- never prints or persists the registration token.

The registration token is one-time and short-lived. It is not a repository secret and must not be stored in GitHub Actions, shell history, files, chat or documentation.

## Runner security boundary

The live job does not run for `pull_request` or `pull_request_target`. Pull requests execute only the hosted contract job. The live job additionally requires:

- successful canonical image publication from a `main` push;
- exact equality with current `origin/main`;
- repository-owner confirmation for manual execution;
- a non-root Linux x64 runner whose name starts with `pc-prod-`;
- the exact custom labels `pc-prod` and `tai-readonly`;
- local Docker and Compose availability;
- no `sudo`, SSH key, SSH port, host fingerprint, `ssh-keyscan`, `ssh` or `scp` path in the workflow.

The runner has Docker access, which is operationally privileged. Therefore branch protection, mandatory checks, owner-only merge authority and review of workflow changes remain part of the production boundary.

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

If local execution terminates before valid evidence is produced, the workflow writes a minimal redacted report with blocker `PREFLIGHT_EXECUTION_FAILED`. This prevents a missing artifact from hiding the failure boundary.

## Separation from deployment

A green pull-request contract proves only that the preflight mechanism is syntactically valid, read-only and fail-closed.

An automatic or manually executed live preflight proves only the observed production prerequisites at that exact SHA. It does not deploy the TAI service, apply migrations, create a database principal, activate model evidence or change routing.

TAI Stage 1 may be called deployed only after a later protected scope performs exact-main REG.RU materialization, rollback-safe migrations and grants, service creation, private-network admission, health checks, RU/EN/ZH inference, overload/recovery tests and live acceptance.
