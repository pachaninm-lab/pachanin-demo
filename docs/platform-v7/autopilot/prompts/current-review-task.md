# Review current task — PR 5.1 — Application Service Layer

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

Review the diff, not the agent report.

## Required scope checks

- `apps/landing` diff must be 0.
- UI/visual/theme/onboarding diff must be 0 unless explicitly allowed by the current step.
- adapters/server-actions/AI gateway diff must be 0 unless explicitly allowed by the current step.
- no auto-merge behavior.
- no fake-live or maturity overclaim.

## Current allowed scope

- apps/web/lib/platform-v7/runtime/application-service.ts
- apps/web/lib/platform-v7/runtime/application-service-types.ts
- apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts

## Transition guard

- BLOCKED: PR 5.1 — Application Service Layer is not green/closed/mergeable. Dispatcher will not advance to PR 5.5 — Mock Persistence Adapter.

## Queue snapshot

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


## Review brief

# Review task — PR 5.1 Application Service Layer

Review only PR 5.1.

Allowed files:
- apps/web/lib/platform-v7/runtime/application-service.ts
- apps/web/lib/platform-v7/runtime/application-service-types.ts
- apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts

Reject scope expansion:
- apps/landing
- platform-v7 UI routes/components
- adapters
- server actions
- AI gateway
- theme or onboarding
- package-lock.json

Architecture checks:
- DTO validation before execution.
- Persistence through injected ports.
- Idempotency before mutation.
- Duplicate idempotency does not mutate twice.
- Audit records success and denied actions.
- Money, document and bank basis actions use only the action-boundary functions.
- Release workflow remains thin orchestration.
- Dispute service does not move money directly.
- No hidden module-level persistence.
- Typed results are returned.

Forbidden direct service-layer domain calls:
- platformV7ApplyMoneyOperation
- platformV7ReleaseGate
- p7ConfirmBankRelease
- p7ConfirmBankRefund
- p7ConfirmBankHold
- p7MarkBankBasisSent
- p7BuildBankBasisPayload
- p7BuildArbitrationBasisPayload
- platformV7DocumentsBlockingStage
- isBankBasisReady
- platformV7DocumentMatrixReadiness

Allowed action-boundary calls:
- executePlatformV7MoneyAction
- executePlatformV7DocumentAction
- executePlatformV7BankBasisAction

Return:

BLOCKERS
- ...

REQUIRED FIXES
- ...

OPTIONAL IMPROVEMENTS
- ...

MERGEABLE: yes/no

Return PASS or BLOCKED. If BLOCKED, include blocker, file, why risk and exact fix.
