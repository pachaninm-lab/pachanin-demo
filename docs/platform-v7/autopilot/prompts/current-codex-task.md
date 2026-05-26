# Codex current task — PR 6.7 Lab / Inspection Adapter Emulator

Current step: PR 6.7 — Lab / Inspection Adapter Emulator.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-6-adapter-emulator-contracts.md

## Objective

Implement a pre-integration lab / inspection adapter emulator that models quality
protocol, sample, inspection and discrepancy events without live laboratory or
surveyor connectivity.

Follow the same patterns established in PR 6.2 (bank-adapter-emulator.ts),
PR 6.3 (fgis-adapter-emulator.ts), PR 6.4 (edo-adapter-emulator.ts),
PR 6.5 (epd-adapter-emulator.ts): deterministic, DI-friendly, zero `any`,
idempotent, satisfies interface.

## Allowed files

- apps/web/lib/platform-v7/lab-adapter-emulator.ts
- apps/web/tests/unit/platformV7LabAdapterEmulator.test.ts
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

The lab adapter emulator (`apps/web/lib/platform-v7/lab-adapter-emulator.ts`) must:

- Be deterministic, fully typed (no `any`), DI-friendly, idempotent.
- Model quality protocol and inspection events without claiming live lab or surveyor connectivity.
- Include `LabAdapterEmulatorConfig`, `LabAdapterEmulator` class and
  `createLabAdapterEmulator` factory.
- Quality deltas must remain auditable and must be able to affect hold/release
  basis, dispute and document blockers (via explicit status — not live calls).

Required event types (from stage-6-adapter-emulator-contracts.md):

- sample_registered
- protocol_draft_created
- protocol_confirmed
- quality_delta_detected
- discrepancy_reported
- inspection_confirmed
- manual_review

Required failure states:

- rejected
- conflict
- manual_review
- timeout
- invalid_payload

Required event envelope fields:

- source: "lab_emulator"
- receivedAt: ISO string
- correlationId: string
- externalStatus: LabEventType | LabFailureState
- maturity: "pre-integration"
- payload: typed (dealId, sampleId?, protocolId?, qualityDeltaPercent?, reason?)

State machine constraints:

- protocol_draft_created requires prior sample_registered.
- protocol_confirmed requires prior protocol_draft_created.
- quality_delta_detected requires prior sample_registered.
- discrepancy_reported requires prior quality_delta_detected.
- inspection_confirmed requires prior protocol_confirmed.
- Unknown correlationId for state-dependent events → invalid_payload.
- Duplicate (eventType, correlationId) → idempotent.

## Tests

Required test cases: determinism, idempotency, lifecycle state machine,
invalid_payload for missing prior step, all failure states via config,
no live lab claim (maturity always "pre-integration"), no network calls,
full event type coverage, quality delta auditing (qualityDeltaPercent in payload).

## Readiness

Keep `fullTzReadinessPercent` at 60. Do not raise it.

## PR title

feat(platform-v7): add lab / inspection adapter emulator
