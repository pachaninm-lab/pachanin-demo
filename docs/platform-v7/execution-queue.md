# platform-v7 Industrial Integration Readiness queue

CURRENT: IR-10.5 Disputes PostgreSQL Authority

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
- bank callback reconciliation and key rotation/revocation mechanics exist (#2379), but live bank and nominal-account integration remain open;
- CI-scale correctness and isolated backup/restore remain evidence only and do not prove production capacity, HA or provider DR.

CURRENT GOAL:
- make disputes PostgreSQL-authoritative by construction;
- remove RuntimeCore and implicit process-memory authority from the production Disputes graph;
- persist claims, holds, evidence, decisions and linked financial consequences as tenant-scoped immutable facts;
- enforce participant, tenant and dispute-role scope through trusted RLS;
- commit dispute state, audit and required outbox effects atomically;
- prove restart, multi-instance, replay, optimistic-concurrency races and outsider/cross-tenant denial;
- keep live dispute providers, bank integration and production deployment outside this PR.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/config/industrial-mode.ts
- apps/api/src/common/command-execution.context.ts
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/modules/deals/deal-command-payload.ts
- apps/api/src/modules/deals/deal-command.service.ts
- apps/api/src/modules/deals/deals.module.ts
- apps/api/src/modules/deals/industrial-deal-command.gateway.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
- apps/api/src/modules/disputes/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260912*_disputes_postgresql_authority/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/disputes-postgresql-authority.e2e-spec.ts
- apps/api/test/industrial/industrial-core.e2e-spec.ts
- apps/api/test/one-deal/industrial-one-deal.e2e-spec.ts
- apps/api/test/one-deal/restored-database-acceptance.ts
- apps/api/test/one-deal/seed.ts
- infra/sql/postgresql-disputes-authority-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- production Disputes module binds complete PostgreSQL repositories with no RuntimeCore or implicit memory path;
- claims, holds, evidence, decisions and financial consequences are tenant-scoped, immutable and atomic under trusted RLS;
- restart, multi-instance, durable idempotency, optimistic concurrency, outsider/cross-tenant denial and race tests pass;
- empty/baseline migrations, zero drift and exact-head CI pass.

LOCKED:
- IR-20 Canonical Durable Outbox;
- IR-21 Durable Integration Inbox;
- IR-22 Persistent Partner API and Outbound Webhooks;
- IR-30 through IR-90 in dependency order.

NEXT:
- Layer: IR-20 Canonical Durable Outbox
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
  - apps/api/src/common/outbox/**
  - apps/api/src/common/prisma/outbox-*
  - apps/api/src/outbox-worker.ts
  - apps/api/src/outbox-worker.module.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/*_outbox_*/**
  - apps/api/test/industrial/harness.ts
  - apps/api/test/industrial/durable-outbox.e2e-spec.ts
  - apps/api/test/industrial/outbox-worker-process.e2e-spec.ts
  - infra/sql/postgresql-outbox-worker-policies.sql
  - scripts/platform-v7-forward-only-migration-check.mjs
  - scripts/platform-v7-one-deal-e2e.sh
  - .github/workflows/ci.yml
- Success criteria:
  - one dedicated durable outbox owner replaces the legacy relay and process-memory production paths;
  - DB-time leases, `SKIP LOCKED`, attempts, classified failures, retries, DEAD state and audited redrive are PostgreSQL-authoritative;
  - concurrent workers, crash windows, provider ambiguity, timeout/429/4xx/5xx, expired leases, duplicate enqueue, restart and double-owner startup fail safely;
  - exact-head CI passes without claiming production deployment or provider delivery.
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
