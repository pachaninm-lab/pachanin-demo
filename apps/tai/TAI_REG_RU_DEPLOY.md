# TAI Agro OS — exact-main REG.RU deployment

**Authority baseline:** `551ab5bf087ed710baca6483d70da11dc311a68a`  
**Hosting:** existing REG.RU infrastructure only  
**New recurring cost:** 0 RUB  
**Service:** internal Compose service `tai`  
**Public port:** none

## Purpose

This release authority materializes the independent TAI Agro OS runtime on the existing REG.RU production host. It reuses the current PostgreSQL service, the current private Bearer-authenticated Qwen3-8B model host, the current protected Compose project and the canonical exact-SHA rootless TAI image.

It does not replace the public API/web Qwen contour. The new service is the governed orchestration runtime for subsequent server-authoritative platform integration.

## Trigger and exactness

The deployment workflow runs only:

- after a successful `TAI Restricted Qwen REG.RU Activation` run for `main`; or
- by the repository owner from `main` with confirmation `DEPLOY-TAI-REG-RU`.

The requested target must equal current `origin/main`. The image must have:

- exact full revision label equal to target main;
- a verified GHCR SHA-256 digest;
- process identity `65532:65532`.

The production host pulls and runs the immutable digest, not merely the mutable tag. Acceptance binds the remote repository digest, local image ID, running container image ID and OCI revision to the same exact target.

## Pre-deployment fail-closed gate

The workflow executes the read-only REG.RU preflight immediately before mutation. Deployment is permitted only when the report already passes or every remaining blocker belongs to this exact materialization allowlist:

- `TAI_SERVICE_NOT_MATERIALIZED`;
- `TAI_DEDICATED_ENV_NOT_MATERIALIZED`;
- `TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED`.

Any capacity, exact-main, model, knowledge, admission, database, SSH, Compose, protection or mutation blocker stops the release.

## Materialized runtime

The release creates or safely reuses:

- root-owned mode-0600 `/etc/transparent-price/tai-agro-os.env`;
- one PostgreSQL login `tai_runtime`;
- one protected Compose override;
- one service named `tai` using the immutable image digest;
- one root-owned rollback/evidence directory under the existing release authority.

The TAI service has:

- no published port;
- read-only root filesystem;
- UID/GID `65532:65532`;
- all Linux capabilities dropped;
- `no-new-privileges`;
- bounded CPU, RAM, PIDs and `/tmp`;
- restart supervision;
- readiness-based healthcheck;
- no platform Safe Tool configuration in this stage.

Expanded Compose configuration is held only in a temporary file for topology discovery and is deleted immediately. Resolved environment values are not persisted in release evidence.

## PostgreSQL boundary

The `tai_runtime` principal is required to remain:

- `NOSUPERUSER`;
- `NOCREATEDB`;
- `NOCREATEROLE`;
- `NOINHERIT`;
- `NOREPLICATION`;
- `NOBYPASSRLS`;
- without role memberships;
- without effective access to non-`tai_*` business relations, including access inherited through `PUBLIC`.

Only the existing TAI tables, views, materialized views and sequences in schema `public` are available to this runtime. Migration-owner authority is not stored in the TAI environment. An existing principal is reused only when its attributes, connection limit, memberships and effective privileges already match the exact safe boundary; it is not silently altered.

## Model and secret boundary

The model credential is recovered from the already running private Qwen service process without logging it. It is masked in GitHub Actions, transferred through the pinned SSH transport, written only to the root-owned server environment file and removed from transient files.

Remote `/tmp` token and deployment-script files are deleted while the pinned production SSH authority still exists. Local SSH keys are removed only after that remote cleanup attempt.

The model endpoint remains private. It is not exposed to the browser and no public TAI listener is created.

## Live acceptance

Acceptance requires all of the following on the exact target SHA:

- container health is `healthy`;
- remote image digest, image ID and OCI revision match;
- process UID is 65532;
- no published port exists;
- root filesystem and security options are enforced;
- dedicated environment mode and owner are correct;
- database principal has zero effective non-TAI access, zero memberships, `NOINHERIT` and no elevated attributes;
- TAI readiness is `ready`;
- tools are `disabled-safe`;
- one request-bound HMAC identity assertion is accepted;
- one grounded Russian answer uses the admitted Qwen profile and at least one active citation;
- no prepared action and no tool execution is returned;
- strict post-deployment preflight has zero blockers.

## Rollback

Before mutation, the workflow snapshots the previous TAI environment and override. A fresh runtime role is removed on rollback. The TAI container is removed without stopping API, web, PostgreSQL or the private model service. A previous TAI container is detected independently from web Compose labels; if it existed, its protected files and service state are restored.

A failed live check triggers rollback. Production PASS is recorded only after deployment evidence and post-deployment preflight both pass.

## Operational boundary

This stage proves an internal standalone TAI runtime on the current REG.RU contour. It does not grant autonomous financial, veterinary, agronomic, machinery or platform write authority. Full product completion still requires the later TAI Agro OS stages and their own exact-main live acceptance.
