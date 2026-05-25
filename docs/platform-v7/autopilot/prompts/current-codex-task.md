# Codex current task — PR 5.8 Stage 5 Stability Wiring

Current step: PR 5.8 — Stage 5 Stability Wiring.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- scripts/p7-autopilot-guard.sh
- apps/web/tests/unit/platformV7RuntimeServerActions.test.ts
- apps/web/tests/unit/platformV7RuntimeIntegration.test.ts
- apps/web/tests/unit/platformV7RuntimeFinalQa.test.ts

## Objective

Finalize Stage 5 runtime stability before PR 6.x starts.

This step does not add product features. It only ensures the Stage 5 runtime QA suite is actually executed by the required autopilot guard path and that autopilot state does not advance to PR 6.x before this stability wiring is green and merged.

## Allowed files

- scripts/p7-autopilot-guard.sh
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
- apps/web/lib/platform-v7/runtime implementation files
- apps/web/tests/unit/platformV7RuntimeServerActions.test.ts
- apps/web/tests/unit/platformV7RuntimeIntegration.test.ts
- apps/web/tests/unit/platformV7RuntimeFinalQa.test.ts
- package-lock.json
- pnpm-lock.yaml
- theme
- onboarding
- UI components/routes

## Implement

Keep the existing Stage 5 runtime implementation untouched.

Required changes:

- Ensure `scripts/p7-autopilot-guard.sh` runs the Stage 5 runtime test suite when those files exist:
  - tests/unit/platformV7RuntimeServerActions.test.ts
  - tests/unit/platformV7RuntimeIntegration.test.ts
  - tests/unit/platformV7RuntimeFinalQa.test.ts
- Keep `pnpm test` behavior unchanged; do not edit root package.json or lockfiles.
- Keep PR 5.8 as the current autopilot step until this PR is green and merged.
- Do not mark PR 5.8 as lastClosed before merge.
- Keep PR 6.x locked until PR 5.8 is green and merged.
- Keep all maturity language at controlled-pilot / pre-integration.
- Do not introduce any live bank, FGIS, EDO or production-ready claims.

## Tests / checks

Run:

- bash scripts/p7-autopilot-guard.sh
- pnpm typecheck
- pnpm test

The guard itself must execute the Stage 5 runtime tests so they cannot be optional local-only coverage.

## PR title

ci(platform-v7): wire stage 5 runtime qa into guard
