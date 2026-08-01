# TAI Agro OS — exact-main REG.RU deployment

**Authority baseline:** `f8f2e1c1d5c875e238b59509a4f7fc63ebe9b7b2`  
**Hosting:** existing REG.RU infrastructure only  
**New recurring cost:** 0 RUB  
**Production authority:** fixed least-privilege controller  
**Public TAI/model port:** forbidden

## Release chain

1. Hosted jobs verify canonical exact-main API, web, migration and TAI images.
2. A non-root REG.RU runner writes only fixed, short-lived model-transport input and invokes the controller.
3. The root-owned controller independently fetches exact current `main` into a protected checkout.
4. Restricted Qwen activation deploys exact API/web images, activates private-model configuration, verifies RU/EN/ZH SSE and remains rollback-pending until hosted Chromium acceptance succeeds.
5. A separate local finalization job accepts or rolls back the activation.
6. Standalone TAI deployment runs strict preflight, immutable digest/rootless/least-privilege deployment, grounded inference acceptance and strict postflight.
7. Hosted jobs publish exact-SHA statuses and evidence boundaries.

The runner has no Docker-group membership, no Docker socket, no general root shell and no arbitrary sudo. Production SSH host, port, key and fingerprint are not used. Model-host SSH remains private, pinned and root-controlled.

## Rollback

Activation and deployment both create root-owned rollback state before mutation. Controller traps execute rollback on failure. Hosted UI failure triggers a separate controller rollback before the activation status is published.

## Restricted operational bootstrap authority

The standalone REG.RU deployment applies only the migration manifest packaged in the immutable exact-SHA TAI image, records every migration path and SHA-256 in `tai_schema_migrations`, and materializes a source-backed foundation chunk from TAI Agro OS Master Specification v4.0.

The protected controller derives the Qwen GGUF path, size, context bound and SHA-256 from the active private REG.RU model process through pinned SSH host authority. The resulting profile is authorized as `restricted operational`; permanent model admission remains explicitly `NOT_ATTESTED` unless a real accepted admission record exists. No admission decision is synthesized by deployment.

Postflight remains blocking on exact image digest, rootless read-only isolation, dedicated PostgreSQL principal, active source-backed knowledge, supervisor-refreshed model health, grounded local Qwen inference with citations, disabled tools, rollback evidence, REG.RU-only hosting and zero new recurring expense. Schema migrations are forward-only and idempotent; service, environment, role and Compose authority retain rollback.
