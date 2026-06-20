# SR-2 — Postgres Migration Plan (platform-v7, sandbox-ready)

Status: **controlled-pilot / pre-integration · docs-only plan · NO migration
performed**. This is the execution plan to move `apps/api` persistence from the
current in-memory + SQLite setup toward a **sandbox-ready Postgres** backend. It
follows `SCALE_READINESS_100K.md` (SR-2). It changes no runtime code, runs no DB
migration, touches no money path, adds no dependencies, and modifies no UI /
landing.

Honest framing (do not overstate):
- This is a **plan**, not an implementation. The DB-backed path stays **disabled
  by default**; nothing here makes the platform Postgres-backed.
- No `Postgres-backed`, `scalable to 100k`, `load tested`, or `idempotent money`
  claims — see §15.

---

## 1. Current persistence blockers (from repo facts)

- **In-memory source of truth.** `RuntimeCoreService` holds deals, shipments,
  documents, samples, payments, money events, callbacks, evidence in process
  arrays + counters. State is lost on restart; two instances diverge. *(hard
  blocker)*
- **SQLite.** `prisma/schema.prisma` → `provider = "sqlite"`, single file,
  single writer, no pooling for concurrent writers. *(hard blocker)*
- **No durable queues.** `OutboxEntry` exists in the schema, but the runtime
  `OutboxService` is an **in-memory array** (`private readonly entries = []`) —
  not durable, not shared.
- **No idempotency / no locks.** Money operations (reserve / release / callback)
  have no idempotency key and no concurrency control (characterized in
  `MONEY_MINOR_UNITS_AUDIT.md` §2 and the money characterization specs).
- **SQLite-shaped schema.** JSON stored as `String` (`Deal.meta`,
  `Shipment.blockers`, `OutboxEntry.payload`, `*.metadata`), money as `Float`,
  status as free `String`.

---

## 2. Target Postgres architecture (sandbox)

- **Postgres 15+** (managed in real envs; local docker for sandbox) as the
  durable store. Single primary for sandbox; read-replica + PgBouncer pooling
  reserved for the later scale phase (out of scope here).
- **Prisma** stays the ORM; only `datasource.provider` and column types change.
- **Repository seam already exists**: per-domain `Prisma*Repository` adapters are
  present but disabled behind `PLATFORM_V7_*_REPOSITORY=prisma`. Activation is a
  later, separately-approved step (SR-6 / money gate), not part of this plan.
- **Durable outbox** backed by the `outbox_entries` table (already modelled),
  replacing the in-memory array — the seam for reliable async work.
- **Stateless app tier**: once state is in Postgres, the app process holds no
  authoritative state and can run multiple instances.

---

## 3. Entity / schema mapping (14 models today)

Current models (all `@@map`ped): `deals`, `shipments`, `checkpoints`,
`deal_documents`, `payments`, `lab_samples`, `lab_tests`, `outbox_entries`,
`disputes`, `dispute_money_holds`, `dispute_evidence`, `evidence_files`,
`audit_events`.

SQLite → Postgres column-type mapping:

| Current (SQLite) | Postgres target | Notes |
|---|---|---|
| `String` JSON (`Deal.meta`, `Shipment.blockers`, `OutboxEntry.payload`, `*.metadata`) | `jsonb` | typed, indexable; parse-once at the boundary |
| `Float` money (`amountRub`, `totalRub`, `holdAmountRub`, `releasedRub`, `disputedAmountRub`, `moneyDeltaRub`, `claimAmountRub`, `pricePerTon`) | `BIGINT` kopecks | **aligns with minor-units PR-C; gated separately — NOT done here** |
| `String` status (`Deal.status`, `Payment.status`, …) | `TEXT` + `CHECK`, or native `enum` | keep `TEXT`+CHECK first for cheap evolution |
| `DateTime` | `timestamptz` | store UTC |
| `String @id @default(cuid())` | `TEXT` (cuid) | keep cuid ids; no UUID churn |
| `Int` (`sizeBytes`, `version`, `retryCount`, `slaMinutes`) | `INTEGER` | unchanged |
| `Boolean` | `boolean` | unchanged |

Indexing additions for scale (later phases): composite `(@@index)` on
`(sellerOrgId, status)`, `(buyerOrgId, status)`, `(dealId, createdAt)`; tenant/org
scoping indexes; `outbox_entries(status, createdAt)` for the dispatcher.

The **money `Float → BIGINT` kopecks** change is explicitly deferred to the money
track (PR-C) and is **not** part of SR-2 — SR-2 ports the schema to Postgres with
types otherwise preserved.

---

## 4. Migration phases (each a separate, gated PR; none started here)

1. **P0 (docs)** — this plan. *(this PR)*
2. **P1 (config, no behavior)** — introduce a Postgres `datasource` option +
   docker-compose for local sandbox; `prisma migrate` runs only in a sandbox
   profile. Runtime default stays in-memory / SQLite. No code path switches.
3. **P2 (schema parity)** — Prisma schema variant with Postgres types (`jsonb`,
   `timestamptz`, CHECK constraints), generating an initial migration validated
   against an empty Postgres. Money columns stay as-is (kopecks deferred).
4. **P3 (durable outbox)** — back `OutboxService` with `outbox_entries` behind a
   flag; in-memory default unchanged. Adds idempotency-key column.
5. **P4 (DB-backed reads)** — enable Prisma repository **reads** per domain behind
   the existing flags against Postgres; runtime remains the default. Shadow-read
   parity checks.
6. **P5 (DB-backed writes)** — enable writes per domain; transactional
   boundaries + locks (below). **Money domains gated behind the money §8 gate +
   PR-B slice 2 / PR-C.**
7. **P6 (cutover)** — flip default to Postgres per environment after parity +
   load criteria (SR-8) are met.

SR-2 covers only **P0** (this doc) and the **design** of P1–P6.

---

## 5. Parity / backfill strategy

- **Backfill source**: the seeded in-memory RuntimeCore state + any SQLite rows.
  A one-off, idempotent backfill script maps each in-memory entity to its table
  using existing ids (cuid/`DEAL-00x`), so re-runs are safe.
- **Shadow reads**: in P4, read from both runtime and Postgres and diff results
  (counts, key fields, money totals) without serving DB data — log mismatches.
- **Parity gates**: a domain may flip to DB reads only when shadow-diff is clean
  over a defined window for the seeded dataset and the characterization/​money
  specs stay green.
- **No destructive backfill**: backfill only inserts/updates; never deletes
  runtime state; reversible by clearing the Postgres dataset.

---

## 6. Cutover / rollback

- **Cutover** is per-environment and per-domain via the existing
  `PLATFORM_V7_*_REPOSITORY` flags + a datasource switch — never a big-bang.
- **Rollback** = flip the flag back to the runtime/SQLite adapter; because the
  runtime store is untouched until P6 and backfill is non-destructive, rollback
  is immediate and loss-free in P1–P5.
- **Post-cutover rollback** (P6) requires a reverse-backfill snapshot; documented
  as a precondition before any environment flips its default.
- Every phase PR must be **revertible in a single PR** with no data dependency.

---

## 7. Connection pooling

- App → **PgBouncer** (transaction pooling) → Postgres; Prisma `connection_limit`
  tuned to pooler size. Sandbox may use a small direct pool; pooling is mandatory
  before any multi-instance / scale phase.
- Long transactions are avoided (incompatible with transaction pooling); money
  critical sections use short, explicit transactions (§8).

---

## 8. Transactional boundaries

- **One aggregate, one transaction**: a deal-state change that touches the deal +
  its payment + an outbox entry commits atomically (state + intent together).
- **Outbox-in-transaction**: a money/event mutation writes the domain row **and**
  the `outbox_entries` row in the same transaction (transactional outbox); a
  separate dispatcher delivers and marks `sentAt/confirmedAt/failedAt`.
- **No cross-aggregate transactions** across HTTP calls; coordinate via outbox +
  idempotent handlers.
- Reads use the default isolation; money writes use `SERIALIZABLE` or explicit
  row locks (§10) on the payment row.

---

## 9. Idempotency keys

- Every externally-triggered money/event operation (reserve, release, bank
  callback, adjust) carries a client/bank **idempotency key** persisted with a
  unique constraint, so a retry/duplicate is a no-op returning the first result.
- `outbox_entries` gains an idempotency key; the bank callback handler dedupes on
  `(dealId, eventType, idempotencyKey)` — directly fixing the **repeated
  callback / repeated release** non-idempotency the characterization specs pinned.
- Idempotency is implemented in the **money track (gated)**, designed here.

---

## 10. Locks / concurrency model

- **Row-level locks** (`SELECT … FOR UPDATE`) on the payment row inside the money
  transaction, so concurrent reserve/release/adjust serialize per deal.
- **Optimistic concurrency** (a `version` column) on aggregates where contention
  is low (documents, shipments) — write fails on stale version, caller retries.
- **Advisory/distributed locks** (Postgres advisory locks now; Redis later) for
  the outbox dispatcher so only one worker processes an entry at a time.
- Invariants enforced inside the locked section using the existing
  `assertMoneyInvariants` (release ≤ available; disputed + held + released ≤
  total; no negative release).

---

## 11. Audit trail persistence

- `audit_events` becomes the durable, append-only audit log (today the
  `AuditService` write is best-effort / mock). Every money and state mutation
  writes an audit row in the same transaction as the change.
- Audit rows are **immutable** (no update/delete path); retention + export are a
  later compliance step (see SECURITY/SOC2 readiness docs).
- Evidence hash-chain (`evidence_files.prevHash`) is preserved and anchored to
  object storage in the scale phase (Evidence is N/A for the repository-boundary
  pattern — see `API_RUNTIME_SOT_AUDIT.md`).

---

## 12. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Float→kopecks coupling leaks into SR-2 | med | high | SR-2 keeps money columns as-is; kopecks is the gated money track |
| Shadow-read parity drift (money totals) | med | high | parity gates + characterization/money specs must stay green |
| Backfill duplicates / partial state | med | med | idempotent, id-keyed, non-destructive backfill; dry-run first |
| Long transactions break PgBouncer txn pooling | med | med | short money transactions only; no tx across HTTP |
| Outbox double-dispatch | med | high | advisory lock + idempotency key + status state machine |
| Premature default cutover | low | high | per-env/per-domain flags; gates before P6 |
| Enum drift (status as TEXT) | low | low | `TEXT`+CHECK first; promote to enum later |
| Hidden in-memory assumptions in services | med | med | repository seam already isolates data access; shadow-read catches gaps |

---

## 13. Acceptance criteria (per phase)

- **P1**: app builds/boots unchanged with the in-memory/SQLite default; Postgres
  sandbox spins up via docker-compose; `prisma migrate` applies cleanly to an
  empty Postgres in the sandbox profile only.
- **P2**: Postgres schema migration validates; round-trips `jsonb`/`timestamptz`;
  all existing apps/api specs + characterization/money specs green, runtime
  default unchanged.
- **P3**: durable outbox passes concurrency tests (no double-dispatch); in-memory
  default behavior unchanged when the flag is off.
- **P4**: shadow-read diff clean over the window for the seeded dataset; no
  serving of DB data yet.
- **P5**: DB writes pass invariant + concurrency tests; money domains remain
  gated.
- **P6**: only after SR-8 load criteria; reverse-backfill snapshot exists.

---

## 14. Out of scope (explicitly not in SR-2)

Money `Float→BIGINT` kopecks migration (PR-C), live DB-backed activation
(SR-6/P5–P6), Redis / queues / rate-limits (SR-5/SR-7), load tests (SR-8), and
any live integration. SR-2 is the **plan** for P0 and the design of P1–P6 only.

---

## 15. Honesty gate

Until each phase is implemented, gated and tested, do **not** claim:
- "Postgres-backed" / "running on Postgres" — the DB path is disabled by default;
- "scalable to 100k users" / "horizontally scalable" / "production-grade";
- "load tested" / "meets SLOs" — no load tests exist;
- "idempotent money" / "durable outbox" / "distributed locks" — designed here,
  not implemented.

Allowed framing: *controlled-pilot, in-memory/SQLite default; Postgres migration
planned, not implemented; DB-backed path not active; money kopecks + idempotency
remain gated.*

This document implements none of the above. It is a plan.
