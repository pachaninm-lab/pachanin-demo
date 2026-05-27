# Codex current task — Mobile Overflow Smoke 390x844 baseline

Current step: Mobile Overflow Smoke — 390x844 baseline.
Maturity: controlled-pilot / pre-integration.

## Objective

Add a narrow Playwright smoke baseline for mobile horizontal overflow at 390x844 using existing e2e infrastructure.

This PR must improve mobile route visibility only. It must not change product behavior, UI, runtime, API routes, DB, adapters, dependencies, lockfiles or maturity claims.

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

## Implement

Create a mobile overflow smoke test that:

- uses existing `@playwright/test` setup;
- sets viewport to 390x844;
- covers key platform-v7 routes only;
- checks route response success and body rendering;
- checks that document horizontal overflow does not exceed viewport by more than a small tolerance;
- does not require live external credentials;
- does not add screenshots, snapshots or generated artifacts.

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler
- Dependency Review
- Qodana platform-v7 report
- CodeQL platform-v7 report

## PR title

test(platform-v7): add mobile overflow smoke baseline
