# Review current task — PR 5.2 Server Action Wrappers

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report.
Human review and green checks are required before merge.

## Required scope checks

Allowed files only:

- apps/web/app/platform-v7/actions/runtime-actions.ts
- apps/web/tests/unit/platformV7RuntimeServerActions.test.ts

Reject if the PR changes:

- apps/landing
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7/adapters
- apps/web/lib/platform-v7/ai
- apps/web/app/api
- package-lock.json
- DTO schemas
- persistence ports
- application service files
- mock persistence adapter
- theme
- onboarding

## Architecture checks

Confirm:

- wrappers call runtime application services, not direct domain mutation functions
- DTO validation is used before service execution where available
- runtime store is explicit and not hidden module-level global state
- wrappers return typed serializable results
- idempotency and audit paths are preserved
- expectedVersion conflict is surfaced deterministically
- duplicate idempotency replay is surfaced deterministically
- bank basis wrapper does not call live bank services
- release workflow wrapper does not claim the platform releases money itself
- dispute settlement wrapper does not directly move money outside the service contract
- no UI imports or React/client component state
- no apps/landing imports

## Tests required

- wrapper result is serializable
- invalid DTO path returns deterministic validation error
- successful money action goes through persistence and audit
- duplicate idempotency result replay works
- expectedVersion conflict returns deterministic conflict error
- document action persists Document Matrix changes
- bank basis action persists basis decision without live bank call
- release workflow action does not claim platform releases money itself
- dispute settlement action does not bypass service/action boundary
- source scan: no module-level hidden runtime store
- source scan: no apps/landing or UI imports

## Required output

Return:

BLOCKERS
- ...

REQUIRED FIXES
- ...

OPTIONAL IMPROVEMENTS
- ...

MERGEABLE: yes/no
