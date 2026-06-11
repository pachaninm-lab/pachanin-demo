# platform-v7 execution queue

CURRENT: VP-2.5: Remaining Tail + Regression Gate (full web vitest green, web-unit required job)

CURRENT ALLOWED:
- apps/web/tests/unit/**
- apps/web/tests/setup.ts
- apps/web/components/v7r/**
- apps/web/components/platform-v7/**
- apps/web/app/platform-v7/**
- apps/web/lib/platform-v7/**
- apps/web/lib/v7r/**
- apps/web/styles/**
- packages/domain-core/src/execution-simulation/**
- .github/workflows/dependency-review.yml
- .github/workflows/automerge.yml
- .github/workflows/platform-v7-autopilot-guard.yml
- .github/workflows/platform-v7-autopilot-issue-executor-dry-run.yml
- .github/workflows/platform-v7-autopilot-executor-wiring.yml
- .github/workflows/web-unit.yml
- scripts/p7-autopilot-issue-executor-dry-run.mjs
- scripts/p7-autopilot-issue-executor-pr-wiring.mjs
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

DONE:
- VP-1: Visible Execution Entry Cockpit
- VP-2: Runtime QA Stabilization (slice 1 merged)
- VP-3: Runtime-bound Entry Cockpit
- VP-4: Product Entry (open, role-preview, onboarding — merged via PR #1689)
- VP-2.3: Shell / Role Isolation Guards (165/165 in scope, full run 270 -> 212, no regressions)
- VP-2.2: Server Action Route Contracts (closed in slice 1, verified green)
- VP-2.4: Honesty / Premium Copy Guards (named scope, full run 212 -> 191, no regressions)

NEXT:
- Layer: web-unit merge gate activation
- Allowed files:
  - .github/workflows/web-unit.yml
  - .github/workflows/platform-v7-autopilot-guard.yml
  - .github/workflows/platform-v7-autopilot-issue-executor-dry-run.yml
  - .github/workflows/platform-v7-autopilot-executor-wiring.yml
  - scripts/p7-autopilot-issue-executor-dry-run.mjs
  - scripts/p7-autopilot-issue-executor-pr-wiring.mjs
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - pnpm --filter @pc/web test is green in CI
  - web-unit job is required for merge into main
- Readiness remains 69% full mature platform readiness.

LATER:
- VP-5 driver / logistics cockpit binding (after VP-2 green)
- VP-6 bank cockpit binding
- VP-7 dispute / evidence binding
- VP-8 theme / mobile final QA

RULES:
- one PR equals one narrow layer
- no apps/landing
- no API routes
- no DB
- no package or lockfiles
- full web vitest must not degrade (target: required web-unit gate in VP-2.5)
