# Codex current task — Autopilot Product Slice 04

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

Autopilot Product Slice 04

## Next candidate

Product Entry / Onboarding

## Transition guard

- BLOCKED: Autopilot Product Slice 04 is not green/closed/mergeable. Dispatcher will not advance to Product Entry / Onboarding.

## Allowed current scope

- apps/web/tests/e2e/platform-v7-agent-generated-smoke-03.spec.ts
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- scripts/p7-autopilot-*.mjs
- .github/workflows/platform-v7-autopilot-*.yml

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

## Implementation brief

Implement Autopilot Product Slice 04 strictly inside the state allowed scope. Create exactly one Playwright smoke spec at `apps/web/tests/e2e/platform-v7-agent-generated-smoke-03.spec.ts` and do not modify product code.
