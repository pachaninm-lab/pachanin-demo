# Scale Readiness — 100k Users Architecture Audit (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only plan · NO runtime
change**. This audit records, from repository facts, what platform-v7's `apps/api`
backend would need to serve **hundreds of thousands of users** — and what
currently blocks that. It changes no runtime code, no money logic, no Prisma
schema, no adapters, no UI. It is a planning artifact only.

Honest framing (do not overstate):
- The backend is **not** horizontally scalable today and is **not**
  production-grade for high load. See §6 for what must not be claimed.
- No `production-ready`, `fully live`, `handles 100k users`, `high-availability`
  claims. The current process is a single-node, in-memory pilot.

---

## 1. Current honest status (from repo facts)

| Area | Today | Source |
|---|---|---|
| Source of truth | **In-memory** `RuntimeCoreService` (process memory) | `runtime-core.service.ts` (arrays + counters) |
| Database | Prisma + **SQLite**, single file, single-writer; repositories default to the runtime adapter (DB path disabled behind flags) | `prisma/schema.prisma` `provider = "sqlite"`; per-domain `*-repository.factory.ts` |
| Process model | **Single** NestJS process, `app.listen(port)`, no clustering | `apps/api/src/main.ts` |
| Outbox / async work | **In-memory** array, not durable, not shared across instances | `common/outbox/outbox.service.ts` (`private readonly entries: OutboxEntry[] = []`) |
| Queues / brokers | **None** (no BullMQ/Kafka/SQS dependency) | `apps/api/package.json` |
| Cache / coordination | **No Redis** (no client dependency) | `apps/api/package.json` |
| Object storage | **None**; documents are in-memory refs / URLs | `runtime-core` documents array |
| Realtime | `socket.io` **in-process** (no Redis adapter) | `@nestjs/platform-socket.io`, `socket.io` deps |
| Auth | JWT (`jsonwebtoken`) | `modules/auth/auth.service.ts` |
| Observability | basic `/health`; `prom-client` present but metrics surface partial; no tracing | `main.ts`, `prom-client` dep |
| Money idempotency / locks | **None** in the runtime money path (documented) | `MONEY_MINOR_UNITS_AUDIT.md` §2; money characterization specs |
| Deploy | API single instance; web on Netlify; Vercel blocked (account) | execution-queue NEXT |

**Net:** the backend is a single, stateful, in-memory process. Restarting it
loses state; running two copies would diverge (no shared store). This is correct
for a controlled pilot and explicitly **not** built for horizontal scale yet.

---

## 2. What already helps scaling (real groundwork, keep it)

- **Repository boundary** (Deal / Payment reads / Document / Shipment / Lab /
  Dispute): data access is behind interfaces with a disabled Prisma adapter, so a
  DB-backed path can be switched on per domain **without rewriting services**.
- **RuntimeCore decomposition** into five stateless engines (StateMachine,
  CompletenessChecker, BlockerResolver, TimelineBuilder, MoneyEngine decision
  ladder) — stateless logic is trivially horizontally scalable; only the *store*
  needs externalizing.
- **Money minor-units foundation**: integer-kopecks helper + invariants +
  characterization tests + settlement math on kopecks — correctness groundwork
  that a sharded/concurrent money path will need.
- **Outbox seam** already exists as a concept (`OutboxService`) — the right
  pattern for reliable async money/event delivery once backed by a durable store.
- **Stateless JWT auth** — no server-side session store required to scale the
  auth check itself.
- **Prom-client** dependency present — a metrics foundation to build on.

---

## 3. What blocks scale (must be resolved before high load)

1. **In-memory source of truth.** State lives in process memory; cannot run >1
   instance, cannot survive a restart, no concurrency control. **Hard blocker.**
2. **SQLite.** Single-writer, single-file; no connection pooling for many
   concurrent writers; not a multi-instance database. **Hard blocker.**
3. **In-memory outbox.** Async work is neither durable nor shared — lost on
   restart, duplicated or dropped across instances.
4. **No idempotency / no locks** on money operations (reserve/release/callback) —
   at concurrency this risks double-release / over-release (already characterized).
5. **In-process websockets** — without a Redis adapter and sticky routing,
   realtime breaks across instances.
6. **No queue/broker** — long-running / retryable work (bank callbacks, document
   generation, notifications) runs inline in the request path.
7. **No shared cache / rate limiting** — no Redis-backed throttling; a single hot
   tenant can exhaust the process.
8. **Partial observability** — no distributed tracing, no consistent metrics/SLO
   surface, no structured request correlation across services.
9. **Single deploy instance** — no autoscaling, no load balancer health-gated
   rollout described for the API.

---

## 4. Target architecture (for hundreds of thousands of users)

Stateless app tier + externalized state. None of this is built here; this is the
target to design toward.

- **Postgres** (managed, primary + read replicas) as the durable source of truth,
  replacing the in-memory store and SQLite. Connection pooling (PgBouncer).
  Repositories already provide the seam; activation is a separate, gated effort.
- **Redis** for: shared cache, rate limiting, distributed locks (money critical
  sections), websocket pub/sub adapter, and ephemeral coordination.
- **Durable queues** (e.g. BullMQ on Redis, or a managed broker) for async work:
  bank callbacks, document/package generation, notifications, outbox dispatch —
  moved off the request path with retries + dead-letter.
- **Durable outbox + idempotency keys** for money/event delivery: every money
  mutation carries an idempotency key; exactly-once effect via the transactional
  outbox pattern persisted in Postgres.
- **Distributed locks / optimistic concurrency** on payment rows so
  reserve/release/adjust/callback are safe under concurrency (release ≤ available;
  no double release) — backed by the money invariants already written.
- **Object storage** (S3-compatible) for documents/evidence, with the hash-chain
  integrity model (see Evidence in `API_RUNTIME_SOT_AUDIT.md`) anchored to it.
- **Stateless app instances** behind a load balancer with autoscaling; health and
  readiness probes gating rollout; no in-process state.
- **Observability**: Prometheus metrics + SLOs, OpenTelemetry tracing, structured
  logs with request/tenant correlation, alerting on money/queue lag.
- **Rate limits & quotas** per tenant/role (Redis token bucket) to protect the
  shared tier.
- **Load tests** (k6/Gatling) with target RPS, p95/p99 latency budgets and a
  soak test, run against a Postgres-backed staging before any scale claim.

---

## 5. Recommended next PR order (each gated, none started here)

Sequenced low-risk → high-risk; persistence/money steps stay locked pending
explicit owner approval (and the money §8 gate in `MONEY_MINOR_UNITS_AUDIT.md`).

1. **SR-1 (docs)** — this audit + per-area target specs. *(this PR)*
2. **SR-2 (docs)** — Postgres migration plan: schema parity, data backfill,
   cutover/rollback, connection pooling. **No** schema change yet.
3. **SR-3 (infra/config, no behavior)** — observability baseline: `/metrics`
   endpoint, structured logging, request correlation id. App behavior unchanged.
4. **SR-4** — durable outbox + idempotency keys behind a flag (still in-memory
   default), with concurrency tests. Prereq for safe money scaling.
5. **SR-5** — Redis-backed rate limiting + websocket adapter (flagged).
6. **SR-6** — DB-backed repository activation per domain behind flags (Postgres),
   reads first, then writes — **separate owner approval; depends on money
   minor-units PR-B slice 2 + PR-C**.
7. **SR-7** — queues for async work (bank callbacks, doc generation, notifications).
8. **SR-8** — load-test harness + SLOs; only after a Postgres-backed staging exists.

Money path changes (reserve/release/callback concurrency, DB-backed money writes)
remain blocked behind the money gate and are **not** part of SR-1..SR-3.

---

## 6. What must NOT be claimed now (honesty gate)

Until the above lands and is load-tested, do **not** state any of:
- "scales to 100k users" / "handles hundreds of thousands of users";
- "horizontally scalable" / "high-availability" / "production-grade";
- "Postgres-backed" / "DB-backed" (the DB path is disabled by default);
- "durable" outbox/queues, "idempotent money", "distributed locks" — none exist
  in the runtime yet;
- "load tested" / "meets p95/p99 SLOs" — no load tests exist.

Allowed framing: *controlled-pilot, single-node, in-memory; scale architecture
planned, not implemented; DB-backed path not active; load testing pending.*

This document is a plan. It implements none of the target architecture.
