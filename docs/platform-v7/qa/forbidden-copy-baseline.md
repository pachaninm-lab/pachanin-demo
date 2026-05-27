# Forbidden copy baseline for platform-v7

Status: controlled-pilot / pre-integration.

This layer expands platform-v7 user-facing copy safety checks. The goal is to prevent fake-live claims, inflated maturity, payment guarantees and unsafe wording from becoming visible in the app.

## Scope

Allowed files:

- `apps/web/tests/e2e/forbidden-copy.spec.ts`
- `docs/platform-v7/qa/forbidden-copy-baseline.md`

## What the test protects

The forbidden-copy test scans key platform-v7 routes and fails if user-visible text contains phrases that imply:

- production readiness;
- live bank integration;
- live FGIS / EDO / EPD integration;
- guaranteed payment;
- direct money release by the platform;
- binding AI decisions;
- no-risk or fully completed product state.

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

## Rule

The platform may describe controlled-pilot and pre-integration state honestly. It must not present external integrations, bank release, AI decisions or payment guarantees as live unless contracts, credentials, live access and real production evidence exist.

## Next possible layer

After this baseline is green and merged, the next safe layer is a dedicated mobile overflow smoke layer at 390x844 using existing Playwright infrastructure.
