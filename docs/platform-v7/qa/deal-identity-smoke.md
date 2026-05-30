# Deal Identity Smoke

Status: controlled-pilot / pre-integration.

## Purpose

This smoke layer checks that key platform-v7 deal routes render stable deal identity and do not show fatal route errors.

## Covered routes

- `/platform-v7/deals/DL-9102/clean`
- `/platform-v7/deals/DL-9106/audit`
- `/platform-v7/deals/DL-9106/money`

## Guardrails

This layer is limited to QA coverage only:

- no product code changes;
- no apps/landing changes;
- no API, DB, runtime or adapter changes;
- no dependency or lockfile changes;
- no maturity increase.

## Acceptance criteria

The layer is acceptable when:

- each route returns a successful response;
- body content is visible;
- fatal render copy is absent;
- stable deal identity copy is visible.

## Why this matters

Deal identity consistency is a safe early proof point for the generated-code loop. It checks a user-visible execution surface without altering runtime, roles, money logic, documents, adapters or UI components.
