# Review current task — Runner PR Permission Smoke

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

- apps/web/tests/e2e/platform-v7-runner-pr-permission-smoke.spec.ts

## Transition guard

- BLOCKED: Runner PR Permission Smoke is not green/closed/mergeable. Dispatcher will not advance to Product Entry / Onboarding.

## Queue snapshot

# platform-v7 execution queue

CURRENT: Role Boundary Smoke

DONE:
- Runtime foundation stages
- External adapter baseline stages
- AI gateway baseline stages
- CI and QA baseline stages
- Runner health and dispatch stages
- Deal identity smoke
- Route smoke QA
- Agent PR creation reliability

NEXT:
- Add one narrow role-boundary smoke file.
- Allowed file:
  - apps/web/tests/e2e/platform-v7-role-boundary-smoke.spec.ts
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.


## Review brief

Review Runner PR Permission Smoke strictly against the state allowed scope and queue.

Return PASS or BLOCKED. If BLOCKED, include blocker, file, why risk and exact fix.
