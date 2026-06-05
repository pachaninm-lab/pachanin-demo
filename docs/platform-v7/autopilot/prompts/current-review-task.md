# Review current task — Autopilot Product Slice 04

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

Review the diff, not the agent report.

## Required scope checks

- `apps/landing` diff must be 0.
- UI/visual/theme/onboarding diff must be 0 unless explicitly allowed by the current step.
- adapters/server-actions/AI gateway diff must be 0 unless explicitly allowed by the current step.
- no fake-live or maturity overclaim.

## Current allowed scope

- apps/web/tests/e2e/platform-v7-agent-generated-smoke-03.spec.ts
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- scripts/p7-autopilot-*.mjs
- .github/workflows/platform-v7-autopilot-*.yml

## Transition guard

- BLOCKED: Autopilot Product Slice 04 is not green/closed/mergeable. Dispatcher will not advance to Product Entry / Onboarding.

## Review brief

Review Autopilot Product Slice 04 strictly against the state allowed scope and queue.

Return PASS or BLOCKED. If BLOCKED, include blocker, file, why risk and exact fix.
