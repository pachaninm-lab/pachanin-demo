# SR-7 — Queues for Async Work Plan (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only plan · NO runtime
change**. This plan prepares moving long-running and retryable work off the
request path onto durable queues, following `SCALE_READINESS_100K.md` (SR-7),
`SR4_OUTBOX_IDEMPOTENCY_PLAN.md` (outbox/idempotency) and
`SR5_REDIS_RATELIMIT_WEBSOCKET_PLAN.md` (Redis/broker). It changes no runtime
code, no API behavior, **adds no dependencies**, touches no package/lockfile, no
Prisma schema, runs no migration, activates no DB-backed adapter, changes no
money path, no UI / landing, no live integration.

Honest framing (do not overstate):
- This is a **plan**, not an implementation. There is **no broker, no worker, no
  scheduler** today; async work runs inline — see §1 and §9.
- No `queue-backed`, `async-processed`, `reliable background jobs`, or
  `worker-processed` claims.

---

## 1. Current honest status (from repo facts)

- **No broker / queue library.** No `bullmq`/`bull`/`amqplib`/`kafkajs`/`sqs`/
  `@nestjs/bull` dependency, and no `@nestjs/schedule`/`@Cron`/`setInterval` — so
  there is **no background worker or scheduler** running.
- **Work runs inline in the request path.** Outbox enqueue/confirm
  (`SettlementEngineService` → `OutboxService`), document package generation
  (`RuntimeCoreService.generateDealPackage`), and notifications all execute
  synchronously during the HTTP request.
- **Notifications are in-memory.** `NotificationsService` holds `private readonly
  notifications: Notification[] = []` and `push()`es synchronously — no delivery,
  no durability.
- **A worker abstraction exists but is unwired.** `shared/runtime-command-
  processor.ts` (`processRuntimeCommands`) already models the right shape —
  lease, heartbeat, object lock, transaction boundary, idempotent
  `claimPendingCommands`, retry/metrics — but it is **referenced nowhere**, takes
  all collaborators as injected functions, and has **no backing schema model**.
  It is a design seam, not a running worker.

**Net:** async work is synchronous and best-effort today; there is a good worker
contract on the shelf but nothing dispatches jobs. Correct for a pilot; **not** a
background-processing system.

---

## 2. What is missing (gap list)

| Capability | Present today |
|---|---|
| Message broker / durable queue | ❌ none |
| Background worker process | ❌ none (abstraction unwired) |
| Scheduler / periodic jobs | ❌ no `@nestjs/schedule`/cron |
| Off-request-path long work | ❌ inline (doc generation, callbacks) |
| Durable notifications delivery | ❌ in-memory array |
| Per-workload retries / backoff / DLQ | ❌ (see SR-4 for outbox-level) |
| Job idempotency | ❌ (see SR-4 idempotency keys) |
| Per-aggregate ordering / concurrency control | ⚠️ modelled in the unwired abstraction |
| Queue depth / job lag metrics | ❌ (see SR-3) |

---

## 3. Workloads that should become jobs

| Workload | Today | Why async |
|---|---|---|
| **Bank outbox dispatch** (reserve/release intents) | inline enqueue, no dispatcher | reliable delivery + retries; **money-gated** |
| **Bank callback application** | inline in request | idempotent apply off the callback path; **money-gated** |
| **Document / deal-package generation** | inline `generateDealPackage` | CPU/IO heavy; should not block the request |
| **Notifications delivery** | in-memory push | durable fan-out (email/push/in-app) with retries |
| **Evidence hashing / chain anchoring** | inline | offload hashing + object-storage anchoring (SR-1) |
| **Settlement recompute / snapshots** | on demand | batch/async recompute at scale |
| **Audit/outbox housekeeping** | none | periodic DLQ sweep, retry, metrics |

Money workloads (the first two) stay behind the money §8 gate and SR-4.

---

## 4. Target queue architecture

- **Broker**: BullMQ on Redis (reuses the SR-5 Redis layer) for the sandbox/scale
  path; a managed broker is an option in real envs. Behind a flag + config; the
  default stays inline so behavior is unchanged until activated.
- **Per-workload queues** (named): `bank-outbox`, `bank-callback`, `documents`,
  `notifications`, `evidence`, `settlement`, `housekeeping` — isolated so a slow
  workload cannot starve others.
- **Worker contract = the existing abstraction.** Wire `processRuntimeCommands`
  (lease + heartbeat + object lock + transaction + idempotent claim) as the
  worker body, backed by a durable jobs/commands table (SR-2) or BullMQ
  primitives — no new bespoke worker logic.
- **Reliability**: at-least-once delivery + **idempotent handlers** (SR-4
  idempotency keys) = effectively-once *effect*; exponential backoff; **DLQ**
  (`MANUAL_REVIEW`) with an admin surface (SR-4 §3).
- **Ordering / concurrency**: per-`dealId` ordering for money intents (SR-4 §3);
  bounded worker concurrency per queue.
- **Singleton/periodic**: leader lease (the abstraction's `acquireLease`) so only
  one instance runs housekeeping/sweeps.
- **Observability**: queue depth, job lag, success/fail/retry counters, DLQ depth
  (SR-3 §5).

Adding the broker client is a **dependency change** → a separate, gated PR
(SR7-B) — **not** part of this docs PR.

---

## 5. Per-job contract (designed here)

Each job is defined by:
- **name** (queue) + **payload** (typed, no PII/secrets beyond modelled fields);
- **idempotencyKey** (SR-4 §4) — dedupes re-enqueue and guarantees once-effect;
- **retry policy** — max attempts + backoff; on exhaustion → DLQ
  (`MANUAL_REVIEW`), never silently dropped;
- **priority / ordering key** (e.g. `dealId` for money);
- **timeout** + heartbeat for long jobs;
- **correlationId** (SR-3) threaded from the originating request.

Money jobs additionally enforce the money invariants (`assertMoneyInvariants`)
inside the worker transaction and never self-release (bank-callback driven).

---

## 6. Phased PR plan (each gated; none started here)

1. **SR7-A (docs)** — this plan + the queue topology, per-job contract and metric
   names. *(this PR)*
2. **SR7-B (deps/config, flagged)** — broker client (BullMQ/Redis) + queue module
   + config; **flag off by default**, no behavior change. (Dependency change —
   separate approval; depends on SR-5 Redis.)
3. **SR7-C** — move **outbox dispatch** to a `bank-outbox` worker using
   `processRuntimeCommands` (ties SR-4 §3 / SR4-C); still inline by default.
4. **SR7-D** — **documents** + **notifications** workers (durable notifications
   replacing the in-memory array); retries + DLQ.
5. **SR7-E** — **bank-callback** + money jobs (**money-path gated** — money §8
   gate + SR-4 idempotency); evidence/settlement/housekeeping workers.

All money-effecting changes remain behind the money gate; SR-7 ships only A here.

---

## 7. Acceptance criteria (per phase)

- **SR7-B**: app builds/boots unchanged with the flag off; broker sandbox spins
  up; with the flag on a queue health check passes; existing specs green.
- **SR7-C**: outbox entries are dispatched by exactly one worker (lease/lock); a
  failed job retries on backoff and lands in DLQ after the budget; inline default
  behavior unchanged when off.
- **SR7-D**: a document-generation / notification job runs off the request path,
  retries on failure, and is idempotent on re-delivery; notifications survive a
  restart.
- **SR7-E**: a duplicated bank-callback job applies its effect once; money
  invariants hold; the money characterization specs change only deliberately.

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| New broker dependency scope creep | med | med | isolated to SR7-B, flagged, separate approval |
| Job runs twice (at-least-once) | high | high | idempotency keys (SR-4) + money invariants → once-effect |
| Out-of-order money intents | med | high | per-`dealId` ordering; single worker per key |
| Broker outage stalls work | med | med | inline fallback documented; DLQ + alerting; jobs durable |
| Lost notifications (in-memory today) | high | med | durable notifications queue (SR7-D) |
| Worker not idempotent → double money effect | med | high | money jobs gated; invariants enforced in the worker tx |
| DLQ entries silently dropped | low | high | durable DLQ + admin surface (SR-4 §3) |

---

## 9. Honesty gate

Until the phases land and are tested, do **not** claim:
- "queue-backed" / "async-processed" / "background jobs";
- "reliable delivery" / "exactly-once" / "durable notifications";
- "worker-processed" / "horizontally scalable workers";
- "scheduled / periodic jobs".

Allowed framing: *controlled-pilot; async work runs inline, notifications in
memory, no broker/worker/scheduler; queues, workers and durable jobs are
planned, not implemented; money jobs remain gated.*

This document implements none of the above. It is a plan and a contract.
