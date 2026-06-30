# Review current task — P0 market-entry page boundary selection

Maturity: controlled-pilot / pre-integration.

Review the diff, not the report.

## Required scope checks

- `apps/landing` diff must be 0.
- Package and lockfile diff must be 0.
- App implementation diff must be 0 in this docs PR.
- Backend, persistence, external connectivity and auth/session/API diff must be 0.
- No fake maturity claims.
- No claim that the platform itself releases money.
- Readiness must remain 72%.

## Product checks

This PR does not implement market-entry UI. It only selects the next route-only layer.

The next candidate may allow only:

- `apps/web/app/platform-v7/market-entry/page.tsx`

The critical `apps/web/app/platform-v7` forbidden zone must remain present in `forbiddenZones`; exact future route allowance belongs in `marketEntryPageScopeSelection.nextAllowedScope`.

## Current allowed scope

Use the exact `allowedCurrentScope` from `docs/platform-v7/autopilot/autopilot-state.json`.

## Merge gate

PASS only if scope is clean, GitHub Actions are green/skipped, Netlify preview is ready/success and PR is mergeable.

Return PASS or BLOCKED. If BLOCKED, include blocker, file, risk and exact fix.
