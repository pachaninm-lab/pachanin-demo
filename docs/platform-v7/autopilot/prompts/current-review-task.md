# Review current task — Mobile Overflow Smoke 390x844 baseline

Maturity: controlled-pilot / pre-integration.

## Allowed files

- apps/web/tests/e2e/platform-v7-mobile-overflow-390.spec.ts
- docs/platform-v7/qa/mobile-overflow-smoke-baseline.md

## Forbidden zones

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7
- apps/web/app/api
- package.json
- package-lock.json
- pnpm-lock.yaml

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler
- Dependency Review
- Qodana platform-v7 report
- CodeQL platform-v7 report

## Merge rule

Merge only if scope is clean, checks are green, apps/landing diff is 0, maturity remains controlled-pilot / pre-integration, no product code changed, no lockfile changed, no generated artifacts added, and mergeable=true.
