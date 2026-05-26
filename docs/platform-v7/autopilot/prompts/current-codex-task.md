# Codex current task — PR 7.1 AI Gateway Contracts

Current step: PR 7.1 — AI Gateway Contracts.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-7-ai-gateway-contracts.md

## Objective

Define the contracts-only boundary for future AI Gateway work after PR 6.6 was merged green.

This PR must not implement AI runtime behavior, provider calls, API routes, DB persistence, UI, onboarding, theme, role cockpit UX, or live integrations. It only creates the Stage 7 AI Gateway contract document and synchronizes autopilot state so the dispatcher does not repeat PR 6.6.

## Allowed files

- docs/platform-v7/autopilot/stage-7-ai-gateway-contracts.md
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
- apps/web/lib/platform-v7/runtime
- apps/web/tests/unit
- package-lock.json
- pnpm-lock.yaml
- theme / onboarding / UI components/routes

## Implement

Create `docs/platform-v7/autopilot/stage-7-ai-gateway-contracts.md` and define:

- AI Gateway purpose and strict non-production maturity boundary.
- Allowed future capabilities as contracts only: role-aware suggestions, document/checklist review, blocker explanation, next-action drafting, evidence-pack summarization.
- Hard safety rules: no binding decisions, no money release, no external submissions, no live provider claims, no legal/financial final advice, no hidden autonomous actions.
- Required provider boundary: deterministic interface, typed request/response envelope, idempotency key, audit context, role scope, maturity flag, disabled-live-provider state.
- Required review gates before PR 7.2+.
- Forbidden claims list for AI Gateway copy and tests.

Update source-of-truth files:

- Move `PR 6.6 — External Adapter Runtime QA` into `lastClosed`.
- Set current/currentStep to `PR 7.1 — AI Gateway Contracts`.
- Keep `fullTzReadinessPercent` at 64 and do not raise it further in this PR.
- Keep PR 7.2+ / provider implementation / UI / onboarding / theme locked until PR 7.1 is green and merged.
- Keep maturity wording at controlled-pilot / pre-integration.

## Tests / checks

Run through CI:

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler

## PR title

docs(platform-v7): define ai gateway contracts
