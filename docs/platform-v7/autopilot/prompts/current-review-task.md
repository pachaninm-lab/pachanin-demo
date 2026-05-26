# Review current task — PR 7.2 AI Gateway Provider Port

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report. Human review and green checks are required before merge.

## Objective

Verify a minimal TypeScript provider port implementation after PR 7.1 (AI Gateway Contracts).

This PR combines state advance and the minimal provider port only because the guard reads allowed scope from the PR branch source-of-truth. Treat this as a high-risk exception and block merge unless every gate below is green.

## Allowed files

- apps/web/lib/platform-v7/ai/gateway-provider-port.ts
- apps/web/lib/platform-v7/ai/gateway-envelope.ts
- apps/web/tests/unit/platformV7AiGatewayProviderPort.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md

## Review checks

- Changed files exactly match the allowed files list.
- `apps/landing` diff is 0.
- Current step is PR 7.2 — AI Gateway Provider Port.
- PR 7.1 is listed as completed in lastClosed.
- Readiness is 64% and not higher.
- PR 7.3+ remains locked.
- No app, runtime, live provider, API, DB, UI, onboarding, theme or lockfile changes.
- Maturity remains controlled-pilot / pre-integration.
- `DisabledGatewayProvider` is the only concrete implementation.
- `DisabledGatewayProvider.execute()` returns a correctly shaped disabled response with `result: null`, `confidence: 0`, non-empty `limitations`, and `auditContext.providerId === "disabled"`.
- `GATEWAY_MATURITY === "pre-integration"`.
- No live provider credentials, tokens, or external AI service calls.
- All forbidden claims absent from exported values, docs and PR body.

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
