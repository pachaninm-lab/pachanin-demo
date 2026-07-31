# TAI Agro OS — canonical runtime image authority

**Baseline:** `76736d52802d85555b7209874ea47e3b842d5bdb`  
**Hosting boundary:** existing REG.RU infrastructure only  
**New recurring cost:** 0 RUB  
**Operational status:** `NOT_DEPLOYED` until exact-main REG.RU acceptance

## Canonical artifact

The canonical TAI service image is:

```text
ghcr.io/pachaninm-lab/grainflow-tai:sha-<short-exact-main-sha>
```

The image is built only by `.github/workflows/docker-publish.yml` from
`infra/docker/Dockerfile.tai`. Its OCI `org.opencontainers.image.revision` label must equal
the full source SHA.

## Image contract

- Python 3.12 runtime;
- unprivileged UID/GID `65532:65532`;
- no repository checkout or test suite in the runtime layer;
- no secrets, database URL, model key, tenant data or production configuration baked in;
- `TAI_RUNTIME_MODE=production` is fixed in the image;
- governed SQL migration files and `manifest.json` are packaged with the application;
- `/health/live` is a process liveness endpoint;
- `/health/ready` remains fail-closed until PostgreSQL, knowledge, model routing, model
  admission, protected model access and production configuration are all valid;
- production command is the explicit ASGI entrypoint
  `tai.production_entrypoint:app` on port `8080`.

## Protected local-model access

The private Qwen endpoint requires `TAI_MODEL_BEARER_TOKEN` from protected REG.RU operations
storage. The token is validated before production composition and is sent only through the
HTTP `Authorization: Bearer ...` header for both user inference and supervisor warm-up.

The runtime rejects a missing, short, whitespace-bearing or oversized credential and returns
only the canonical sanitized configuration failure. The credential must never appear in the
endpoint URL, request body, container image, browser environment, health output or logs.

## Acceptance gate

`.github/workflows/tai-runtime-image.yml` proves on every relevant pull request and main
push that:

1. the image builds from the repository Dockerfile;
2. the OCI revision equals the exact source SHA;
3. the configured runtime user is `65532:65532`;
4. no secret-shaped runtime value is embedded;
5. the complete governed migration manifest is present in the installed package;
6. liveness returns `200`;
7. an unconfigured production image returns fail-closed readiness `503` with the canonical
   configuration reason;
8. the running process uses UID `65532`.

## Separation of evidence

A green image gate or successful GHCR publication proves only that a canonical immutable
artifact exists. It does not prove that REG.RU pulled it, that a production TAI service is
running, that PostgreSQL migrations and grants are accepted, or that the local Qwen runtime
is admitted.

Production deployment remains a separate scope requiring:

- exact-main image pull and revision verification;
- protected production environment materialization, including the model Bearer credential;
- PostgreSQL schema and least-privilege principal acceptance;
- accepted model artifact, licence and benchmark evidence;
- active governed knowledge generation;
- authenticated startup warm-up and `/health/runtime` evidence;
- RU/EN/ZH live inference, overload, recovery and rollback checks.
