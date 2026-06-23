# Review current task — Role cabinet functional pass

Maturity: controlled-pilot / pre-integration.

Review the diff, not the report.

## Required scope checks

- `apps/landing` diff must be 0.
- Package and lockfile diff must be 0.
- Backend, persistence, external connectivity and auth/session/API diff must be 0.
- No fake maturity claims.
- No claim that the platform itself releases money.
- No route/button should point to an unrelated cabinet or dead surface.

## Product checks

Each touched role cabinet must answer in the first screen:

1. what happened;
2. what is blocked;
3. money impact;
4. responsible party;
5. evidence basis;
6. one next action.

## Current allowed scope

Use the exact `allowedCurrentScope` from `docs/platform-v7/autopilot/autopilot-state.json`.

## Merge gate

PASS only if scope is clean, GitHub Actions are green/skipped, Netlify preview is ready/success and PR is mergeable.

Return PASS or BLOCKED. If BLOCKED, include blocker, file, risk and exact fix.
