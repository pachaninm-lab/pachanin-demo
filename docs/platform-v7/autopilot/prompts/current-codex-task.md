# Codex current task — IR-10.4 Settlement PostgreSQL Authority

Maturity: pre-integration / isolated PostgreSQL evidence only.
Do not imply live bank, nominal-account, credit, reserve or payout integration.
Do not change `apps/landing`, `apps/web`, lockfiles, packages or production credentials except within an explicitly approved concurrent scope below.
Do not auto-merge, create self-modifying workflows or push directly to `main`.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`
- Governing specification: `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`

## Current step

IR-10.4 Settlement PostgreSQL Authority

## Last completed

IR-10.3 Labs PostgreSQL Authority — PR #2426, merge `576d813c2d305efb645c9d26fa81a38fb6e4abbe`, verified head `73149bb4fba09a33875311faea313bb2ad272503`.

## Current objective

1. Bind production `SettlementEngineModule` directly to a complete PostgreSQL settlement repository.
2. Remove RuntimeCore, optional Prisma, repository factory, ActionExecutor memory authority and process-memory OutboxService from the production settlement graph.
3. Normalize versioned payment terms, beneficiaries, reserve/release/refund basis, holds, partial payouts, bank operations and reconciliation facts.
4. Store and calculate money only in integer minor units.
5. Enforce Deal participation, tenant and money-role authority through trusted RLS.
6. Make reserve/release/refund requests atomic with payment state, bank operation, audit and `PENDING` outbox.
7. Confirm money movement only through a verified bank callback; human/operator paths cannot self-confirm reserve or release.
8. Prove idempotency, optimistic concurrency, restart, multi-instance, callback races, reconciliation and restricted-principal denial.
9. Keep live SberAPI, nominal account, credit and money movement disabled until separately accepted.

## Non-negotiable invariants

- No `amountRub`, floating-point or decimal money authority. Canonical persisted amounts are integer kopecks.
- No negative balances, over-release, double release, reserve inflation or beneficiary allocation above confirmed reserve.
- A request is not confirmation. Reserve/release/refund stay pending until verified callback authority commits.
- Callback identity, partner, key version, operation ID, event ID and payload fingerprint are server-verified and durably replay-safe.
- Payment, bank operation, ledger, audit and outbox effects commit together or roll back together.
- Ledger facts are append-only and balanced for every confirmed money event.
- Holds and disputes block the affected release amount without corrupting the undisputed portion.
- Reconciliation mismatch fails closed into manual review; it never silently repairs financial authority.
- No test may disable RLS/triggers or mutate confirmed financial facts directly.

## Allowed current scope

Use the exact scope from `autopilot-state.json`, centred on:

- `apps/api/src/modules/settlement-engine/**`
- canonical Deal command/gateway files listed in state
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260713*_settlement_postgresql_authority/**`
- settlement/reconciliation/outbox industrial tests listed in state
- `infra/sql/postgresql-settlement-authority-policies.sql`
- migration and one-deal scripts listed in state
- Source of Truth documents

## Approved concurrent premium homepage completion — PR #3191

The user explicitly authorized branch `agent/platform-v7-home-10of10-v1` to complete the public `/platform-v7` homepage without changing Deal/domain architecture. The implementation is bound to `docs/platform-v7/autopilot/scopes/platform-v7-home-10of10-v1.json` and the exact allow-list recorded in `current-review-task.md`.

Allowed outcomes are limited to public UX/UI hierarchy, responsive CSS, RU/EN/ZH copy, public role simulation, progressive organization-intake presentation, contact-dock behavior, SEO metadata and their bound unit/E2E tests. Preserve the existing durable intake endpoint and idempotency/replay/rate-limit/no-JavaScript boundaries. Do not change API code, database schema or migrations, RBAC, protected routes, bank or TAI authority, external adapters, packages, lockfiles, production workflows or REG.RU deployment topology. No fake-live or unverified external-connectivity claim is permitted.

## Approved concurrent TAI model-capacity scope — issue #3317

The user explicitly authorized a narrow current-hardware protection slice on branch
`agent/tai-ap-19a-model-capacity-gate-3317`. The implementation is bound to the exact
allow-list in `autopilot-state.json`.

The slice may add a fail-closed local-model invocation capacity gate, parse and validate
`TAI_MODEL_MAX_INFLIGHT`, preserve one capacity claim across primary/fallback attempts,
surface immediate retryable overload as HTTP 429 with `Retry-After`, and add focused
tests. The default must remain `1`; the accepted configuration range is `1..4`.
Values above `1` do not constitute measured admission and may be used only after
separate benchmark evidence.

It must not activate a model, weaken admission or local-only transport, add an internal
request queue, change retrieval authority, enable write tools, change production
topology, or claim benchmark/deployment/operational acceptance.

## Forbidden zones

- apps/landing
- apps/web outside the exact approved concurrent homepage allow-list
- package and lock files
- live integration activation
- production migration execution
- production secrets
- temporary or self-modifying workflows
- direct pushes from GitHub Actions

## Acceptance

- production startup rejects missing, memory and unknown payment repository modes;
- production settlement graph contains no RuntimeCore, optional Prisma, repository factory or process-memory money/outbox authority;
- reads and mutations are PostgreSQL-authoritative under trusted RLS;
- same-tenant outsiders and cross-tenant users are denied;
- payment terms and release basis are versioned and Deal-linked;
- reserve/release/refund requests are atomic and callback-only for confirmation;
- partial payout, holds, beneficiary allocation and refunds satisfy money invariants;
- callback replay, conflicting replay, multi-instance races and reconciliation mismatch are proven;
- migrations pass on empty and baseline databases with zero drift;
- exact-head CI and manual review pass without fake-live claims.

## Next candidate

IR-10.5 Disputes PostgreSQL Authority remains locked until IR-10.4 is merged and Source of Truth is synchronized.

## Conditional future Qwen rejected-review diagnostics — 2026-09-12

This is preliminary instruction alignment for future branch
`fix/local-qwen-failed-review-evidence-20260912`, not current implementation
permission. Implementation is permitted only after the immutable prior authority
proposed in PR #5335 is accepted and merged into `main`, and the implementation
base's trusted scope authorizes that exact branch and both paths below. This
paragraph does not change state or expand any permission; primary tasks and all
other scope boundaries remain unchanged.

The future implementation is limited to exactly:

- `.github/workflows/local-qwen-independent-review.yml`
- `docs/platform-v7/autopilot/verify-pr-review-gate.test.mjs`

Preserve bounded rejected-candidate diagnostics before policy-validation failure
can discard them, including evidence transfer before the final failure exit.
Bind evidence to the exact head/run/attempt/diff/manifest/chunk identity and
verify content hashes. Reject invalid UTF-8 and envelopes exceeding 64 KiB.
Preserve the original failure result, fail-closed behavior and cleanup of remote
and unvalidated temporary files. Add no
model calls and change no review semantics, model selection, policy, status or
merge/review gates. Diagnostic artifacts are not accepted review evidence.

Proceed only when that prior authority and base-scope match are independently
verified; otherwise keep this implementation blocked.

## Conditional kind MinIO image-source prerequisite — 2026-09-12

The owner authorized resolving prerequisites while preserving required acceptance.
PR #5338 is blocked by production-like Kubernetes run `34712647635`, job
`103604095938`: the disposable cluster cannot pull
`docker.io/minio/minio:RELEASE.2024-05-10T01-41-38Z` (`insufficient_scope`,
`ErrImagePull` / `ImagePullBackOff`), before application acceptance starts.
This is dependency-source failure evidence, not a settlement acceptance result.

After this governance proposal is independently reviewed and merged into `main`,
branch `fix/kind-minio-image-source-20260912` may change exactly:

- `infra/kind/production-like/dependencies.yaml`
- `scripts/release/production-like-kubernetes-cluster.sh`

The prerequisite is limited to replacing the unavailable MinIO server image
reference in the dependency manifest with the official same-release Quay source
`quay.io/minio/minio:RELEASE.2024-05-10T01-41-38Z@sha256:420663b8685c5396f06405ad516d611db4465939a141cc7d40266342d0f2632d`.

Separately, registry preflight of the subsequent `minio-init` client image
`docker.io/minio/mc:RELEASE.2024-05-09T17-04-24Z` returned HTTP 401
UNAUTHORIZED for the exact tag after official token acquisition. The failed CI
run did not reach this client step. The official same-release Quay manifest
returned HTTP 200 with verified digest. The cluster script may change only that
client image scalar to
`quay.io/minio/mc:RELEASE.2024-05-09T17-04-24Z@sha256:3e9666a093d0a8fcbbac606346c415ae9277a0ca96989a6bdddd3d03e90a21b4`.

Reverify both registry identities and digests before implementation. Preserve releases,
commands, environment, probes, resources, storage, security and network policy.
Do not change application code, migrations, workflows, credentials, other images,
timeouts, required tests, review gates or production configuration. Do not use
this proposal itself as implementation authority before accepted-main scope is
verified. No scope expansion on the implementation branch is permitted.

The serialized primary task and its allowedCurrentScope remain unchanged. This
is a prerequisite to resume the blocked acceptance, not a new product task or
permission to merge PR #5338 with failing checks. Require exact-head independent
review and all required Kubernetes acceptance before implementation merge.
W1 remains unaccepted; production deployment is not required for this disposable
CI dependency change. Confirmed master production acceptance remains 0/100 (0%).
