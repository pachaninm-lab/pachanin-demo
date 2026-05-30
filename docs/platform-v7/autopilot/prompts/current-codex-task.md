# Current task

Current step: Deal Identity Smoke.
Maturity: controlled-pilot / pre-integration.

## Goal

Add one narrow QA smoke test and one short QA note for deal identity visibility.

## Allowed files

- apps/web/tests/e2e/platform-v7-deal-identity-smoke.spec.ts
- docs/platform-v7/qa/deal-identity-smoke.md

## Do not change

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7
- apps/web/app/api
- package.json
- package-lock.json
- pnpm-lock.yaml

## Requirements

- add a small Playwright smoke test file;
- add a small QA documentation file;
- do not change product code;
- do not add dependencies;
- readiness remains 72.

## Test intent

Use existing platform-v7 route patterns from current e2e tests. Check that a deal-facing page renders stable deal identity text.

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler
- Dependency Review
- Qodana platform-v7 report
- CodeQL platform-v7 report
