# Codex current task — PR 5.2 Server Action Wrappers

Current step: PR 5.2 — Server Action Wrappers.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- apps/web/lib/platform-v7/runtime/application-service.ts
- apps/web/lib/platform-v7/runtime/application-service-types.ts
- apps/web/lib/platform-v7/runtime/mock-persistence-adapter.ts
- apps/web/lib/platform-v7/runtime/dto-schemas.ts
- apps/web/lib/platform-v7/runtime/persistence-ports.ts

## Objective

Create narrow server action wrappers for the platform-v7 runtime application services. The wrappers must expose typed action entrypoints for controlled-pilot runtime execution while keeping all business mutations inside DTO validation, application services, persistence ports, action boundary, idempotency and audit paths.

This PR must not introduce UI changes or live integrations. It only creates the server-side wrapper layer that later UI and integration steps can call.

## Allowed files

- apps/web/app/platform-v7/actions/runtime-actions.ts
- apps/web/tests/unit/platformV7RuntimeServerActions.test.ts

## Forbidden zones

- apps/landing
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7/adapters
- apps/web/lib/platform-v7/ai
- apps/web/app/api
- package-lock.json
- UI routes/components other than the allowed server action file
- DTO schemas
- persistence ports
- application service files
- mock persistence adapter
- theme
- onboarding

## Implement

Create `apps/web/app/platform-v7/actions/runtime-actions.ts` with server action wrappers around existing PR 5.1 application services and PR 5.5 mock persistence adapter.

Required wrapper responsibilities:

- import `server-only` or use a server-safe module boundary if already used in the repo
- instantiate an explicit controlled-pilot mock runtime store per action call or via an injected test factory; do not create hidden global runtime state
- validate DTOs through existing DTO/schema layer where available
- call application service factories/methods instead of direct domain mutations
- return typed serializable action results
- include deterministic error shape for validation, authorization/denied, duplicate/idempotency, persistence conflict and unknown errors
- do not call bank, FGIS, EDO or any live external service
- do not claim live integration status
- do not update React/UI state directly
- do not bypass action-boundary, idempotency or audit

Expected exported actions should cover the current runtime service surface, at minimum:

- money action wrapper
- document action wrapper
- bank basis action wrapper
- release workflow wrapper
- dispute settlement wrapper

Use names that fit existing runtime service naming. Keep implementation small and reviewable.

## Tests

Create `apps/web/tests/unit/platformV7RuntimeServerActions.test.ts`.

Cover:

- wrappers return serializable results
- wrappers use application services rather than direct domain mutations where testable
- validation/invalid DTO path returns deterministic error
- successful money action goes through persistence and audit
- duplicate idempotency result is replayed
- expectedVersion conflict returns deterministic conflict error
- document action wrapper persists Document Matrix changes
- bank basis wrapper persists basis decision but does not call a live bank
- release workflow wrapper does not claim platform releases money itself
- dispute settlement wrapper does not move money directly unless service contract explicitly allows it
- no module-level hidden runtime store
- no apps/landing or UI imports

## Checks

Run:

- node scripts/p7-autopilot-dispatcher.mjs
- bash scripts/p7-autopilot-guard.sh
- pnpm typecheck
- pnpm test

## PR title

feat(platform-v7): add runtime server action wrappers
