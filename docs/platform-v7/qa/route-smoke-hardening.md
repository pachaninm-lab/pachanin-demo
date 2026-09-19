# Route smoke hardening for platform-v7

Status: controlled-pilot / pre-integration.

This layer tightens the existing platform-v7 key route smoke test. The goal is early detection of route-level rendering failures without changing product behavior.

## Scope

Allowed files:

- `apps/web/tests/e2e/platform-v7-key-routes-smoke.spec.ts`
- `docs/platform-v7/qa/route-smoke-hardening.md`

## Checks

The route smoke baseline checks that key platform-v7 routes:

- return a response;
- return a successful response;
- render body content;
- do not show fatal crash copy;
- keep an attached html root.

## Guardrails

This layer must not change product code, UI, API routes, runtime logic, DB, adapters, package files, lockfiles or maturity language.
