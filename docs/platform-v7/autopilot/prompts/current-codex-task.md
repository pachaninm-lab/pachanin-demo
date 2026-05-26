# Codex current task — PR 6.3 FGIS Adapter Emulator

Current step: PR 6.3 — FGIS Adapter Emulator.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-6-adapter-emulator-contracts.md

## Objective

Implement a pre-integration FGIS/SDIZ adapter emulator that models party
traceability, SDIZ status, redemption and error/manual review states without
live FGIS connectivity.

This PR must not add API routes, wire UI, change runtime behavior, touch
DB/migrations, touch AI gateway, or claim live FGIS/SDIZ integration. It only
implements the deterministic emulator TypeScript module and its focused unit tests.

Follow the same patterns established in PR 6.2 (bank-adapter-emulator.ts):
- deterministic, DI-friendly, zero `any`, idempotent, satisfies interface.

## Allowed files

- apps/web/lib/platform-v7/fgis-adapter-emulator.ts
- apps/web/tests/unit/platformV7FgisAdapterEmulator.test.ts
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
- theme
- onboarding
- UI components/routes

## Implement

The FGIS adapter emulator (`apps/web/lib/platform-v7/fgis-adapter-emulator.ts`) must:

- Be deterministic: same input → same output.
- Be fully typed in TypeScript with no `any`.
- Be dependency-injection friendly: accept a seed/config, no hidden singleton state.
- Support idempotency via correlation IDs.
- Model FGIS/SDIZ event statuses without claiming live FGIS connection.
- Preserve the rule: FGIS/SDIZ status affects deal readiness only through
  explicit status and blocker mapping — not through live system calls.
- Include a `FgisAdapterEmulatorConfig` type.
- Include a `FgisAdapterEmulator` class and `createFgisAdapterEmulator` factory.

Required event types (from stage-6-adapter-emulator-contracts.md):

- party_link_requested
- party_linked
- sdiz_draft_created
- sdiz_ready_to_sign
- sdiz_signed
- sdiz_sent
- sdiz_redeemed
- sdiz_partially_redeemed
- sdiz_error
- manual_review

Required failure states:

- rejected
- conflict
- manual_review
- timeout
- invalid_payload

Required event envelope fields:

- source: "fgis_emulator"
- receivedAt: ISO string
- correlationId: string
- externalStatus: FgisEventType | FgisFailureState
- maturity: "pre-integration"
- payload: typed (dealId, sdizId?, partyInn?, reason?)

State machine constraints:

- party_linked requires prior party_link_requested with same correlationId.
- sdiz_ready_to_sign requires prior sdiz_draft_created.
- sdiz_signed requires prior sdiz_ready_to_sign.
- sdiz_sent requires prior sdiz_signed.
- sdiz_redeemed / sdiz_partially_redeemed require prior sdiz_sent.
- Unknown correlationId for state-dependent events → invalid_payload.
- Duplicate correlationId for same event type → idempotent.

## Tests

Required test cases:

- Determinism
- Idempotency
- State machine: each confirmation requires prior step
- Invalid payload: missing prior step → invalid_payload
- Manual review and sdiz_error states
- No live FGIS claim: maturity always "pre-integration"
- No network calls
- All required event types covered

## Readiness

Keep `fullTzReadinessPercent` at 52 in this PR. Do not raise it.

## Tests / checks

Run through CI:

- platform-v7 autopilot guard
- pnpm typecheck
- pnpm test
- Node CI
- CI
- Repo automations
- Labeler

## PR title

feat(platform-v7): add FGIS adapter emulator
