# Codex current task — PR 6.4 EDO Adapter Emulator

Current step: PR 6.4 — EDO Adapter Emulator.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-6-adapter-emulator-contracts.md

## Objective

Implement a pre-integration EDO adapter emulator that models legally significant
document exchange lifecycle events without live EDO connectivity.

Follow the same patterns established in PR 6.2 (bank-adapter-emulator.ts)
and PR 6.3 (fgis-adapter-emulator.ts): deterministic, DI-friendly, zero `any`,
idempotent, satisfies interface.

## Allowed files

- apps/web/lib/platform-v7/edo-adapter-emulator.ts
- apps/web/tests/unit/platformV7EdoAdapterEmulator.test.ts
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

The EDO adapter emulator (`apps/web/lib/platform-v7/edo-adapter-emulator.ts`) must:

- Be deterministic, fully typed (no `any`), DI-friendly, idempotent.
- Model document exchange without claiming live EDO connectivity.
- Include `EdoAdapterEmulatorConfig`, `EdoAdapterEmulator` class and
  `createEdoAdapterEmulator` factory.
- Documents must remain tied to deal, role, responsible party, blocker level
  and money impact (through status, not through live calls).

Required event types (from stage-6-adapter-emulator-contracts.md):

- document_draft_created
- document_sent
- document_signed_by_one_side
- document_signed_by_all_sides
- document_rejected
- document_revoked
- manual_review

Required failure states:

- rejected
- conflict
- manual_review
- timeout
- invalid_payload

Required event envelope fields:

- source: "edo_emulator"
- receivedAt: ISO string
- correlationId: string
- externalStatus: EdoEventType | EdoFailureState
- maturity: "pre-integration"
- payload: typed (dealId, documentId?, documentType?, reason?)

State machine constraints:

- document_sent requires prior document_draft_created.
- document_signed_by_one_side requires prior document_sent.
- document_signed_by_all_sides requires prior document_signed_by_one_side.
- document_rejected / document_revoked require prior document_sent.
- Unknown correlationId for state-dependent events → invalid_payload.
- Duplicate (eventType, correlationId) → idempotent.

## Tests

Required test cases: determinism, idempotency, lifecycle state machine,
invalid_payload for missing prior step, all failure states via config,
no live EDO claim (maturity always "pre-integration"), no network calls,
full event type coverage.

## Readiness

Keep `fullTzReadinessPercent` at 56. Do not raise it.

## PR title

feat(platform-v7): add EDO adapter emulator
