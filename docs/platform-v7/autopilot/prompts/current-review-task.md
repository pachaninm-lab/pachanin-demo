# Review current task — PR 6.6 External Adapter Runtime QA

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify that PR 6.6 implements cross-emulator integration QA tests correctly without adding
live integrations, API routes, UI, DB, AI gateway, onboarding or theme changes.

## Allowed files

- apps/web/tests/unit/platformV7ExternalAdapterRuntimeQA.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md

## Reject if changed

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7/adapters
- apps/web/lib/platform-v7/ai
- apps/web/app/api
- apps/web/lib/platform-v7/runtime
- package-lock.json
- pnpm-lock.yaml

## Review checks

- Tests import from emulator files only, no live adapters.
- All four emulators exercised: bank, FGIS, EDO, EPD.
- Event envelope verified on each emulator: source, receivedAt, correlationId, externalStatus, maturity, payload.
- Maturity always "pre-integration" on all emulators.
- Idempotency verified across all emulators.
- Failure injection (manualReview, timeout, rejected, conflict) verified across all emulators.
- State machine lifecycles verified for each emulator.
- Cross-emulator deal scenario present and correct.
- No live external system claims in test descriptions or assertions.
- No network calls.
- No `any` types.
- No forbidden claims.
- Readiness stays at 60%.

## Required checks

- platform-v7 autopilot guard
- pnpm typecheck
- pnpm test
- Node CI / CI / Repo automations / Labeler

## Output

BLOCKERS / REQUIRED FIXES / OPTIONAL / MERGEABLE: yes/no
