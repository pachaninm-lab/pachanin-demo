# Review current task — PR 6.2 Bank Adapter Emulator

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify that PR 6.2 implements the bank adapter emulator correctly without adding live integrations, API routes, UI, DB, AI gateway, onboarding or theme changes.

## Allowed files

- apps/web/lib/platform-v7/bank-adapter-emulator.ts
- apps/web/tests/unit/platformV7BankAdapterEmulator.test.ts
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

- Bank emulator is deterministic: same input produces same output.
- Bank emulator has no hidden singleton state; config is injected.
- Bank emulator supports correlation IDs for idempotency.
- All required event types are present: reserve_requested, reserve_confirmed, hold_created, hold_released, release_requested, release_confirmed, refund_requested, refund_confirmed, manual_review, reconciliation_mismatch.
- All required failure states are present: rejected, conflict, manual_review, timeout, invalid_payload.
- Event envelope includes: source, receivedAt, correlationId, externalStatus, maturity, payload.
- `maturity` field is always "pre-integration".
- No event implies the platform released money independently.
- No live bank, FGIS, EDO or EPD connection claims.
- No API routes added or modified.
- No UI wired.
- No fetch/http/network calls in emulator.
- Readiness stays at 48% and does not increase.
- PR 6.3+ remains locked until PR 6.2 is green and merged.
- Tests cover: determinism, idempotency, correlation state, invalid payload, manual_review, reconciliation_mismatch, no money-release claim, no live bank claim, no network calls.
- No `any` types in emulator module.
- No `production-ready`, `fully live`, `fully integrated`, `банк подключён` or payment-guarantee claims.

## Required checks

- platform-v7 autopilot guard
- pnpm typecheck
- pnpm test
- Node CI
- CI
- Repo automations
- Labeler

## Output

BLOCKERS
- ...

REQUIRED FIXES
- ...

OPTIONAL IMPROVEMENTS
- ...

MERGEABLE: yes/no
