# Review current task — Durable PostgreSQL Outbox Workers, Bank Reconciliation and Partner-Key Rotation

Maturity: industrial architecture and isolated PostgreSQL proof; platform temporarily without external integrations.
Do not accept production, live-bank, provider-DR or production-scale claims.
Review the diff and tests, not the agent report. Return PASS or BLOCKED with the exact file, risk and required fix.

## Required scope checks

- `apps/landing` diff is zero.
- Platform UI, role cabinets, design/theme/onboarding diff is zero, except the explicitly isolated concurrent scopes below.
- Package and lockfile diff is zero.
- Changes remain inside the state `allowedCurrentScope` or an explicitly source-controlled concurrent scope.
- No in-memory/file production fallback, fake-live adapter or auto-merge behavior is introduced.

## Current allowed scope

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/**
- apps/api/src/common/outbox/**
- apps/api/src/common/kafka/**
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/modules/settlement-engine/**
- apps/api/src/modules/deals/industrial-deal-command.gateway.ts
- apps/api/src/modules/deals/deal-command.service.ts
- apps/api/test/outbox/**
- apps/api/test/one-deal/**
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

## Approved concurrent scope — Owner Access Center PR #2383

This scope is isolated to the privileged staff surface and does not modify deal, money, bank, ledger, participant RBAC or external-integration authority.

- apps/web/app/platform-v7/staff/**
- apps/web/components/platform-v7/staff/**
- apps/web/i18n/owner-access-center-messages.ts
- apps/web/lib/platform-v7/staff-access-task-catalog.ts
- apps/web/tests/unit/platformV7OwnerAccessCenterTaskUx.test.ts
- apps/web/tests/unit/platformV7StaffControlCenterInitialRender.test.ts
- scripts/p7-autopilot-guard.sh
- docs/platform-v7/autopilot/prompts/current-review-task.md

Review requirements for this concurrent scope:

- API remains authoritative for assignment, role ceiling, mode, scope, MFA, duration and approval.
- No role or permission is derived from URL, local storage or client-controlled identity.
- Technical permission names are not the primary user workflow.
- Break-glass has an isolated incident form and remains limited to 15 minutes.
- Protected operational workspaces render only while a verified protected session is active.
- RU/EN/ZH dictionaries remain structurally identical.
- Mobile layouts cover 320, 375, 390 and 430 px without horizontal overflow.
- No forbidden bank, signature, laboratory, acceptance or arbitration authority is added.

## Approved concurrent scope — Public login human copy PR #2398

This scope is isolated to wording and its regression contract on the existing server-authoritative login surface. It does not change layout, authentication, MFA, session, RBAC, tenant resolution, redirect authority, deal execution, money or external integrations.

- apps/web/i18n/public-login-copy.ts
- apps/web/tests/unit/productEntryM31.test.tsx
- docs/platform-v7/autopilot/prompts/current-review-task.md

Review requirements for this concurrent scope:

- The form structure and server-authoritative authentication boundary remain unchanged.
- RU/EN/ZH remain complete and semantically aligned.
- Copy is direct, familiar and task-oriented; no security or production claims are added.
- The regression test preserves MFA, server redirect and the ban on client-selected roles.
- `platform-v7 autopilot guard`, web unit tests, typecheck and build pass on the exact PR head.

## Mandatory architectural review

- PostgreSQL, not process memory or NDJSON, is authoritative for outbox state.
- Enqueue is in the same trusted transaction as Deal/payment/audit changes.
- Multi-worker claims use bounded leases and `FOR UPDATE SKIP LOCKED`.
- `send=false` and transport exceptions cannot create SENT/CONFIRMED.
- Expired claims recover after crash without losing the event.
- Idempotency is enforced by a unique durable key.
- Retry/backoff/dead-letter/manual-retry transitions are durable and audited.
- Production has one explicit relay ownership mode and safe shutdown.
- Reconciliation cursor/checkpoint and mismatch evidence are persisted and immutable.
- Mismatch cannot cause automatic reserve or release.
- Partner callback keys support version, validity interval, overlap and immediate revocation.
- Unknown, expired, not-yet-valid and revoked keys fail closed.
- No secret, raw callback payload or sensitive reconciliation data is logged.

## Mandatory evidence

- Concurrent two-worker claim test.
- Crash/expired-lease recovery test.
- Kafka false/exception negative tests.
- Restart persistence and duplicate-enqueue tests.
- Reconciliation mismatch rollback/hold tests.
- Partner-key overlap, expiry, future and revocation tests.
- Forward-only migrations and zero drift.
- Existing persistent-auth, 12-role/19-command RLS and backup/restore gates remain green.

## Forbidden acceptance

- exactly-once external delivery claim;
- live bank/ФГИС/ЭДО/ЕСИА claim;
- production migration or production DR claim;
- production load/HA claim without measured evidence.

## Review brief

PASS only when the implementation is one durable, fail-closed and auditable PostgreSQL execution path and every acceptance item is demonstrated on the exact PR head. For an approved concurrent scope, PASS only when its authority boundary is unchanged and its listed requirements are demonstrated on the exact PR head.
