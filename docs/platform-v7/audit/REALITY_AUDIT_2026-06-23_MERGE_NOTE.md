# platform-v7 audit merge note — 2026-06-23

## Merge condition

Merge when:

- PR exists and is mergeable;
- checks are green or skipped;
- changed files remain under `docs/platform-v7/audit/**`;
- no forbidden zones are touched.

## After merge

Continue with #1976 seller cabinet pass.

## Stop condition

If a seller pass needs shared shell, route, backend, DB, auth, session, API, package or lockfile changes, split or stop that PR and record the exact blocker.
