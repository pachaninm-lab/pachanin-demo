# Codex current task — IR-20 Canonical Durable Outbox

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

IR-20 Canonical Durable Outbox

## Next candidate

IR-21 Durable Integration Inbox

## Transition guard

- BLOCKED: IR-20 Canonical Durable Outbox is not green/closed/mergeable. Dispatcher will not advance to IR-21 Durable Integration Inbox.

## Allowed current scope

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/outbox/**
- apps/api/src/common/prisma/outbox-*
- apps/api/src/outbox-worker.ts
- apps/api/src/outbox-worker.module.ts
- apps/api/src/modules/integration-events/durable-outbox.runner.ts
- apps/api/src/modules/integration-events/durable-outbox.runner.spec.ts
- apps/api/src/modules/integration-events/durable-outbox.worker.ts
- apps/api/src/modules/integration-events/integration-events.module.ts
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260912*_canonical_durable_outbox/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/durable-outbox.e2e-spec.ts
- apps/api/test/industrial/outbox-worker-process.e2e-spec.ts
- infra/sql/postgresql-outbox-worker-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

## Forbidden zones

- apps/landing
- apps/web
- package.json
- package-lock.json
- pnpm-lock.yaml
- packages
- live integration activation
- production migration execution
- production credentials and secret material

## Active queue

# platform-v7 Industrial Integration Readiness queue

CURRENT: IR-20 Canonical Durable Outbox

GOVERNING SPECIFICATION:
- `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`
- target gate: Industrial Integration-Ready;
- current gate: NO-GO;
- exact baseline: `576d813c2d305efb645c9d26fa81a38fb6e4abbe` on `main`.

BASELINE PROVEN:
- persistent identity, session rotation/revocation, MFA and one-time backup codes are merged with isolated PostgreSQL evidence (#2276, #2280, #2282, #2283);
- separate restricted auth and deal PostgreSQL principals are merged (#2287);
- canonical Deal command execution, idempotency, optimistic concurrency, callback authority, transactional audit/outbox creation and isolated recovery evidence are merged (#2260, #2270, #2274, #2378, #2406, #2407);
- Documents PostgreSQL Authority is merged (#2410);
- Logistics PostgreSQL Authority is merged (#2412);
- Labs PostgreSQL Authority is merged (#2426, merge `576d813c2d305efb645c9d26fa81a38fb6e4abbe`, verified head `73149bb4fba09a33875311faea313bb2ad272503`);
- Settlement PostgreSQL Authority is merged (#5338, merge `9dbff1a67225a006ec5f33ebe7fa8b483a368718`, verified head `686c89f6cf2438baebb01f6bf4abcafb3eb85963`) with production-like Kubernetes evidence only; no live bank or REG.RU deployment is claimed;
- Disputes PostgreSQL Authority is exact-main revalidated at `397e98955d9f98704c40befd0088a1390556e0fa` by workflow run `34726015616` and artifact digest `sha256:01c713e0487c3ad040aca44e7d6631063a0788e60be4cc77a5de1097f12bdc60`; this is PostgreSQL 16 CI evidence only, not production acceptance;
- bank callback reconciliation and key rotation/revocation mechanics exist (#2379), but live bank and nominal-account integration remain open;
- CI-scale correctness and isolated backup/restore remain evidence only and do not prove production capacity, HA or provider DR.

CURRENT GOAL:
- preserve the already PostgreSQL-authoritative enqueue service and absent legacy relay/memory store;
- remove the second DurableOutboxRunner from the API process and enforce the dedicated worker as the only delivery owner;
- make PENDING, PROCESSING, RETRY, SENT or CONFIRMED, and DEAD transitions PostgreSQL-authoritative using DB time, bounded leases and `SKIP LOCKED`;
- persist attempts, classified failure code/category and retry timing;
- isolate ambiguous post-send outcomes from automatic retry and require governed reconciliation or redrive;
- support audited redrive, backpressure and graceful shutdown;
- prove concurrent-worker, crash-window, provider-ambiguity, retry, expired-lease, replay, restart and double-owner behavior;
- keep live provider delivery and production deployment outside this PR.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/outbox/**
- apps/api/src/common/prisma/outbox-*
- apps/api/src/outbox-worker.ts
- apps/api/src/outbox-worker.module.ts
- apps/api/src/modules/integration-events/durable-outbox.runner.ts
- apps/api/src/modules/integration-events/durable-outbox.runner.spec.ts
- apps/api/src/modules/integration-events/durable-outbox.worker.ts
- apps/api/src/modules/integration-events/integration-events.module.ts
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260912*_canonical_durable_outbox/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/durable-outbox.e2e-spec.ts
- apps/api/test/industrial/outbox-worker-process.e2e-spec.ts
- infra/sql/postgresql-outbox-worker-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- one dedicated durable outbox owner replaces the legacy relay and process-memory production paths;
- DB-time leases, `SKIP LOCKED`, attempts, classified failures, retries, DEAD state and audited redrive are PostgreSQL-authoritative;
- concurrent workers, crash windows, provider ambiguity, timeout/429/4xx/5xx, expired leases, duplicate enqueue, restart and double-owner startup fail safely;
- exact-head CI passes without claiming production deployment or provider delivery.

LOCKED:
- IR-21 Durable Integration Inbox;
- IR-22 Persistent Partner API and Outbound Webhooks;
- IR-30 through IR-90 in dependency order.

NEXT:
- Layer: IR-21 Durable Integration Inbox
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
  - apps/api/src/modules/regulatory-integration/**
  - apps/api/src/modules/integration-events/integration-events.module.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/*_regulatory_integration_inbox/**
  - apps/api/test/industrial/regulatory-integration-inbox.e2e-spec.ts
  - infra/sql/postgresql-regulatory-integration-inbox-policies.sql
  - scripts/verify-pc-crop-07a.mjs
  - .github/workflows/pc-crop-07a.yml
- Success criteria:
  - provider identity, provider event ID, tenant mapping, raw-body hash, schema/mapping/key versions, DB receive time, verification, attempts, correlation and linked operation are durable facts;
  - signatures are verified over raw bytes, replay windows and key lifecycle fail closed, and HTTP acknowledgement is separated from domain processing;
  - unknown schemas quarantine safely and audited redrive cannot bypass verification or tenant authority;
  - exact-head CI passes without claiming live FGIS/provider activation or production delivery.
- Readiness remains NO-GO.

TRANSITION RULE:
- one narrow PR at a time in dependency order;
- no auto-merge;
- no self-modifying workflow or direct push to `main`;
- advance only after exact-head checks and diff review;
- update state, queue, progress and prompts after merge before opening the next work package;
- mock, simulator and CI-scale evidence remain explicitly labelled and cannot be used as live or production acceptance.

RF REGULATED-CONTOUR BOUNDARY:
- preserve replaceable infrastructure boundaries and a deployment profile capable of using software from the Russian software register where the customer or system classification requires it;
- public foreign images, including MinIO images from Quay, are dependency sources for the disposable production-like acceptance contour only and are not evidence of Russian-software-register status;
- 44-FZ/223-FZ procurement, significant CII, regulated financial activity and a concrete FGIS require separate legal classification and verified domestic/certified software, protection and cryptography controls before any compliance claim;
- no current repository, CI or production-like result proves certification, Russian cryptography activation or regulated-contour acceptance.

READINESS:
Industrial Integration-Ready remains NO-GO until every mandatory gate through IR-90 has commit-, deployment- and operations-linked evidence.

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

## Paused concurrent W1 acceptance — 2026-09-12

W1 PR #5332 at `ff03424d073e97d52f1a8cf38dad3de74345ed08` remains
blocked by current Qwen policy-validation failure and Octopus community quota.
Its successful native review and code/security checks do not override those
provider failures. W1 is safely paused without production completion, must not
be retried merely to obtain PASS, and does not alter the serialized IR-10.5 scope.
Confirmed master production acceptance remains 0/100 (0%).


## Implementation brief

Implement IR-20 Canonical Durable Outbox strictly inside the state allowed scope.
