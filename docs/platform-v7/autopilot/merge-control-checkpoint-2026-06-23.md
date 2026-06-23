# platform-v7 merge control checkpoint

Linked issues: #1974 #1984 #1982 #1981 #1978 #1979

## Gate status

This document is a controller checkpoint. It does not assert live readiness.

## Required checks before merging a platform-v7 PR

1. Changed files are narrow and match the linked issue.
2. `apps/landing/**` is not changed.
3. Backend, DB, auth, session, API, package and lockfiles are not changed inside UI PRs.
4. Current-state copy remains controlled-pilot / pre-integration.
5. Target-readiness language is separated from current status.
6. GitHub Actions are green or intentionally skipped.
7. Netlify relevant deploy status is ready/success.
8. PR is mergeable.
9. #1979 smoke checklist is satisfied for role-cabinet PRs.

## Non-blocking statuses

Deprecated Vercel and Deno external deployment statuses are non-blocking unless branch protection rejects merge.

## Next safe move

If no clean open PR exists, continue with the seller cabinet functional pass under #1976 and keep the PR limited to exact seller cabinet files.