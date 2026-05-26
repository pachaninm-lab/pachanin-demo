# Codex current task — PR 7.4 AI Gateway Runtime QA

Current step: PR 7.4 — AI Gateway Runtime QA.
Maturity: controlled-pilot / pre-integration.

## Objective

Add focused runtime QA for the AI gateway provider layer.

## Allowed files

- apps/web/tests/unit/platformV7AiGatewayRuntimeQa.test.ts
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
- apps/web/app/api
- apps/web/lib/platform-v7/runtime
- package-lock.json
- pnpm-lock.yaml

## Implement

Create `apps/web/tests/unit/platformV7AiGatewayRuntimeQa.test.ts`.

Verify:
- disabled provider and mock provider share the provider port contract;
- maturity stays `pre-integration`;
- mock provider is deterministic;
- disabled provider returns no result;
- neither provider uses network calls or credentials;
- outputs do not contain forbidden live/provider/payment claims.

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler
- Dependency Review

## PR title

test(platform-v7): add ai gateway runtime qa
