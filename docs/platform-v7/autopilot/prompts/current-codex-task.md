# Codex current task — Forbidden Copy #1440 no-fake-live test expansion

Current step: Forbidden Copy #1440 — no-fake-live test expansion.
Maturity: controlled-pilot / pre-integration.

## Objective

Expand platform-v7 forbidden-copy / no-fake-live Playwright coverage using the existing e2e test infrastructure.

This PR must improve copy-safety coverage only. It must not change product behavior, UI, runtime, API routes, DB, adapters, dependencies, lockfiles or maturity claims.

## Allowed files

- apps/web/tests/e2e/forbidden-copy.spec.ts
- docs/platform-v7/qa/forbidden-copy-baseline.md

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

Expand the existing forbidden-copy test by adding high-risk fake-live and inflated maturity terms that must never be visible to end users.

Requirements:
- reuse the existing Playwright test file;
- do not add new dependencies;
- do not add generated artifacts;
- keep checks focused on user-visible copy;
- include bank, FGIS, EDO, EPD, payment guarantee and maturity overclaim wording;
- document the forbidden-copy baseline and future triage.

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

test(platform-v7): expand forbidden fake-live copy coverage
