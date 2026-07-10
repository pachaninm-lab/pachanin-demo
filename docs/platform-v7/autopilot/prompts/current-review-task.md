# Review current task — Durable PostgreSQL Outbox Workers, Bank Reconciliation and Partner-Key Rotation

Maturity: industrial architecture and isolated PostgreSQL proof; platform temporarily without external integrations.
Implementation under review: PR #2307 (`p0/durable-outbox-financial-delivery`).
Do not accept a parallel implementation, production, live-bank, provider-DR or production-scale claims.
Review the diff and tests, not the agent report. Return PASS or BLOCKED with the exact file, risk and required fix.

## Required scope checks

- PR number is #2307 and exact head is recorded before acceptance.
- `apps/landing` diff is zero.
- Platform UI, role cabinets, design/theme/onboarding diff is zero.
- Package and lockfile diff is zero.
- Changes remain inside the state `allowedCurrentScope`.
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

## Mandatory architectural review

- PostgreSQL, not process memory or NDJSON, is authoritative for outbox state.
- Enqueue is in the same trusted transaction as Deal/payment/audit changes.
- Multi-worker claims use bounded leases and `FOR UPDATE SKIP LOCKED`.
- `send=false` and transport exceptions cannot create SENT/CONFIRMED.
- Expired claims recover after crash without losing the event.
- Idempotency is enforced by a unique durable key and payload mismatch fails closed.
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
- Existing persistent-auth, 12-role/19-command RLS, rate-limit and backup/restore gates remain green.

## Forbidden acceptance

- exactly-once external delivery claim;
- live bank/ФГИС/ЭДО/ЕСИА claim;
- production migration or production DR claim;
- production load/HA claim without measured evidence.

## Review brief

PASS only when PR #2307 is one durable, fail-closed and auditable PostgreSQL execution path and every acceptance item is demonstrated on its exact head.
