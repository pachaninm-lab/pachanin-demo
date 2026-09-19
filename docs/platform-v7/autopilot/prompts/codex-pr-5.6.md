# Codex task — PR 5.6 Runtime Integration Tests

Current step: PR 5.6 — Runtime Integration Tests.
Maturity: controlled-pilot / pre-integration.
Human review and green checks are required before merge.

## Objective

Add a narrow runtime integration test layer for platform-v7 Stage 5. The goal is to prove that the already-merged DTO schemas, application services, mock persistence adapter and server action wrappers work together as one deterministic controlled-pilot runtime path.

This step is tests-only. Do not change runtime implementation, DTO schemas, application services, mock adapter, UI, adapters, AI gateway, API routes, theme, onboarding, DB/migrations or package files.

## Allowed files

- apps/web/tests/unit/platformV7RuntimeIntegration.test.ts

## Required coverage

Create focused integration tests that use public/current runtime APIs and prove the full chain:

- DTO -> server action wrapper -> application service -> mock persistence adapter -> audit/idempotency result.
- Money release request persists through the runtime path and writes audit/idempotency state once.
- Duplicate idempotency replay does not mutate money/audit twice.
- Document Matrix action can unblock or update a document through the same runtime path.
- Bank basis send path persists bank-basis state but does not call live bank/external systems.
- Release workflow path keeps bank confirmation as the basis for money release.
- Dispute settlement path keeps money impact read-only unless service contract explicitly allows mutation.
- Malformed read-only runtime DTO returns deterministic validation_error before store access.
- Expected-version/persistence conflict returns deterministic conflict/persistence error shape.
- Result envelopes remain JSON-serializable.

## Guardrails

- No apps/landing changes.
- No UI/component changes.
- No runtime implementation changes.
- No adapter or external gateway changes.
- No fake maturity or external-connection claims.
- Keep wording at controlled-pilot / pre-integration.
- Do not create live bank, FGIS, EDO or payment calls.
- Do not alter package-lock or dependency files.

## Checks

Run:

- pnpm --filter @pc/web exec vitest run tests/unit/platformV7RuntimeIntegration.test.ts
- pnpm typecheck
- pnpm test
- bash scripts/p7-autopilot-guard.sh

## PR title

test(platform-v7): cover runtime integration path
