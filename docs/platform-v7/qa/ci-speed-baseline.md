# CI speed baseline for platform-v7

Status: controlled-pilot / pre-integration.

This document defines a narrow GitHub Actions speed and stability baseline for platform-v7. The goal is faster feedback and fewer wasted runner minutes without changing product behavior.

## Scope

This layer may change only workflow configuration and documentation.

Allowed files for the first CI speed baseline:

- `.github/workflows/ci.yml`
- `.github/workflows/node-ci.yml`
- `.github/workflows/platform-v7-autopilot-guard.yml`
- `docs/platform-v7/qa/ci-speed-baseline.md`

Qodana and CodeQL are already report-mode and may be optimized later only if tool safety and repository policy allow it.

## Changes

The baseline may add:

- workflow-level `concurrency` with `cancel-in-progress: true`;
- explicit job timeouts where missing;
- pnpm cache through `actions/setup-node` where compatible;
- `cache-dependency-path: pnpm-lock.yaml` where cache is enabled.

## Hard limits

This layer must not change:

- product code;
- UI;
- API routes;
- database or runtime logic;
- adapters;
- package files;
- lockfiles;
- maturity language;
- branch protection or required-check policy.

## Merge rule

Merge only if:

- changed files stay inside the allowed workflow/docs scope;
- `apps/landing` diff is zero;
- product code diff is zero;
- lockfile diff is zero;
- all required checks are green;
- maturity remains controlled-pilot / pre-integration.

## Next possible layer

After this baseline is merged and stable, the next safe layer is Playwright smoke skeleton in report/smoke mode for platform-v7 key routes, without changing app behavior.
