# Stage 7 — AI Gateway Contracts

Maturity: controlled-pilot / pre-integration.

This document defines the contracts-only boundary for future AI Gateway work in platform-v7.

## Purpose

The gateway is a future internal assistance boundary for execution support. It may help explain blockers, draft next-step suggestions, summarize evidence packs and review document/checklist readiness.

PR 7.1 does not implement provider runtime, API routes, UI, onboarding, theme, DB persistence, external submissions or live provider calls.

## Allowed future contract capabilities

- Role-aware execution hints.
- Document and checklist review summaries.
- Blocker explanation based on existing platform state.
- Next-action draft text for human review.
- Evidence-pack summarization.
- Support/operator triage notes.

## Required gateway envelope

Future requests and responses must be typed and auditable:

- `requestId`
- `dealId` or object reference
- `role`
- `scope`
- `maturity: "pre-integration"`
- `idempotencyKey`
- `inputSnapshot`
- `result`
- `confidence`
- `limitations`
- `auditContext`

## Hard boundaries

- Human review remains required for material decisions.
- The gateway must not release money.
- The gateway must not submit data to external systems.
- The gateway must not claim live provider access before credentials, contracts and deployment evidence exist.
- The gateway must not bypass RBAC, audit, idempotency or role scope.
- The gateway must not override bank, FGIS, EDO, EPD, lab, elevator or logistics statuses.

## Required provider boundary before PR 7.2+

Before implementation starts, PR 7.2 must define a provider port with:

- deterministic interface shape;
- typed request and response models;
- disabled-live-provider default state;
- explicit timeout/error result;
- idempotency and audit hooks;
- role-scope input filtering;
- maturity-safe copy rules.

## Locked until PR 7.1 green

- PR 7.2 — AI Gateway Provider Port
- PR 7.3 — AI Gateway Mock Provider
- PR 7.4 — AI Gateway Runtime QA
- Product Entry / Onboarding
- Theme / Visual
- Role Cockpit / UX

## Review gates

PR 7.1 is mergeable only if:

- changes are docs-only;
- source-of-truth files agree on `PR 7.1 — AI Gateway Contracts`;
- `PR 6.6 — External Adapter Runtime QA` is listed as completed;
- readiness is 64% and not higher;
- no platform UI, runtime, adapter, API, DB, test or lockfile files are changed;
- maturity remains controlled-pilot / pre-integration.
