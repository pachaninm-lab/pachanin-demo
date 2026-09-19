# Mobile overflow smoke baseline for platform-v7

Status: controlled-pilot / pre-integration.

This layer adds a narrow Playwright smoke baseline for platform-v7 mobile rendering at 390x844. The goal is early visibility of material horizontal overflow on key routes.

## Scope

Allowed files:

- `apps/web/tests/e2e/platform-v7-mobile-overflow-390.spec.ts`
- `docs/platform-v7/qa/mobile-overflow-smoke-baseline.md`

## What the test checks

The smoke test:

- sets viewport to 390x844;
- opens key platform-v7 routes;
- checks successful route response;
- checks body content renders;
- checks document-level horizontal overflow stays within a small tolerance.

## What this layer does not claim

This layer does not prove full mobile UX quality, complete role usability, production readiness or live external integrations. It is only a lightweight mobile overflow signal.

## Guardrails

This layer must not change product code, UI, API routes, runtime logic, DB, adapters, package files, lockfiles or maturity language.

## Next possible layer

After this baseline is green and merged, the next safe layer is either route smoke hardening or a docs-only state advance to the next approved QA/runtime layer.
