# SR-3 — Observability Baseline (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only plan · NO runtime
change**. This plan prepares the observability foundation for a sandbox-ready and
future-100k `apps/api`, following `SCALE_READINESS_100K.md` (SR-3). It changes no
runtime code, no API behavior, adds no dependencies, touches no package/lockfile,
no Prisma schema, no DB-backed adapters, no money path, no UI / landing.

Honest framing (do not overstate):
- This is a **plan**, not an implementation. Nothing here makes the service
  "monitored" or "observable" — see §7.
- No `monitored production`, `SLA`, `load tested`, `incident-ready`, or
  `bank-grade observability` claims.

---

## 1. Current honest status (from repo facts)

- **Logging**: unstructured Nest `Logger` text lines in ~5 files
  (`new Logger(...)`), e.g. `AuditService` logs `Audit DB write skipped: …` at
  `debug`. No JSON, no fields, no levels policy.
- **Health**: a single basic `GET /health` returning a static body
  (`apps/api/src/main.ts`). No readiness vs liveness split.
- **Metrics**: `prom-client` is a dependency in `apps/api/package.json` **but is
  not wired** — there is **no `/metrics` endpoint**, no `collectDefaultMetrics`,
  no `Registry` in `src`.
- **Tracing / correlation**: **none** — no request id, no correlation id, no
  interceptor or middleware, no per-request context.
- **Audit**: `AuditService` writes best-effort to the (disabled) DB and otherwise
  logs a debug line; the durable `audit_events` table exists but is not the live
  sink (see SR-2).
- **Deploy traceability**: no build/commit/version surfaced by the API at runtime.

**Net:** observability today is a few ad-hoc text logs + a static health probe.
There is no structured signal, no metrics surface, and no way to correlate a
request across services. Correct for a pilot; explicitly **not** observable for
operations or scale.

---

## 2. What is missing (gap list)

| Capability | Present today |
|---|---|
| Request id | ❌ none |
| Correlation id (cross-service) | ❌ none |
| Structured (JSON) logs | ❌ text only |
| Metrics endpoint (`/metrics`) | ❌ prom-client unused |
| API latency metrics | ❌ |
| Money action metrics (reserve/release/callback) | ❌ |
| Transition-deny metrics | ❌ |
| Integration error metrics | ❌ |
| Auth failure metrics | ❌ |
| Audit / outbox health metrics | ❌ (audit best-effort; outbox in-memory) |
| Deploy / release traceability | ❌ no version/commit surfaced |

---

## 3. Target observability architecture

- **Structured JSON logging** — one event per line, machine-parseable, with a
  consistent envelope and explicit level policy (`info` for business events,
  `warn` for degraded/denied, `error` for failures).
- **Request id / correlation id** — a middleware assigns/propagates
  `x-request-id`; a `correlationId` flows across internal calls and into the
  outbox/bank-callback path so a money flow is traceable end-to-end.
- **Standard event envelope** — every business log carries:
  `timestamp, level, event, requestId, correlationId, actorId, role, orgId,
  objectType, objectId, action, result, reason?, durationMs?`.
- **Metrics endpoint `/metrics`** — wire the existing `prom-client` (no new dep)
  to expose counters/histograms; readiness vs liveness split on health.
- **Prometheus-compatible metrics** (later) — scrape `/metrics`; SLO targets.
- **Error tracking** (later) — structured error capture / aggregation.
- **Dashboards + runbook** (later) — money, transitions, auth, integration,
  outbox panels with alert thresholds.

No PII or secrets in logs/metrics; ids are opaque. Money **amounts** are logged
only as already-modelled fields (no card/account data, no credentials).

---

## 4. Events that MUST be logged (structured)

Each as a structured event with the §3 envelope:

- **auth deny** — failed login / invalid token (`result=deny`, `reason`).
- **role mismatch** — RBAC rejection (actor role vs required).
- **deal transition** — `from → to`, allowed/denied (with reason on deny).
- **document sign / upload** — actor, dealId, docType, result.
- **payment reserve / release / callback** — action, dealId, paymentId, amount
  field, result, blockers on a blocked release.
- **dispute open / decision** — disputeId, dealId, outcome, money instruction
  kind (no raw money beyond modelled fields).
- **integration adapter failure** — connector name, operation, error class
  (connectors are SANDBOX_ONLY / SIMULATED today).
- **DB fallback / degraded mode** — when the Prisma path is unavailable and the
  runtime/in-memory store serves instead (today's default), logged at `warn`.

These map directly to the existing seams (RBAC guard, RuntimeCore transitions,
DisputesService, AuditService, repository factories) — to be wired in later
phases, not now.

---

## 5. Metrics needed

| Metric | Type | Notes |
|---|---|---|
| `http_request_duration_ms` | histogram | per route/method/status; API latency |
| `deal_transition_denied_total` | counter | failed/blocked transitions by from→to |
| `payment_release_blocked_total` | counter | releases blocked by blockers |
| `payment_double_release_attempt_total` | counter | repeated release attempts (characterized weak spot) |
| `bank_callback_duplicate_total` | counter | duplicate callbacks (non-idempotency signal) |
| `dispute_open_total` / `dispute_decision_total` | counter | dispute volume by outcome |
| `evidence_chain_failure_total` | counter | hash-chain verification failures |
| `prisma_unavailable_total` | counter | DB-degraded fallbacks |
| `auth_failure_total` | counter | auth denies by reason |
| `outbox_lag_seconds` / `queue_lag_seconds` | gauge | **later** (durable outbox/queues, SR-2/SR-7) |

Metric **names are a contract** — fixed in SR3-A so dashboards/alerts can rely on
them before the wiring lands.

---

## 6. Phased PR plan (each gated; none started here)

1. **SR3-A (docs)** — this baseline + the static logging/metric **contract**
   (event envelope fields, event names, metric names). *(this PR)*
2. **SR3-B** — request/correlation-id middleware (assign + propagate
   `x-request-id`); behavior otherwise unchanged.
3. **SR3-C** — structured logger wrapper over Nest `Logger` emitting the §3
   envelope; migrate the existing ~5 log sites + the §4 events.
4. **SR3-D** — `/metrics` endpoint wiring the existing `prom-client` (no new dep)
   + the §5 counters/histograms; readiness/liveness health split.
5. **SR3-E** — dashboards + runbook + alert thresholds (config/docs; no app
   behavior).

Outbox/queue lag metrics and any DB-backed signal depend on SR-2 phases and stay
gated.

---

## 7. What must NOT be claimed now (honesty gate)

Until the phases land and run in a real environment, do **not** state:
- "monitored" / "monitored production";
- "SLA" / "meets SLOs";
- "load tested";
- "incident-ready" / "on-call ready";
- "bank-grade observability" / "full audit trail".

Allowed framing: *controlled-pilot; ad-hoc text logs + basic health only;
structured logging, correlation ids and a metrics endpoint are planned, not
implemented; prom-client present but unwired.*

This document implements none of the above. It is a plan and a naming contract.
