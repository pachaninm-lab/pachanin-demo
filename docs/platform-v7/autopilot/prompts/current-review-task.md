# Review current task — PR 6.4 EDO Adapter Emulator

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify that PR 6.4 implements the EDO adapter emulator correctly without adding
live integrations, API routes, UI, DB, AI gateway, onboarding or theme changes.

## Allowed files

- apps/web/lib/platform-v7/edo-adapter-emulator.ts
- apps/web/tests/unit/platformV7EdoAdapterEmulator.test.ts
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

- EDO emulator is deterministic, DI-friendly, no hidden singleton state.
- All required event types present: document_draft_created, document_sent, document_signed_by_one_side, document_signed_by_all_sides, document_rejected, document_revoked, manual_review.
- All required failure states present: rejected, conflict, manual_review, timeout, invalid_payload.
- Event envelope: source="edo_emulator", maturity="pre-integration", correlationId, receivedAt, externalStatus, payload.
- Lifecycle state machine correct: sent requires draft, signed_by_one requires sent, signed_by_all requires signed_by_one.
- No live EDO connection claims.
- No API routes, no UI, no network calls in emulator.
- Readiness stays at 56%.
- PR 6.5+ locked until PR 6.4 green and merged.
- No `any` types.
- No forbidden claims.

## Required checks

- platform-v7 autopilot guard
- pnpm typecheck
- pnpm test
- Node CI / CI / Repo automations / Labeler

## Output

BLOCKERS / REQUIRED FIXES / OPTIONAL / MERGEABLE: yes/no
