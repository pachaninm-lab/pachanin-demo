# Review current task — PR 7.3 AI Gateway Mock Provider

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify a deterministic pre-integration mock provider behind the existing AI gateway provider port.

## Allowed files

- apps/web/lib/platform-v7/ai/gateway-mock-provider.ts
- apps/web/tests/unit/platformV7AiGatewayMockProvider.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md

## Review checks

- Changed files are inside the allowed files list.
- `apps/landing` diff is 0.
- Current step is PR 7.3 — AI Gateway Mock Provider.
- PR 7.2 is listed as completed in lastClosed.
- Readiness is 64% and not higher.
- PR 7.4+ remains locked.
- No app, runtime, live provider, API, DB, UI, onboarding, theme or lockfile changes.
- Maturity remains controlled-pilot / pre-integration.
- Mock provider is deterministic for the same request.
- Mock provider uses no network calls, credentials or external AI services.
- Mock provider output states limitations and human review boundary.
- No binding decision, money guarantee, money release or live AI gateway claim is introduced.

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

MERGEABLE: yes/no
