# Codex current task — Playwright Smoke #1438 platform-v7 key route smoke skeleton

Current step: Playwright Smoke #1438 — platform-v7 key route smoke skeleton.
Maturity: controlled-pilot / pre-integration.

## Objective

Add a narrow Playwright smoke skeleton for key platform-v7 routes using existing Playwright infrastructure.

This PR must improve route-level smoke visibility only. It must not change product behavior, UI, runtime, API routes, DB, adapters, dependencies, lockfiles or maturity claims.

## Allowed files

- apps/web/tests/e2e/platform-v7-key-routes-smoke.spec.ts
- docs/platform-v7/qa/playwright-smoke-baseline.md

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

Create a route smoke skeleton that:

- uses existing `@playwright/test` setup;
- covers only key platform-v7 routes;
- checks HTTP/page availability and absence of fatal crash copy;
- does not require live external credentials;
- does not assert fake live integration states;
- does not add screenshots, snapshots or generated artifacts;
- stays tolerant enough for report/smoke mode, not full UX validation.

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

test(platform-v7): add key route smoke skeleton
