# Review current task — PR 6.1 External Adapter Emulator Contracts

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify that the autopilot state advances from merged PR 5.8 to PR 6.1 without starting implementation work.

## Allowed files

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
- apps/web/tests/unit
- package-lock.json
- pnpm-lock.yaml

## Review checks

- PR 5.8 is listed as completed.
- Current step is PR 6.1 — External Adapter Emulator Contracts.
- Readiness is 48% and not higher.
- PR 6.2+ remains locked until PR 6.1 green and merged.
- No Stage 6 implementation files are added or edited.
- No UI, onboarding, theme, AI gateway, API, DB, runtime or live adapter work is included.
- No external live-connection or product-maturity claims are introduced.

## Required checks

- platform-v7 autopilot guard
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
