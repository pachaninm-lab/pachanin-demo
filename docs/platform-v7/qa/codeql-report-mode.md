# CodeQL report-mode baseline for platform-v7

Status: controlled-pilot / pre-integration.

This document defines the intended first GitHub-native CodeQL layer for platform-v7. The goal is security visibility only. This layer must not change product behavior, UI, API routes, runtime logic, database shape, adapters, lockfiles or maturity claims.

## Intended scope

The first CodeQL PR may add only:

- `.github/workflows/codeql-platform-v7-report.yml`
- `docs/platform-v7/qa/codeql-report-mode.md`

## Report-mode rule

The first CodeQL workflow must be informational only:

- no hard gate;
- no auto-fix;
- no dependency changes;
- no generated code changes;
- no live integration credentials;
- no branch protection requirement;
- no maturity upgrade.

CodeQL findings are treated as a report until reviewed and grouped by risk.

## Required workflow behavior

The workflow should:

- run on `pull_request` and `workflow_dispatch`;
- use GitHub-native CodeQL actions;
- analyze JavaScript / TypeScript only;
- use `build-mode: none` for this first baseline;
- keep `continue-on-error: true` for the first report-mode layer;
- use read-only repository permissions plus `security-events: write` for SARIF upload if repository policy allows it.

## Triage order

Findings must be grouped before any future enforcement:

1. Security / secrets / unsafe dependency usage.
2. Runtime correctness risks.
3. Role boundary / access-control risks.
4. Money, document, bank-basis or evidence-chain risks.
5. Mobile / accessibility / UX risks.
6. Maintainability and dead-code findings.
7. Style-only findings.

## Merge rule for the implementation layer

Merge only if:

- changed files stay inside the allowed CI/docs scope;
- `apps/landing` diff is zero;
- platform product code is untouched;
- the workflow is report-only;
- CodeQL is not required as a blocking check;
- maturity remains controlled-pilot / pre-integration.

## Current blocker

Creating `.github/workflows/codeql-platform-v7-report.yml` may require workflow-write permission or a manual GitHub UI step depending on connector safety policy. If workflow file creation is blocked, do not mark CodeQL as complete. Keep the step open until the workflow file is added and checks pass.
