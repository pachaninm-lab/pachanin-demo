# CodeQL report-mode baseline for platform-v7

Status: controlled-pilot / pre-integration.

This document defines the first GitHub-native CodeQL layer for platform-v7. The goal is security visibility only. This layer must not change product behavior, UI, API routes, runtime logic, database shape, adapters, lockfiles or maturity claims.

## Scope

The first CodeQL PR adds only:

- `.github/workflows/codeql-platform-v7-report.yml`
- `docs/platform-v7/qa/codeql-report-mode.md`

## Report-mode rule

The first CodeQL workflow is informational only:

- no hard gate;
- no auto-fix;
- no dependency changes;
- no generated code changes;
- no live integration credentials;
- no branch protection requirement;
- no maturity upgrade.

CodeQL findings are treated as a report until reviewed and grouped by risk.

## Workflow behavior

The workflow:

- runs on `pull_request` and `workflow_dispatch`;
- uses GitHub-native CodeQL actions;
- analyzes JavaScript / TypeScript only;
- uses `build-mode: none` for this first baseline;
- keeps `continue-on-error: true` for the first report-mode layer;
- uses read-only repository permissions plus `security-events: write` for SARIF upload if repository policy allows it.

## Triage order

Findings must be grouped before any future enforcement:

1. Security / secrets / unsafe dependency usage.
2. Runtime correctness risks.
3. Role boundary / access-control risks.
4. Money, document, bank-basis or evidence-chain risks.
5. Mobile / accessibility / UX risks.
6. Maintainability and dead-code findings.
7. Style-only findings.

## Merge rule

Merge only if:

- changed files stay inside the allowed CI/docs scope;
- `apps/landing` diff is zero;
- platform product code is untouched;
- the workflow is report-only;
- CodeQL is not required as a blocking check;
- maturity remains controlled-pilot / pre-integration.

## Completion rule

This layer is complete only after the workflow file is present, checks are green, scope is clean and the PR is merged.
