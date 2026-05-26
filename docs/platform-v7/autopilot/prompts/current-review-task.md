# Review current task — PR 6.5 EPD / Logistics Adapter Emulator

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify that PR 6.5 implements the EPD / logistics adapter emulator correctly without adding
live integrations, API routes, UI, DB, AI gateway, onboarding or theme changes.

## Allowed files

- apps/web/lib/platform-v7/epd-adapter-emulator.ts
- apps/web/tests/unit/platformV7EpdAdapterEmulator.test.ts
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

- EPD emulator is deterministic, DI-friendly, no hidden singleton state.
- All required event types present: epd_draft_created, epd_sent, epd_confirmed, epd_rejected, trip_event_received, route_deviation_received, arrival_confirmed, manual_review.
- All required failure states present: rejected, conflict, manual_review, timeout, invalid_payload.
- Event envelope: source="epd_emulator", maturity="pre-integration", correlationId, receivedAt, externalStatus, payload.
- Lifecycle state machine correct: epd_sent requires draft, epd_confirmed/rejected require sent, arrival_confirmed requires trip_event_received.
- No live EPD or logistics connection claims.
- No API routes, no UI, no network calls in emulator.
- Readiness stays at 60%.
- PR 6.6+ locked until PR 6.5 green and merged.
- No `any` types.
- No forbidden claims.

## Required checks

- platform-v7 autopilot guard
- pnpm typecheck
- pnpm test
- Node CI / CI / Repo automations / Labeler

## Output

BLOCKERS / REQUIRED FIXES / OPTIONAL / MERGEABLE: yes/no
