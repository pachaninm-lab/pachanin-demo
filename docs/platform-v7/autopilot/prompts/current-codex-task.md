# Codex current task — PR 6.5 EPD / Logistics Adapter Emulator

Current step: PR 6.5 — EPD / Logistics Adapter Emulator.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-6-adapter-emulator-contracts.md

## Objective

Implement a pre-integration EPD / logistics adapter emulator that models transport
document and logistics event exchange without live EPD or logistics system connectivity.

Follow the same patterns established in PR 6.2 (bank-adapter-emulator.ts),
PR 6.3 (fgis-adapter-emulator.ts), and PR 6.4 (edo-adapter-emulator.ts):
deterministic, DI-friendly, zero `any`, idempotent, satisfies interface.

## Allowed files

- apps/web/lib/platform-v7/epd-adapter-emulator.ts
- apps/web/tests/unit/platformV7EpdAdapterEmulator.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md

## Forbidden zones

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
- theme / onboarding / UI components/routes

## Implement

The EPD adapter emulator (`apps/web/lib/platform-v7/epd-adapter-emulator.ts`) must:

- Be deterministic, fully typed (no `any`), DI-friendly, idempotent.
- Model transport document and logistics events without claiming live EPD or logistics connectivity.
- Include `EpdAdapterEmulatorConfig`, `EpdAdapterEmulator` class and
  `createEpdAdapterEmulator` factory.
- Logistics events must not override evidence, quality, document or bank gates
  without explicit domain rules.

Required event types (from stage-6-adapter-emulator-contracts.md):

- epd_draft_created
- epd_sent
- epd_confirmed
- epd_rejected
- trip_event_received
- route_deviation_received
- arrival_confirmed
- manual_review

Required failure states:

- rejected
- conflict
- manual_review
- timeout
- invalid_payload

Required event envelope fields:

- source: "epd_emulator"
- receivedAt: ISO string
- correlationId: string
- externalStatus: EpdEventType | EpdFailureState
- maturity: "pre-integration"
- payload: typed (dealId, tripId?, documentId?, reason?)

State machine constraints:

- epd_sent requires prior epd_draft_created.
- epd_confirmed requires prior epd_sent.
- epd_rejected requires prior epd_sent.
- arrival_confirmed requires prior trip_event_received.
- Unknown correlationId for state-dependent events → invalid_payload.
- Duplicate (eventType, correlationId) → idempotent.

## Tests

Required test cases: determinism, idempotency, lifecycle state machine,
invalid_payload for missing prior step, all failure states via config,
no live EPD claim (maturity always "pre-integration"), no network calls,
full event type coverage.

## Readiness

Keep `fullTzReadinessPercent` at 60. Do not raise it.

## PR title

feat(platform-v7): add EPD / logistics adapter emulator
