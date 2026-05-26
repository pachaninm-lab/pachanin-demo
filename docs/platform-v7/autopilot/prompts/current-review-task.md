# Review current task — PR 7.4 AI Gateway Runtime QA

Maturity: controlled-pilot / pre-integration.

## Allowed files

- apps/web/tests/unit/platformV7AiGatewayRuntimeQa.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler
- Dependency Review

## Merge rule

Merge only if scope is clean, checks are green, apps/landing diff is 0, maturity remains controlled-pilot / pre-integration, and mergeable=true.
