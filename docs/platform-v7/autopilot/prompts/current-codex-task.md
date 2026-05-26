# Codex current task — PR 7.3 AI Gateway Mock Provider

Current step: PR 7.3 — AI Gateway Mock Provider.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-7-ai-gateway-contracts.md

## Objective

Implement a deterministic pre-integration mock provider behind the existing AI gateway provider port.

This PR must not implement a live AI provider, make external calls, add API routes, touch DB, or touch UI. It only adds the mock provider and focused tests.

## Allowed files

- apps/web/lib/platform-v7/ai/gateway-mock-provider.ts
- apps/web/tests/unit/platformV7AiGatewayMockProvider.test.ts
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
- live provider runtime
- API key usage
- external AI service calls

## Implement

Create `apps/web/lib/platform-v7/ai/gateway-mock-provider.ts`.

Required behavior:

- imports `GatewayProviderPort`, `GatewayRequest`, `GatewayResponse`, `GATEWAY_MATURITY` from the provider port layer;
- exports `MockGatewayProvider` implementing `GatewayProviderPort`;
- deterministic response based only on request fields;
- no network calls;
- no credentials;
- no global mutable singleton state;
- no binding decisions;
- returns `maturity: "pre-integration"` through existing envelope conventions;
- supports scopes: `hint`, `summary`, `blocker_explanation`, `next_action`, `evidence_summary`, `triage`;
- always includes limitations explaining that output requires human review and cannot override bank/document/logistics statuses.

Create `apps/web/tests/unit/platformV7AiGatewayMockProvider.test.ts` and verify:

- provider resolves for every allowed scope;
- response is deterministic for the same request;
- response carries non-empty limitations;
- response confidence is bounded from 0 to 1;
- provider does not use network APIs;
- provider output does not contain forbidden claims;
- no claim that AI makes binding decisions;
- no claim that AI gateway is live;
- no claim that platform releases money or guarantees payment.

## Tests / checks

Run through CI:

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler

## PR title

feat(platform-v7): add ai gateway mock provider
