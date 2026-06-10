# Review current task — VP-2.5: Remaining Tail + Regression Gate (full web vitest green, web-unit required job)

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

- apps/web/tests/unit/**
- apps/web/tests/setup.ts
- apps/web/components/v7r/**
- apps/web/components/platform-v7/**
- apps/web/app/platform-v7/**
- apps/web/lib/platform-v7/**
- .github/workflows/dependency-review.yml
- .github/workflows/automerge.yml
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

## Transition guard

- BLOCKED: VP-2.5: Remaining Tail + Regression Gate (full web vitest green, web-unit required job) is not green/closed/mergeable. Dispatcher will not advance to Backend / DB / runtime persistence expansion.

## Queue snapshot

# platform-v7 execution queue

CURRENT: VP-2 QA Tail (VP-2.2, VP-2.4, VP-2.5 — see docs/platform-v7/autopilot/master-tz-2.md)

CURRENT ALLOWED:
- apps/web/tests/unit/**
- apps/web/tests/setup.ts
- apps/web/components/v7r/**
- apps/web/components/platform-v7/**
- apps/web/app/platform-v7/**
- apps/web/lib/platform-v7/**
- .github/workflows/dependency-review.yml
- .github/workflows/automerge.yml
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

DONE:
- VP-1: Visible Execution Entry Cockpit
- VP-2: Runtime QA Stabilization (slice 1 merged)
- VP-3: Runtime-bound Entry Cockpit
- VP-4: Product Entry (open, role-preview, onboarding — merged via PR #1689)
- VP-2.3: Shell / Role Isolation Guards (165/165 in scope, full run 270 -> 212, no regressions)

NEXT:
- VP-2.2 server action route contracts (platformV7ServerActionRoute*)
- VP-2.4 honesty / premium copy guards
- VP-2.5 remaining tail + web-unit required merge gate
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


## Review brief

Review VP-2.5: Remaining Tail + Regression Gate (full web vitest green, web-unit required job) strictly against the state allowed scope and queue.

Return PASS or BLOCKED. If BLOCKED, include blocker, file, why risk and exact fix.
