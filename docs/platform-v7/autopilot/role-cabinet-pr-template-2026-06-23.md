# role cabinet PR template

Linked issues: #1974 #1984 #1981 #1978 #1979

## PR type

UI / role cabinet

## Exact role

`<seller | buyer | bank | operator | executive | compliance | lab | elevator | field>`

## Allowed files

List exact files before implementation. Do not broaden scope after the PR starts.

## Acceptance

- First screen answers what happened.
- First screen answers what is blocked.
- First screen shows money at risk.
- First screen shows responsible party.
- First screen gives one next action.
- CTAs are real routes/actions/sections or disabled with reason.
- Shell/header/bottom navigation remain stable.
- Mobile 390x844 has no horizontal overflow.
- No role-switch leakage.
- Current status remains controlled-pilot / pre-integration.

## Forbidden

- `apps/landing/**`
- Backend, DB, auth, session, API, package or lockfile changes.
- Unsupported live-readiness claims.
- Broad platform-v7 rewrites.

## QA

Use #1979 after implementation. Use #1978 before merge.