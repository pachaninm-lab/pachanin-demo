# Codex current task — Route Smoke Hardening

Current step: Route Smoke Hardening — platform-v7 route availability baseline.
Maturity: controlled-pilot / pre-integration.

## Objective

Harden the existing platform-v7 route smoke test using existing Playwright infrastructure.

This PR must improve route availability visibility only. It must not change product behavior, UI, runtime, API routes, DB, adapters, dependencies, lockfiles or maturity claims.

## Allowed files

- apps/web/tests/e2e/platform-v7-key-routes-smoke.spec.ts
- docs/platform-v7/qa/route-smoke-hardening.md

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

Update the route smoke baseline so it:

- reuses the existing `@playwright/test` setup;
- covers key platform-v7 routes only;
- checks route response success;
- checks body content rendering;
- checks the page does not show fatal crash copy;
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

test(platform-v7): harden route smoke baseline
