# Codex current task — Role Boundary Smoke

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

Role Boundary Smoke

## Next candidate

Product Entry / Onboarding

## Transition guard

- BLOCKED: Role Boundary Smoke is not green/closed/mergeable. Dispatcher will not advance to Product Entry / Onboarding.

## Allowed current scope

- apps/web/tests/e2e/platform-v7-role-boundary-smoke.spec.ts

## Forbidden zones

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7
- apps/web/app/api
- package.json
- package-lock.json
- pnpm-lock.yaml

## Active queue

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


## Implementation brief

Implement Role Boundary Smoke strictly inside the state allowed scope.
