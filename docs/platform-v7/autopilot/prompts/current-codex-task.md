# Codex current task — PR 6.6 External Adapter Runtime QA

Current step: PR 6.6 — External Adapter Runtime QA.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-6-adapter-emulator-contracts.md

## Objective

Implement cross-emulator integration QA tests that verify all four external adapter
emulators (bank, FGIS, EDO, EPD/logistics) behave correctly in isolation and in
combination without live connectivity.

Follow the same patterns established in PR 6.2–6.5: deterministic, DI-friendly,
zero `any`, idempotent, no network calls, no live external system claims.

## Allowed files

- apps/web/tests/integration/platformV7ExternalAdapterRuntimeQA.test.ts
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

The QA test file (`apps/web/tests/integration/platformV7ExternalAdapterRuntimeQA.test.ts`) must:

- Be deterministic, fully typed (no `any`), DI-friendly.
- Import and exercise all four emulators: BankAdapterEmulator, FgisAdapterEmulator,
  EdoAdapterEmulator, EpdAdapterEmulator.
- Verify event envelope fields: source, receivedAt, correlationId, externalStatus,
  maturity, payload.
- Verify maturity is always "pre-integration" on all emulators.
- Verify idempotency across all emulators.
- Verify failure injection (manualReview, timeout, rejected, conflict) across all emulators.
- Verify state machine lifecycles: bank reserve→hold→release chain,
  FGIS party_link→sdiz chain, EDO draft→sent→signed chain, EPD draft→sent→confirmed chain.
- Verify cross-emulator deal scenario: a deal that requires all four adapter events.
- No live external system claims in any test assertion or description.
- No network calls.

## Cross-emulator deal scenario

Model a complete deal flow using all four emulators for the same dealId:
1. Bank: reserve_requested → reserve_confirmed
2. FGIS: party_link_requested → party_linked → sdiz_draft_created → sdiz_signed
3. EDO: document_draft_created → document_sent → document_signed_by_all_sides
4. EPD: epd_draft_created → epd_sent → epd_confirmed → trip_event_received → arrival_confirmed

Verify: all events reference the same dealId, all have maturity "pre-integration",
no event claims live connectivity.

## Tests

Required test cases:
- All four emulators instantiate and reset correctly.
- Envelope fields correct on each emulator.
- Idempotency on each emulator.
- Failure injection on each emulator.
- State machine for each emulator.
- Cross-emulator deal scenario.
- No live external claim across all emulators (check serialized events for forbidden phrases).

## Readiness

Keep `fullTzReadinessPercent` at 60. Do not raise it.

## PR title

feat(platform-v7): external adapter runtime QA — cross-emulator integration tests
