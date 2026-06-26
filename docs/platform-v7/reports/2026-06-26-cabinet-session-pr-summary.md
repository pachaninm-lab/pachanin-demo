# Cabinet session PR summary

## Summary

This branch hardens `/api/platform-v7/cabinet-session` so `body.role` is no longer an unconditional trusted source for cabinet role issuance.

## Scope

Code:
- `apps/web/app/api/platform-v7/cabinet-session/route.ts`
- `apps/web/tests/unit/platformV7CabinetSessionRoute.static.test.ts`

Docs:
- reports, queue and auth-session status notes under `docs/platform-v7`.

## Out of scope

- no web login rewrite;
- no backend auth persistence rewrite;
- no server RBAC enforce mode;
- no apps/landing;
- no package or lockfile changes;
- no live integration claims.

## Required before merge

- GitHub Actions green;
- confirm deployed environment has explicit controlled-pilot flag if it still relies on direct body-role flow;
- do not uplift readiness above 72% from this PR alone.
