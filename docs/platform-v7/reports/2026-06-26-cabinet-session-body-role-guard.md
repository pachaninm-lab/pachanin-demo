# platform-v7 cabinet session body-role guard

Date: 2026-06-26
Branch: `fix/p7-cabinet-session-body-role-guard`
Issue: #2100

## What was checked

- `apps/web/app/api/platform-v7/cabinet-session/route.ts`
- `apps/web/lib/platform-v7/verified-session.ts`
- current main base commit: `9dce37a6e571c54216218c82fa24814b0459affe`

## What was found

Before this layer, `/api/platform-v7/cabinet-session` accepted `body.role`, validated it against a fixed role allowlist and signed the `pc_v7_cabinet` cookie. This made the route useful for controlled-pilot UI flow, but it also meant the request body was an unconditional role source.

## What changed

- Added verified backend token preference through `readVerifiedCabinetRole`.
- Added explicit environment boundaries for direct body-role issuance:
  - `PLATFORM_V7_ALLOW_BODY_ROLE_CABINET_SESSION`
  - `PLATFORM_V7_CONTROLLED_PILOT_BODY_ROLE_SESSION`
  - `PLATFORM_V7_PRODUCTION_LIKE`
  - `PLATFORM_V7_CABINET_SESSION_MODE=production-like`
- In production-like mode, direct body-role issuance is rejected unless a verified backend role exists.
- Added static unit coverage for the route boundary.

## Files touched

- `apps/web/app/api/platform-v7/cabinet-session/route.ts`
- `apps/web/tests/unit/platformV7CabinetSessionRoute.static.test.ts`

## Checks

No local test runner was available in this connector session. The PR must run GitHub Actions before merge.

## Not closed

- Full backend login is still not wired to the web login page.
- Backend users/refresh sessions are still in-memory in the current auth service.
- Server cabinet RBAC is still report-only until the follow-up enforce PR.

## Regression risk

Medium. Production-like deployments that still rely on direct `body.role` must explicitly set a controlled-pilot flag or wire verified backend auth first.

## Maturity

No maturity uplift. Current status remains controlled-pilot / pre-integration.
