# Codex current task — CI Speed #1436 GitHub Actions speed baseline

Current step: CI Speed #1436 — GitHub Actions speed baseline.
Maturity: controlled-pilot / pre-integration.

## Objective

Improve GitHub Actions speed and stability without changing product behavior.

This PR must improve CI execution only. It must not change product behavior, UI, runtime, API routes, DB, adapters, lockfiles or maturity claims.

## Allowed files

- .github/workflows/ci.yml
- .github/workflows/node-ci.yml
- .github/workflows/platform-v7-autopilot-guard.yml
- .github/workflows/qodana-platform-v7-report.yml
- .github/workflows/codeql-platform-v7-report.yml
- docs/platform-v7/qa/ci-speed-baseline.md

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

Add a safe CI speed/stability baseline.

Requirements:
- add `concurrency` / `cancel-in-progress` where safe;
- add explicit job timeouts where missing;
- use pnpm cache through setup-node where already compatible;
- do not introduce new required dependencies;
- do not change scripts, tests or product files;
- keep Qodana and CodeQL informational/report-only;
- document the CI speed baseline and future triage.

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

ci(platform-v7): add actions speed baseline
