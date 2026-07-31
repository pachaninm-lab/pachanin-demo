# TAI Agro OS v4 — Stage 1 Production Runtime Image

**Exact baseline:** `1c61ddd3c8de368ec321d9afde8eac89f5752488`  
**Infrastructure:** existing REG.RU and GHCR authority only  
**New recurring cost:** 0 RUB  
**Operational status:** image scope only; REG.RU deployment is not asserted

## Implemented in this scope

- protected Bearer authentication for the private local-model endpoint;
- rejection of missing, short, whitespace-bearing or oversized model credentials;
- the credential is sent only in the HTTP `Authorization` header;
- the credential is never added to the endpoint, request body, image or logs;
- authenticated transport is used by both answer generation and supervisor warm-up;
- production composition remains fail-closed when model access is absent;
- rootless Python 3.12 image for the canonical TAI production entrypoint;
- one Uvicorn worker, preserving the process-local Stage 1 admission authority;
- liveness healthcheck and OCI exact-revision labels;
- canonical GHCR publication as `grainflow-tai:sha-<short-sha>` after merge to main;
- deterministic tests for authentication, transport budgets and production composition.

## Required production environment

The image contains no credentials. Runtime configuration must be supplied from protected
REG.RU operations storage:

```text
TAI_RUNTIME_MODE=production
TAI_DATABASE_URL=...
TAI_IDENTITY_HMAC_SECRET_B64=...
TAI_CONFIRMATION_HMAC_SECRET_B64=...
TAI_MODEL_ENDPOINTS_JSON=...
TAI_ALLOWED_MODEL_HOSTS_JSON=...
TAI_MODEL_BEARER_TOKEN=...
```

The existing bounded Stage 1 settings remain optional and retain their safe defaults.

## Security boundaries

- The model endpoint must still satisfy the private/local endpoint policy.
- No secret is accepted through an HTTP request or browser environment.
- No model weights or model credential are copied into the image.
- The container runs as UID/GID `10001` and does not require root.
- The image exposes only the TAI HTTP service on port `8080`.
- A published image is not proof that REG.RU is running it.
- This scope does not create or alter PostgreSQL model evidence, admission decisions,
  active knowledge generations, production roles or grants.
- This scope does not expand TAI write authority.

## Required before REG.RU rollout

A separate exact-main deployment scope must prove, before mutating Compose:

1. the exact TAI image exists and its OCI revision equals current main;
2. the production Compose authority and target network are unambiguous;
3. the TAI database principal exists and has only the required privileges;
4. all governed TAI migrations are applied;
5. an active knowledge generation exists;
6. the approved Qwen profile is bound to the exact artifact digest;
7. the current model admission decision is accepted;
8. the private model endpoint is reachable with the protected credential;
9. rollback can restore the previous Compose topology;
10. live `/health/live`, `/health/ready` and `/health/runtime` evidence is captured.

Until that evidence exists, the status remains **NOT DEPLOYED / NOT LIVE-ACCEPTED**.
