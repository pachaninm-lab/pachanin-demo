# platform-v7 auth/session next queue

Date: 2026-06-26

## Current code PR

`fix/p7-cabinet-session-body-role-guard`

Scope:
- cabinet-session must prefer verified backend role;
- direct body-role issuance is limited to explicit controlled-pilot/demo/dev-test boundary;
- no backend auth rewrite;
- no login UI rewrite;
- no apps/landing;
- no lockfiles.

## Next safe PRs

1. Backend register role hardening: do not accept privileged role directly from register DTO in production-like mode.
2. Backend auth secret hardening: no JWT secret fallback in production-like mode.
3. Durable session/revoke model: refresh token DB storage and revoked session checks.
4. Server cabinet RBAC enforce mode after verified session boundary is stable.
5. Object scope audit: deal passport/timeline first.

## Readiness

No maturity uplift. Readiness remains 72% until runtime/security layers are merged and verified.
