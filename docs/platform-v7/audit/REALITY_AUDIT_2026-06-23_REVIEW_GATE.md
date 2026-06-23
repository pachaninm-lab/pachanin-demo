# platform-v7 reality audit review gate — 2026-06-23

Use this gate for PRs derived from `REALITY_AUDIT_2026-06-23.md`.

## Hard fail conditions

Fail the PR if any item is true:

- `apps/landing` changed.
- Backend, DB, auth, session, API, package or lockfile changed inside a UI PR.
- More than one role cabinet changed in a single role pass.
- UI PR introduces runtime, persistence, money movement, bank confirmation, external callback or live-readiness claims.
- CTA is clickable but has no real route/action/section.
- Disabled CTA lacks a clear blocked reason.
- Mobile shell/header/bottom nav is removed or destabilized.
- Role-specific cabinet exposes another role's operational actions.

## Pass conditions

Pass only when:

- changed files match the stated issue and PR type;
- status language remains controlled-pilot / pre-integration;
- each first-screen block answers event, blocker, money at risk, responsible party, next action;
- Netlify is green or not relevant;
- GitHub Actions are green or intentionally skipped;
- the PR is mergeable.

## Review result format

```text
DECISION: PASS | REQUEST CHANGES
RISK: low | medium | high
SCOPE: clean | dirty
FORBIDDEN ZONES: clear | violated
STATUS TRUTH: clear | violated
CTA GATE: pass | fail
MOBILE/SHELL: pass | fail
ROLE ISOLATION: pass | fail
NEXT ACTION: merge | exact fixes | split PR
```
