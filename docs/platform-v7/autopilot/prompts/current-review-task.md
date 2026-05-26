# Review current task — PR 6.3 FGIS Adapter Emulator

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify that PR 6.3 implements the FGIS/SDIZ adapter emulator correctly without
adding live integrations, API routes, UI, DB, AI gateway, onboarding or theme changes.

## Allowed files

- apps/web/lib/platform-v7/fgis-adapter-emulator.ts
- apps/web/tests/unit/platformV7FgisAdapterEmulator.test.ts
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

- FGIS emulator is deterministic.
- FGIS emulator has no hidden singleton state; config is injected.
- FGIS emulator supports correlation IDs for idempotency.
- All required event types present: party_link_requested, party_linked, sdiz_draft_created, sdiz_ready_to_sign, sdiz_signed, sdiz_sent, sdiz_redeemed, sdiz_partially_redeemed, sdiz_error, manual_review.
- All required failure states present: rejected, conflict, manual_review, timeout, invalid_payload.
- Event envelope includes: source, receivedAt, correlationId, externalStatus, maturity, payload.
- `maturity` field is always "pre-integration".
- `source` is "fgis_emulator", not "fgis" or "live_fgis".
- No live FGIS/SDIZ connection claims.
- No API routes added or modified.
- No UI wired.
- No fetch/http/network calls in emulator.
- Readiness stays at 52% and does not increase.
- PR 6.4+ remains locked until PR 6.3 is green and merged.
- No `any` types in emulator module.
- No `production-ready`, `fully live`, `ФГИС подключён` or payment-guarantee claims.

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
