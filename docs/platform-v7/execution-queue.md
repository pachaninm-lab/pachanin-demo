# platform-v7 execution queue

CURRENT: Durable PostgreSQL Outbox Workers, Bank Reconciliation and Partner-Key Rotation.

GOAL:
Make PostgreSQL the only source of truth for critical delivery, coordinate multiple workers safely, reconcile bank operations against immutable evidence and support overlapping partner-key rotation without weakening the canonical Deal transaction.

BASELINE PROVEN:
- #2270 and #2274 prove the canonical 12-role / 19-command Deal lifecycle, concurrency, replay, restart, rollback and RLS pool isolation on PostgreSQL 16;
- #2276, #2280, #2282 and #2283 prove persistent identity, MFA, one-time backup codes and server-derived authority;
- #2287 proves separate restricted deal and auth PostgreSQL principals;
- #2291 proves forward-only backup and isolated restore rehearsal;
- merge baseline is `7c499ede59fc416cbf546d58dc7950b49dc1a77f`.

CURRENT ALLOWED:
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

CURRENT CRITERIA:
- PostgreSQL is the only authoritative outbox state; no process-memory or file fallback is allowed in production;
- Deal/payment/audit/outbox writes commit in one trusted transaction;
- multiple workers claim bounded batches through database leases and `FOR UPDATE SKIP LOCKED`;
- transport failure or `send=false` never produces SENT/CONFIRMED;
- expired leases recover safely after worker crash;
- retry, backoff, dead-letter and audited manual retry state are durable;
- delivery semantics are explicitly at-least-once with stable downstream idempotency keys;
- bank reconciliation persists its cursor/checkpoint and records immutable mismatch evidence;
- reconciliation mismatch cannot reserve or release money automatically;
- partner callback keys have version, validity interval, overlap and immediate revocation;
- unknown, expired, not-yet-valid and revoked keys fail closed;
- one-deal, persistent-auth, RLS, backup and restore gates remain green;
- production bank, Kafka HA, external integrations and production scale remain unclaimed.

LOCKED:
- all platform UI and role-cabinet migration;
- apps/landing;
- package and lockfiles;
- live ESIA, bank, ФГИС, ЭДО and signature activation;
- production migration execution;
- production bank money movement;
- production load and provider DR claims.

NEXT:
- Layer: Truthful Driver Offline Acknowledgement and Conflict Handling.
- Preserve server-derived role/tenant authority and the canonical Deal object.
- Do not begin until the durable financial-delivery criteria above are green and merged.

AFTER NEXT:
- Server-rendered RU/EN/ZH i18n.
- Complete mobile-first design-system and role-cabinet migration with one server-derived shell, one primary action, visible blocker reason and next step, accessibility and visual regression gates.
- Production load, high availability, observability and operational acceptance.
- Live integration activation only after contracts, partner credentials and controlled acceptance.

READINESS:
91% honest architectural and isolated-runtime readiness. Production deployment, provider PITR/RTO/RPO, live external integrations and production scale are not proven.
