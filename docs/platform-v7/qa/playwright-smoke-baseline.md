# Playwright smoke baseline for platform-v7

Status: controlled-pilot / pre-integration.

This layer adds a narrow Playwright smoke skeleton for key platform-v7 routes. The goal is route availability visibility only, not full UX validation.

## Scope

Allowed files:

- `apps/web/tests/e2e/platform-v7-key-routes-smoke.spec.ts`
- `docs/platform-v7/qa/playwright-smoke-baseline.md`

## What the smoke test checks

The smoke skeleton checks that key platform-v7 routes:

- return a successful response;
- render non-empty body content;
- do not show fatal route crash copy such as 404, application error or unhandled runtime error.

## What this layer does not claim

This layer does not prove:

- live bank integration;
- live FGIS / EDO / EPD integration;
- production readiness;
- complete role UX quality;
- full mobile quality;
- business process completeness.

Those checks stay in later controlled-pilot and integration-specific layers.

## Guardrails

This layer must not change:

- product code;
- UI;
- API routes;
- runtime logic;
- DB;
- adapters;
- package files;
- lockfiles;
- maturity language.

## Next possible layer

After this smoke skeleton is green and merged, the next safe layer is either forbidden-copy / no-fake-live expansion or a dedicated mobile overflow smoke layer at 390x844 using existing Playwright infrastructure.
