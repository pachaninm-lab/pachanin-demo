# SR-4 — Durable Outbox + Idempotency Keys Plan (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only plan · NO runtime
change**. This plan prepares reliable processing of actions, bank callbacks and
future integrations for `apps/api`, following `SCALE_READINESS_100K.md` (SR-4) and
`SR2_POSTGRES_MIGRATION_PLAN.md` (transactional outbox). It changes no runtime
code, no API behavior, adds no dependencies, touches no package/lockfile, no
Prisma schema, runs no migration, activates no DB-backed adapter, changes no
money path, no UI / landing, no live integration.

Honest framing (do not overstate):
- This is a **plan**, not an implementation. The outbox is **not** durable today
  and there is **no** idempotency — see §8.
- No `durable`, `exactly-once`, `idempotent money`, or `reliable delivery`
  claims.

---

## 1. Current honest status (from repo facts)

`common/outbox/outbox.service.ts` + the `outbox_entries` table:

- **In-memory is authoritative.** `OutboxService` holds `private readonly
  entries: OutboxEntry[] = []` with a `counter`-based id; the array is the source
  of truth. Lost on restart, not shared across instances.
- **Non-transactional dual-write.** `enqueue()` pushes to memory **and** does a
  best-effort `prisma.outboxEntry.create(...).catch(debug)` (fire-and-forget) —
  the two can diverge, and with no DB the DB write is simply skipped.
- **Partial persistence.** `markSent()` and `markFailed()` update memory only (no
  DB write); only `enqueue`/`confirm` attempt a best-effort DB write — so even
  with a DB, status drifts.
- **No idempotency.** Neither `enqueue` nor the bank-callback path carries an
  idempotency key. `SettlementEngineService.registerSafeDealsCallback` matches a
  pending entry by `dealId` and confirms/fails it — a duplicate callback
  re-confirms/re-fails (ties to the characterized repeated-callback / repeated-
  release weak spots in `MONEY_MINOR_UNITS_AUDIT.md`).
- **No dispatcher / worker.** Nothing polls `listPending()`; enqueue → "sent" is
  driven synchronously in the request path by the SettlementEngine. There is no
  backoff schedule, no real delivery, no ordering guarantee.
- **Retry is in-memory.** `markFailed` increments `retryCount`; after
  `MAX_AUTO_RETRIES = 3` the status becomes `MANUAL_REVIEW`. Counters reset on
  restart.

**Net:** the outbox is an in-memory ledger with a best-effort DB shadow and no
idempotency or worker. Correct as a pilot seam; **not** a reliable delivery
mechanism.

---

## 2. What is missing (gap list)

| Capability | Present today |
|---|---|
| Durable store as source of truth | ❌ in-memory authoritative |
| Transactional write (domain + outbox in one tx) | ❌ non-transactional dual-write |
| Idempotency key on actions | ❌ none |
| Idempotency / dedup on bank callbacks | ❌ matched by dealId only |
| Dispatcher / worker with backoff | ❌ none |
| Exactly-once *effect* (dedup on apply) | ❌ none |
| Ordering / per-deal serialization | ❌ none |
| Dead-letter / manual-review queue | ⚠️ `MANUAL_REVIEW` status only, in-memory |
| Persisted retry/attempt schedule | ❌ in-memory `retryCount` |
| Outbox health metrics (lag, pending, DLQ) | ❌ (see SR-3) |

---

## 3. Target durable outbox architecture

- **Postgres `outbox_entries` is the source of truth** (depends on SR-2). The
  in-memory array is removed once the durable path is the default; until then the
  durable store sits behind a flag with the in-memory default unchanged.
- **Transactional outbox.** A domain mutation and its outbox row are written in
  **one transaction** (SR-2 §8). The intent is never lost relative to the state
  change, and never emitted without it.
- **Dispatcher worker.** A single worker (advisory-locked so only one instance
  processes an entry — SR-2 §10) polls `PENDING/FAILED` ordered by
  `(createdAt)`, marks `SENT`, delivers, and records `CONFIRMED/FAILED` with a
  persisted `nextAttemptAt` and exponential backoff.
- **State machine** (persisted): `PENDING → SENT → CONFIRMED`, with
  `SENT → FAILED → (retry) → PENDING` and `FAILED → MANUAL_REVIEW` after the
  retry budget. `markSent/markFailed/confirm` all persist.
- **Dead-letter / manual review.** `MANUAL_REVIEW` entries are a durable DLQ with
  an admin surface (list/retry/resolve) — never silently dropped, never auto-
  released.
- **Per-deal ordering.** Entries for the same `dealId` are processed in order to
  avoid out-of-order money intents.

---

## 4. Idempotency key design

- **Action idempotency.** Each money/action enqueue carries an
  `idempotencyKey` (client- or server-generated, stable per logical request).
  A **unique constraint** on `idempotencyKey` makes a duplicate enqueue a no-op
  that returns the first entry — so a retried `requestReserve`/`requestRelease`
  cannot create a second bank intent.
- **Callback dedup.** Bank callbacks dedupe on `(dealId, eventType,
  bankIdempotencyKey)` (or the bank's own event id) persisted with a unique
  constraint; a duplicate `release_confirmed` is ignored after the first applied
  effect — directly closing the characterized **repeated callback** gap.
- **Exactly-once effect.** Idempotency guarantees the *effect* is applied once
  even if the message is delivered more than once; combined with the money
  invariants (`assertMoneyInvariants`: release ≤ available; no double release)
  this makes repeated release safe.
- **Correlation.** Each entry carries a `correlationId` (SR-3) so an action →
  outbox → callback chain is traceable end-to-end.

Idempotency is implemented in the **gated money/persistence track**, designed
here; it is **not** applied in this docs PR.

---

## 5. Schema additions (designed here; applied later, gated)

Additions to `outbox_entries` (and a callbacks/dedup table) — **not** applied in
SR-4; this is the target shape for the SR-2/money migration:

| Column | Type | Purpose |
|---|---|---|
| `idempotencyKey` | `TEXT UNIQUE` | dedup enqueue / exactly-once |
| `correlationId` | `TEXT` | end-to-end tracing (SR-3) |
| `nextAttemptAt` | `timestamptz` | persisted backoff schedule |
| `failedAt` | `timestamptz` | already modelled; wire it |
| `dedupKey` | `TEXT` | callback dedup `(dealId,eventType,bankKey)` |

Money columns are untouched here (kopecks is the separate PR-C track). The
existing `outbox_entries` model already has `retryCount/lastError/sentAt/
confirmedAt/failedAt` — SR-4 wires them durably in a later phase.

---

## 6. Phased PR plan (each gated; none started here)

1. **SR4-A (docs)** — this plan + the durable-outbox **contract** (state machine,
   idempotency-key rules, dedup keys, metric names). *(this PR)*
2. **SR4-B** — back `OutboxService` with `outbox_entries` behind a flag
   (in-memory default unchanged); persist all transitions; add idempotency-key
   column + unique constraint. Depends on SR-2 P2/P3.
3. **SR4-C** — dispatcher worker with advisory lock, exponential backoff,
   persisted `nextAttemptAt`, per-deal ordering.
4. **SR4-D** — callback dedup table + idempotent bank-callback handler (closes
   repeated-callback gap). **Money-path: gated behind the money §8 gate.**
5. **SR4-E** — DLQ admin surface (list/retry/resolve manual-review) + outbox
   health metrics (SR-3 §5: pending, lag, DLQ depth, duplicate count).

All money-effecting changes (idempotent release/callback) remain behind the money
gate and PR-B slice 2 / PR-C; SR-4 ships only A here.

---

## 7. Acceptance criteria (per phase)

- **SR4-B**: with the flag off, behavior is byte-identical (existing
  `outbox.spec.ts` + settlement specs green); with the flag on, every transition
  is persisted and survives a restart; duplicate enqueue with the same
  idempotency key returns the first entry.
- **SR4-C**: under concurrency, an entry is delivered by exactly one worker (no
  double-dispatch); failed deliveries retry on the persisted schedule and land in
  `MANUAL_REVIEW` after the budget.
- **SR4-D**: a duplicated bank callback applies its effect once; money invariants
  hold; the money characterization specs change only deliberately.
- **SR4-E**: DLQ entries are never dropped; metrics expose pending/lag/DLQ/dupes.

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Non-transactional dual-write divergence (today) | high | med | SR4-B transactional outbox; single source of truth |
| Duplicate callback double-applies money | med | high | idempotency/dedup keys (SR4-D) + money invariants |
| Worker double-dispatch | med | high | advisory lock + status state machine |
| Lost retries on restart | high (today) | med | persisted `retryCount`/`nextAttemptAt` |
| Out-of-order money intents | med | high | per-deal ordering |
| Idempotency change leaks into money behavior prematurely | med | high | money-path stays behind §8 gate; characterization specs as net |
| DLQ entries silently dropped | low | high | durable `MANUAL_REVIEW` + admin surface |

---

## 9. Honesty gate

Until the phases land and are tested, do **not** claim:
- "durable outbox" / "reliable delivery" / "guaranteed delivery";
- "exactly-once" / "idempotent money" / "no double release";
- "queue-backed" / "worker-processed" / "ordered processing".

Allowed framing: *controlled-pilot; in-memory outbox with a best-effort DB
shadow and no idempotency or worker; durable outbox, idempotency keys and a
dispatcher are planned, not implemented; money-path idempotency remains gated.*

This document implements none of the above. It is a plan and a contract.
