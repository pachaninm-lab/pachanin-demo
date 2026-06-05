# Review current task — Autopilot Product Slice 03

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

Review the diff, not the agent report.

## Current allowed scope

- apps/web/tests/e2e/platform-v7-agent-generated-smoke-02.spec.ts
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- scripts/p7-autopilot-*.mjs
- .github/workflows/platform-v7-autopilot-*.yml

## Review brief

Review Autopilot Product Slice 03 strictly against the state allowed scope and queue. PASS only if generated code stays in the exact agent writable file and restricted areas remain untouched.
