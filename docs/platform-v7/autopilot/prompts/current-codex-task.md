# Codex current task — PR 7.2 AI Gateway Provider Port

Current step: PR 7.2 — AI Gateway Provider Port.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-7-ai-gateway-contracts.md

## Objective

Define the AI gateway provider port as a deterministic TypeScript interface after PR 7.1 (AI Gateway Contracts) was committed to main.

This PR must not implement a live AI provider, make external calls, add API routes, touch DB, or touch UI. It only defines the typed port interface, request/response envelope, and a disabled-live-provider default state.

## Allowed files

- apps/web/lib/platform-v7/ai/gateway-provider-port.ts
- apps/web/lib/platform-v7/ai/gateway-envelope.ts
- apps/web/tests/unit/platformV7AiGatewayProviderPort.test.ts
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
- Any live provider runtime, API key usage, or external AI service calls

## Implement

Create `apps/web/lib/platform-v7/ai/gateway-envelope.ts` and define:

- `GatewayMaturity` type alias: `"pre-integration"`.
- `GatewayRole` union type for allowed roles (e.g. `"seller" | "buyer" | "operator" | "bank" | "support"`).
- `GatewayScope` union type for allowed scopes (e.g. `"hint" | "summary" | "blocker_explanation" | "next_action" | "evidence_summary" | "triage"`).
- `GatewayIdempotencyKey` type alias: `string`.
- `GatewayAuditContext` interface: `{ providerId: string; executedAt: string; }`.
- `GatewayRequest` interface with: `requestId: string`, `dealId: string`, `role: GatewayRole`, `scope: GatewayScope`, `maturity: GatewayMaturity`, `idempotencyKey: GatewayIdempotencyKey`, `inputSnapshot: Record<string, unknown>`.
- `GatewayResponse` interface with: `result: string | null`, `confidence: number`, `limitations: string[]`, `auditContext: GatewayAuditContext`.

Create `apps/web/lib/platform-v7/ai/gateway-provider-port.ts` and define:

- `GATEWAY_MATURITY: GatewayMaturity = "pre-integration"` constant.
- `GatewayProviderPort` interface with a single `execute(req: GatewayRequest): Promise<GatewayResponse>` method.
- `DisabledGatewayProvider` class implementing `GatewayProviderPort` that:
  - never throws;
  - returns `{ result: null, confidence: 0, limitations: ["provider not configured — requires credentials and live integration"], auditContext: { providerId: "disabled", executedAt: new Date().toISOString() } }`;
  - has `readonly maturity: GatewayMaturity = "pre-integration"`.

Create `apps/web/tests/unit/platformV7AiGatewayProviderPort.test.ts` and verify:

- `DisabledGatewayProvider.execute()` resolves without throwing.
- `DisabledGatewayProvider.execute()` returns `result: null`.
- `DisabledGatewayProvider.execute()` returns `confidence: 0`.
- `DisabledGatewayProvider.execute()` returns `limitations` array with at least one entry.
- `DisabledGatewayProvider.execute()` returns `auditContext.providerId === "disabled"`.
- `DisabledGatewayProvider.execute()` returns `auditContext.executedAt` as a valid ISO string.
- `GATEWAY_MATURITY === "pre-integration"`.
- `DisabledGatewayProvider.maturity === "pre-integration"`.
- Forbidden claims absent from all module exports (no "production-ready", "fully live", "AI makes binding decisions", "AI gateway is live").

## Tests / checks

Run through CI:

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler

## PR title

feat(platform-v7): add ai gateway provider port
