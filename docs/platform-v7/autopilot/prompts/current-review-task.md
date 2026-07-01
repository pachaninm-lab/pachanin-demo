# Review current task — P0 scenario runner

Maturity: controlled-pilot / pre-integration.

Review the diff, not the report.

## Scope checks

- `apps/landing` diff must be 0.
- App route diff must be 0.
- Backend and API diff must be 0.
- Package and lockfile diff must be 0.
- Changed files must stay inside `allowedCurrentScope`.
- Readiness must remain 72%.

## Product checks

The PR must compose existing execution-simulation primitives into one deterministic scenario runner and one unit test.

Expected result:

- happy path reaches `CLOSED`;
- audit and timeline counts are returned;
- blocked path checks are returned;
- no maturity uplift.

## Merge gate

PASS only if scope is clean, checks are green or skipped, Netlify preview is ready or success, and PR is mergeable.

Return PASS or BLOCKED with exact fix.
