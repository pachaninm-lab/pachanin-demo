# Codex current task — PR 5.1 — Application Service Layer

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

PR 5.1 — Application Service Layer

## Next candidate

PR 5.5 — Mock Persistence Adapter

## Transition guard

- BLOCKED: PR 5.1 — Application Service Layer is not green/closed/mergeable. Dispatcher will not advance to PR 5.5 — Mock Persistence Adapter.

## Allowed current scope

- apps/web/lib/platform-v7/runtime/application-service.ts
- apps/web/lib/platform-v7/runtime/application-service-types.ts
- apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts

## Forbidden zones

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7/adapters
- apps/web/lib/platform-v7/ai
- apps/web/app/api
- package-lock.json

## Active queue

# platform-v7 execution queue

CURRENT: PR 5.1 — Application Service Layer

DONE:
- Stage 3 — RBAC / ACL / roles / access rights
- Stage 4 — MoneyTree / Document Matrix / Bank Basis / Action Boundary / Final QA
- Stage 5.0 — Runtime Inventory
- Stage 5.3 — Persistence Port Interfaces
- Stage 5.4 — DTO / Validation Schemas

LOCKED UNTIL 5.1 GREEN:
- PR 5.5 — Mock Persistence Adapter
- PR 5.2 — Server Action Wrappers
- PR 5.6 — Runtime Integration Tests
- PR 5.7 — Final Stage 5 QA
- PR 6.x — External Adapter Emulators
- AI Gateway
- Product Entry / Onboarding
- Theme / Visual
- Role Cockpit / UX

ACTIVE RULES:
- Do not rewrite platform-v7 from scratch.
- Do not touch apps/landing.
- Do not start UI, adapters, onboarding, visual polish, mock persistence, server actions, AI gateway or theme-pass before PR 5.1 is closed and green.
- Keep maturity wording at controlled-pilot / pre-integration.
- No production-ready, fully live, fully integrated, platform guarantees payment, or platform releases money claims.
- One PR = one narrow, reviewable layer.

NEXT AUTOPILOT STEP:
- Run `node scripts/p7-autopilot-dispatcher.mjs`.
- Use `docs/platform-v7/autopilot/prompts/current-codex-task.md` as the implementation prompt.
- Use `docs/platform-v7/autopilot/prompts/current-review-task.md` as the review prompt.
- Do not advance from PR 5.1 until PR #1391 is green, reviewed and manually merged.

AUTOPILOT STATE RULES:
- The dispatcher may generate prompts and progress from state/queue.
- The dispatcher must not mark locked work as current while the current step is not green/closed/mergeable.
- The dispatcher must not update readiness percent as if work merged.
- The dispatcher must not remove forbidden zones.
- The dispatcher must not auto-merge.


## Implementation brief

# Codex task — PR 5.1 Application Service Layer

Repository: `pachaninm-lab/pachanin-demo`

## Current checkpoint

Closed:
- Stage 3 — RBAC / ACL / roles / access rights
- Stage 4 — MoneyTree / Document Matrix / Bank Basis / Action Boundary / Final QA
- Stage 5.0 — Runtime Inventory
- Stage 5.3 — Persistence Port Interfaces
- Stage 5.4 — DTO / Validation Schemas

Current PR only:
- PR 5.1 — Application Service Layer

## Objective

Create the application service layer that connects:
- DTO validation
- persistence ports
- idempotency
- audit
- action-boundary
- domain result
- typed service result

This layer must make runtime actions go through a professional service boundary. Do not make UI changes. Do not create adapters. Do not create server actions. Do not start visual, onboarding, theme, or AI work.

## Allowed files for this PR

Only these files may be created or changed:

```text
apps/web/lib/platform-v7/runtime/application-service.ts
apps/web/lib/platform-v7/runtime/application-service-types.ts
apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts
```

If existing type imports require tiny import-path correction, keep it inside the same runtime boundary and explain it in the PR body. Do not broaden scope without a clear compile failure.

## Services to implement

### P7MoneyExecutionService

Methods:
- `requestRelease`
- `confirmRelease`
- `confirmRefund`
- `confirmHold`
- `startManualReview`

Expected flow:
1. validate DTO
2. load MoneyTree
3. load idempotency context
4. reserve idempotency key
5. execute through `executePlatformV7MoneyAction` or bank-basis action boundary where applicable
6. save MoneyTree
7. record idempotency result
8. append audit
9. return typed result

### P7DocumentExecutionService

Methods:
- `uploadDocument`
- `confirmDocument`
- `rejectDocument`
- `sendDocument`
- `markManualReview`

Expected flow:
1. validate DTO
2. load Document Matrix
3. load idempotency context
4. reserve idempotency key
5. execute through `executePlatformV7DocumentAction`
6. save Document Matrix
7. record idempotency result
8. append audit
9. return typed result

### P7BankBasisExecutionService

Methods:
- `sendBankBasis`
- `confirmBankRelease`
- `rejectBankRelease`
- `confirmBankRefund`
- `confirmBankHold`
- `startBankManualReview`

Expected flow:
1. validate DTO
2. load MoneyTree and BankBasis
3. load idempotency context
4. reserve idempotency key
5. execute through `executePlatformV7BankBasisAction`
6. save MoneyTree and BankBasis through unit-of-work if available
7. record idempotency result
8. append audit / appendMany
9. return typed result

### P7ReleaseWorkflowService

Methods:
- `prepareRelease`
- `requestRelease`
- `sendBasisToBank`
- `handleBankEvent`
- `getReleaseStatus`

This is a thin orchestration layer. It must not duplicate release gate logic and must not call domain helpers directly.

### P7DisputeSettlementService

Methods:
- `openDispute`
- `attachEvidence`
- `prepareArbitrationBasis`
- `applyArbitrationOutcomeToBankBasis`
- `getDisputeMoneyImpact`

This service must not move money directly. Money changes only through the bank/action-boundary path.

## Strictly forbidden direct calls from service layer

Do not call these directly:

```text
platformV7ApplyMoneyOperation
platformV7ReleaseGate
p7ConfirmBankRelease
p7ConfirmBankRefund
p7ConfirmBankHold
p7MarkBankBasisSent
p7BuildBankBasisPayload
p7BuildArbitrationBasisPayload
platformV7DocumentsBlockingStage
isBankBasisReady
platformV7DocumentMatrixReadiness
```

Allowed action-boundary calls:

```text
executePlatformV7MoneyAction
executePlatformV7DocumentAction
executePlatformV7BankBasisAction
```

## Required engineering style

- Use dependency injection for repositories, idempotency store, audit sink, and unit-of-work.
- Use typed results.
- Keep services small and explicit.
- Keep side effects ordered and testable.
- No module-level `Map`, `Set`, global arrays, hidden singleton stores, or UI-level state.
- No magic mock state.
- No fake external integration claims.
- No production maturity claims.
- No `TODO AI`, no console noise, no large generated comments.

## Required tests

Create `apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts` with coverage for at least:

- money service happy path
- document service happy path
- bank basis service happy path
- duplicate idempotency returns previous result and does not mutate twice
- denied role/action returns typed denial and writes audit
- persistence save is called after successful action
- audit append/appendMany is called
- release workflow delegates to services and does not call domain directly
- dispute service does not move money directly

Use existing test conventions in the repo. Keep the test self-contained and deterministic.

## Local checks

Run the closest available checks:

```bash
pnpm typecheck
pnpm test
```

If repo scripts differ, run the relevant platform-v7 runtime tests and document exact commands in the PR body.

## PR title

```text
feat(platform-v7): add application service layer
```

## PR body checklist

Include:

```text
Scope
- Added PR 5.1 Application Service Layer only.

Changed files
- apps/web/lib/platform-v7/runtime/application-service.ts
- apps/web/lib/platform-v7/runtime/application-service-types.ts
- apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts

Guards
- apps/landing diff: 0
- UI diff: 0
- adapters/server-actions/AI/theme diff: 0
- no direct forbidden domain calls from service layer
- no module-level fake persistence
- no fake-live claims

Checks
- pnpm typecheck: <result>
- pnpm test / relevant tests: <result>
```
