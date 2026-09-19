# Forbidden copy baseline for platform-v7

Status: controlled-pilot / pre-integration.

This layer expands platform-v7 user-facing copy safety checks. The goal is to prevent unsafe maturity and external-system wording from becoming visible in the app.

## Scope

Allowed files:

- `apps/web/tests/e2e/forbidden-copy.spec.ts`
- `docs/platform-v7/qa/forbidden-copy-baseline.md`

## What the test protects

The forbidden-copy test scans key platform-v7 routes and fails if visible text implies:

- maturity beyond controlled-pilot / pre-integration;
- completed external connectivity without proof;
- platform-side payment certainty;
- direct platform-side money release;
- binding automated decisions;
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

The platform may describe controlled-pilot and pre-integration state honestly. It must not present external systems, money movement or automated decisions as final unless contracts, credentials, live access and real production evidence exist.

## Next possible layer

After this baseline is green and merged, the next safe layer is a dedicated mobile overflow smoke layer at 390x844 using existing Playwright infrastructure.
