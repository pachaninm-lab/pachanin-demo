# Review current task — PR 5.8 Stage 5 Stability Wiring

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify that Stage 5 runtime QA is included in the required autopilot guard path before PR 6.x starts.

## Allowed files

- scripts/p7-autopilot-guard.sh
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
- apps/web/tests/unit/platformV7RuntimeServerActions.test.ts
- apps/web/tests/unit/platformV7RuntimeIntegration.test.ts
- apps/web/tests/unit/platformV7RuntimeFinalQa.test.ts
- package-lock.json
- pnpm-lock.yaml

## Review checks

- Guard runs these existing Stage 5 tests when present:
  - tests/unit/platformV7RuntimeServerActions.test.ts
  - tests/unit/platformV7RuntimeIntegration.test.ts
  - tests/unit/platformV7RuntimeFinalQa.test.ts
- Current step remains PR 5.8 until green and merged.
- PR 5.8 is not in lastClosed before merge.
- PR 6.x remains locked until PR 5.8 green.
- Progress and queue do not state that Stage 6 has started.
- Prompts reference PR 5.8, not PR 5.2.
- No external live-connection or product-maturity claims are introduced.

## Required checks

- bash scripts/p7-autopilot-guard.sh
- pnpm typecheck
- pnpm test

## Output

BLOCKERS
- ...

REQUIRED FIXES
- ...

OPTIONAL IMPROVEMENTS
- ...

MERGEABLE: yes/no
