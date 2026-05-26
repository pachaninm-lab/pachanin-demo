# Codex current task — PR 6.2 Bank Adapter Emulator

Current step: PR 6.2 — Bank Adapter Emulator.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-6-adapter-emulator-contracts.md

## Objective

Implement a pre-integration bank adapter emulator that models bank-side events without live bank connectivity.

This PR must not add API routes, wire UI, change runtime behavior, touch DB/migrations, touch AI gateway, or claim live bank integration. It only implements the deterministic emulator TypeScript module and its focused unit tests.

## Allowed files

- apps/web/lib/platform-v7/bank-adapter-emulator.ts
- apps/web/tests/unit/platformV7BankAdapterEmulator.test.ts
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

The bank adapter emulator (`apps/web/lib/platform-v7/bank-adapter-emulator.ts`) must:

- Be deterministic: same input → same output.
- Be fully typed in TypeScript with no `any`.
- Be dependency-injection friendly: accept a seed/config, no hidden singleton state.
- Support idempotency via correlation IDs.
- Model bank event statuses without claiming live bank connection.
- Preserve the core rule: the platform does not release money itself; bank confirmation is external.
- Include a `BankAdapterEmulatorConfig` type for DI configuration.
- Include a `BankAdapterEmulator` class or factory function.

Required event types (enum or union):

- reserve_requested
- reserve_confirmed
- hold_created
- hold_released
- release_requested
- release_confirmed
- refund_requested
- refund_confirmed
- manual_review
- reconciliation_mismatch

Required failure states:

- rejected
- conflict
- manual_review
- timeout
- invalid_payload

Required event envelope fields (aligned with stage-6-adapter-emulator-contracts.md):

- source: "bank_emulator"
- receivedAt: ISO string
- correlationId: string
- externalStatus: BankEventType | BankFailureState
- maturity: "pre-integration"
- payload: typed per event

State machine constraints:

- reserve_confirmed requires prior reserve_requested with same correlationId.
- release_confirmed requires prior release_requested with same correlationId.
- refund_confirmed requires prior refund_requested with same correlationId.
- Unknown correlationId → invalid_payload.
- Duplicate correlationId for same event type → idempotent (return existing result).

Money rule (must be asserted in tests):

- The emulator must never emit an event that claims the platform released money.
- `release_confirmed` means "bank confirmed release" — not "platform released".

## Tests (`apps/web/tests/unit/platformV7BankAdapterEmulator.test.ts`)

Required test cases:

- Deterministic event creation: same seed + correlationId → same event.
- Idempotency: calling with same correlationId twice returns the same result.
- Correlation state: release_confirmed requires prior release_requested.
- Invalid payload: unknown correlationId → invalid_payload failure.
- Manual review: emulator can produce manual_review state.
- Reconciliation mismatch: emulator can produce reconciliation_mismatch.
- No money release claim: no event contains text claiming the platform released money.
- No live bank claim: maturity field is always "pre-integration".
- No network calls: emulator must not call fetch/http/axios.

## Readiness

Keep `fullTzReadinessPercent` at 48 in this PR. Do not raise it.
Readiness may advance after PR 6.2 is green and merged.

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

feat(platform-v7): add bank adapter emulator
