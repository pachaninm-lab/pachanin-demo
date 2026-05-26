# Review current task — PR 6.7 Lab / Inspection Adapter Emulator

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify that PR 6.7 implements the lab / inspection adapter emulator correctly without adding
live integrations, API routes, UI, DB, AI gateway, onboarding or theme changes.

## Allowed files

- apps/web/lib/platform-v7/lab-adapter-emulator.ts
- apps/web/tests/unit/platformV7LabAdapterEmulator.test.ts
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

- Lab emulator is deterministic, DI-friendly, no hidden singleton state.
- All required event types present: sample_registered, protocol_draft_created, protocol_confirmed, quality_delta_detected, discrepancy_reported, inspection_confirmed, manual_review.
- All required failure states present: rejected, conflict, manual_review, timeout, invalid_payload.
- Event envelope: source="lab_emulator", maturity="pre-integration", correlationId, receivedAt, externalStatus, payload.
- Lifecycle state machine correct: protocol_draft_created requires sample_registered, protocol_confirmed requires draft, quality_delta_detected requires sample_registered, discrepancy_reported requires quality_delta_detected, inspection_confirmed requires protocol_confirmed.
- No live lab or inspection connection claims.
- No API routes, no UI, no network calls in emulator.
- Readiness stays at 60%.
- No `any` types.
- No forbidden claims.

## Required checks

- platform-v7 autopilot guard
- pnpm typecheck
- pnpm test
- Node CI / CI / Repo automations / Labeler

## Output

BLOCKERS / REQUIRED FIXES / OPTIONAL / MERGEABLE: yes/no
