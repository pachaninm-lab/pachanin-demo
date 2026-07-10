# Codex current task — Durable PostgreSQL Outbox Workers, Bank Reconciliation and Partner-Key Rotation

Maturity: industrial architecture and isolated PostgreSQL proof; platform temporarily without external integrations.
Implementation PR: #2307 (`p0/durable-outbox-financial-delivery`).
Do not create a parallel outbox branch or PR while #2307 is open.
Do not claim production deployment, live bank movement, provider DR acceptance or production scale.
Do not change `apps/landing`, platform UI, design/theme/onboarding, package files or lockfiles.
Do not auto-merge. Exact-head green checks and review are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

Durable PostgreSQL Outbox Workers, Bank Reconciliation and Partner-Key Rotation.

## Baseline

Persistent identity/MFA, server-derived 12-role execution, separate PostgreSQL runtime principals, isolated backup/restore and distributed rate limiting are merged and green through #2305.

## Allowed current scope

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

## Required implementation

- Continue only inside PR #2307; do not create a second implementation.
- PostgreSQL is the only outbox source of truth; remove production process-memory/file authority.
- Enqueue Deal/payment/audit/outbox atomically in the trusted transaction.
- Claim batches with bounded leases and `FOR UPDATE SKIP LOCKED`.
- Use PENDING/PROCESSING/RETRY/SENT-or-CONFIRMED/DEAD transitions with DB-time retry scheduling.
- Treat Kafka `send=false` and exceptions as failures; never falsely confirm delivery.
- Recover expired leases after crash and preserve stable idempotency keys.
- Persist reconciliation cursor/checkpoint and immutable mismatch evidence.
- Never reserve or release money from reconciliation mismatch.
- Support callback key versioning, validity windows, overlap and immediate revocation.
- Reject unknown, expired, future and revoked keys fail-closed.
- Require an explicit production worker mode and avoid simultaneous API + dedicated relay ownership.
- Preserve the canonical Deal, persistent-auth, RLS, rate-limit and DR gates.

## Acceptance

- Two workers process each claimed row once per lease cycle without double confirmation.
- Crash after claim is recoverable; transport failure remains RETRY/DEAD, never SENT.
- Restart preserves pending/retry/dead state.
- Concurrent duplicate enqueue creates one durable record.
- Reconciliation and key-rotation negative cases are proven.
- Forward migrations/drift, API typecheck/tests/build, persistent auth, 12-role/19-command RLS, backup/restore and security gates are green on the exact PR #2307 head.

## Forbidden claims

- exactly-once delivery to external systems;
- live bank, ФГИС, ЭДО or ЕСИА integration;
- production migration applied;
- production RTO/RPO or scale proven.

## Implementation brief

Continue PR #2307 strictly inside the allowed scope. Prefer one canonical PostgreSQL path, explicit failure states, idempotency and auditable evidence over compatibility with obsolete in-memory paths.
