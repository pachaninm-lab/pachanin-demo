# Qodana report-mode baseline for platform-v7

Status: controlled-pilot / pre-integration.

This document defines the first Qodana layer for platform-v7. The goal is quality visibility only. This PR must not change product behavior, UI, API routes, runtime logic, database shape, adapters, lockfiles or maturity claims.

## Scope

The first Qodana PR may add only:

- `.github/workflows/qodana-platform-v7-report.yml`
- `qodana.yaml`
- `docs/platform-v7/qa/qodana-report-mode.md`

## Report-mode rule

The first Qodana workflow is intentionally non-blocking:

- no hard gate;
- no auto-fix;
- no dependency changes;
- no generated code changes;
- no live integration credentials;
- no upload to external project accounts;
- no branch protection requirement.

Qodana findings are treated as a report until they are reviewed and grouped by risk.

## Triage order

Findings must be grouped before any future enforcement:

1. Security / secrets / unsafe dependency usage.
2. Runtime correctness risks.
3. Role boundary / access-control risks.
4. Money, document, bank-basis or evidence-chain risks.
5. Mobile / accessibility / UX risks.
6. Maintainability and dead-code findings.
7. Style-only findings.

## Merge rule for this layer

Merge only if:

- changed files stay inside the allowed CI/docs scope;
- `apps/landing` diff is zero;
- platform product code is untouched;
- the workflow is report-only;
- Qodana is not required as a blocking check;
- maturity remains controlled-pilot / pre-integration.

## Future hard gate

A future hard gate is allowed only after:

- first report-mode run is collected;
- findings are triaged;
- false positives are documented;
- baseline strategy is approved;
- the team explicitly decides which severities block merge.
