# SR-8 — Load-Test Harness + SLOs Plan (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only plan · NO runtime
change**. This plan defines the load-testing harness and the Service Level
Objectives that must be met **before** any scale/performance claim can be made,
following `SCALE_READINESS_100K.md` (SR-8). It closes the scale-readiness doc set
(SR-1..SR-7). It changes no runtime code, no API behavior, **adds no
dependencies**, touches no package/lockfile, no Prisma schema, runs no migration,
activates no DB-backed adapter, changes no money path, no UI / landing, no live
integration.

Honest framing (do not overstate):
- This is a **plan**, not a test run. **No load tests exist** and **no SLOs are
  measured** today — see §1 and §9.
- No `load tested`, `meets SLOs`, `SLA`, `capacity verified`, or `performance
  validated` claims.

---

## 1. Current honest status (from repo facts)

- **Functional tests only.** The repo has `test`/`test:e2e`/`test:playwright`/
  `test:api-smoke`/`test:tenant`/`test:auth` (correctness/smoke/e2e). There is
  **no** `k6`/`Gatling`/`Artillery`/`autocannon` harness and no `test:load`/
  `perf` script.
- **No SLOs.** No latency/throughput/error-rate targets are defined or measured;
  there is no error budget.
- **Nothing to measure against.** `prom-client` is present but **unwired**
  (SR-3), so there is no latency/throughput signal to assert on yet.
- **Single-node, in-memory.** A load test against today's process would measure a
  single in-memory pilot (SR-1), not a scalable system.

**Net:** the system is functionally tested but **performance-unknown**. There is
no harness, no baseline, and no SLOs. Correct for a pilot; performance/capacity
is **unmeasured**.

---

## 2. What is missing (gap list)

| Capability | Present today |
|---|---|
| Load-test harness (k6/Gatling) | ❌ none |
| Defined RPS / throughput targets | ❌ none |
| p50/p95/p99 latency budgets | ❌ none |
| Error-rate SLO + error budget | ❌ none |
| Soak (endurance) test | ❌ none |
| Spike / burst test | ❌ none |
| Capacity model (users → RPS → instances) | ❌ none |
| Performance baseline | ❌ none |
| SLO gate in CI | ❌ none |

---

## 3. Target load-test architecture

- **Harness**: a script-based load tool (**k6** recommended — scriptable,
  CI-friendly) kept in `tools/load/` and run out-of-band; it is **not** an app
  runtime dependency. Adding it is a separate, gated step (SR8-B).
- **Targets**: run against a **Postgres-backed staging** (depends on SR-2), with
  Redis + queues (SR-5/SR-7) for the scale scenarios — never against the
  in-memory pilot for a scale claim (a baseline run against the pilot is allowed
  but labelled as such).
- **Measurement**: assert on the SR-3 metrics surface (`/metrics`) +
  harness-side latency percentiles; correlate by request/correlation id.
- **Scenarios** (§4) cover read-heavy, money-flow, websocket and mixed traffic.
- **Profiles**: smoke (1–5 VUs), load (target RPS), stress (beyond target to find
  the knee), spike (sudden burst), soak (target RPS for hours).
- **Capacity model**: from the load curve derive users → concurrent sessions →
  RPS → instance count, documenting the linear-scaling assumptions and their
  limits.

---

## 4. Scenario catalog (targets are placeholders, set in SR8-A/-C)

| Scenario | Mix | Key endpoints | Notes |
|---|---|---|---|
| **Read-heavy** | ~80% | deal/list, workspace, passport | cache-friendly (SR-5) |
| **Money-flow** | low RPS, high care | reserve / release / callback | **gated**; idempotency (SR-4) under concurrency |
| **WebSocket** | N connections | connect + room fan-out | needs Redis adapter (SR-5) |
| **Mixed** | realistic blend | above combined | the SLO acceptance run |
| **Spike** | burst | mixed | rate-limit (SR-5) behavior verified |
| **Soak** | target RPS, hours | mixed | leak / drift / queue-lag (SR-7) |

---

## 5. SLO definitions (targets finalized in SR8-A; illustrative here)

Per endpoint class, measured at steady-state target load:

| Class | Latency p95 | Latency p99 | Error rate | Notes |
|---|---|---|---|---|
| Read (list/detail) | ≤ 200 ms | ≤ 500 ms | < 0.1% | cache-eligible |
| Write (transition/upload) | ≤ 400 ms | ≤ 1000 ms | < 0.5% | DB-bound |
| Money action | ≤ 500 ms | ≤ 1500 ms | < 0.1% | correctness > latency; **gated** |
| WebSocket event delivery | ≤ 1 s fan-out | — | < 0.5% | cross-instance |

- **Availability SLO**: e.g. 99.5% sandbox / higher later; **error budget**
  derived from it gates rollout.
- **Throughput SLO**: sustained target RPS at the above latencies without
  saturation (CPU/DB/queue within budget).
- Targets are **proposals** to be ratified by the owner in SR8-A; nothing here is
  a committed SLA.

---

## 6. Phased PR plan (each gated; none started here)

1. **SR8-A (docs)** — this plan + ratified SLO targets, scenario mixes and the
   capacity-model template. *(this PR)*
2. **SR8-B (tooling, no app change)** — add the k6 harness under `tools/load/`
   (dev/CI tool, not an app dependency); scripts for the §4 scenarios. Separate
   approval.
3. **SR8-C (baseline)** — run the harness against the **current** in-memory pilot
   to record a labelled baseline (explicitly "pilot, not scale").
4. **SR8-D (scale run)** — run against the Postgres + Redis + queues staging
   (depends on SR-2/5/7) and compare to the SLOs; money scenarios stay gated.
5. **SR8-E (CI gate)** — a smoke-load check in CI + an SLO report; full load runs
   on demand against staging.

No scale/performance claim is permitted until SR8-D passes against a
production-like staging.

---

## 7. Acceptance criteria (per phase)

- **SR8-B**: harness runs locally and in CI as a smoke profile without changing
  app behavior; no app runtime dependency added.
- **SR8-C**: a reproducible baseline report exists (latency percentiles, RPS,
  error rate), labelled as the in-memory pilot.
- **SR8-D**: against staging, the §5 SLOs are met for the mixed scenario at the
  target RPS, with a passing soak; money scenarios verified for correctness
  (idempotency/invariants) before any latency claim.
- **SR8-E**: CI runs the smoke-load profile green; an SLO report is produced;
  regressions beyond budget fail the gate.

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Baseline measured on the pilot mistaken for scale | high | high | label every run; scale claims only after SR8-D |
| Load test mutates real money state | med | high | money scenarios gated; run on isolated staging; idempotency (SR-4) |
| SLO targets set unrealistically | med | med | ratify in SR8-A; baseline-informed; iterate |
| Harness added as an app dependency by mistake | low | med | keep in `tools/load/`, dev/CI only |
| Staging not production-like → false confidence | med | high | require Postgres/Redis/queues parity before SR8-D |
| Flaky load runs in CI | med | low | smoke profile in CI; full runs on demand |

---

## 9. Honesty gate

Until SR8-D passes against a production-like staging, do **not** claim:
- "load tested" / "performance validated" / "capacity verified";
- "meets SLOs" / "SLA" / "99.x% availability";
- "scales to 100k users" / "N RPS" / "sub-200ms at scale".

Allowed framing: *controlled-pilot; functionally tested only; no load tests, no
SLOs, performance unmeasured; load harness and SLO targets are planned, not run;
money scenarios remain gated.*

This document implements none of the above. It is a plan and a contract, and it
defines the gate that the other scale-readiness docs (SR-1..SR-7) defer to before
any scale claim.
