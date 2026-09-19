# Industrial Readiness baseline — autonomous contour

**Repository:** `pachaninm-lab/pachanin-demo`  
**Exact main baseline:** `d53a2996023a8039bbb70302b3fc3552cbabf525`  
**Captured:** `2026-07-15T13:22:54Z`  
**Decision:** **NO-GO — production operationally accepted is not proven**

## 1. Confirmed facts

1. IR-OUTBOX is merged into `main`: PostgreSQL owns queue state; the competing in-process relay is removed; leases, heartbeat, stale-token rejection, retry, dead-letter and audited redrive are exact-head gated.
2. Auction atomic execution and PostgreSQL dispute authority have dedicated blocking PostgreSQL 16 acceptance workflows.
3. The exact main head still receives five obsolete failed contexts: four Vercel contexts and one Deno context. This is `BLOCKED_BY_EXTERNAL_ADMIN`; repository code must not fabricate or override a pass.
4. API and web container definitions exist. Helm desired state declares two replicas, probes, HPA, PDB, rolling update and non-root security context.
5. The only deployable runtime images recorded by the repository are API and web. The former worker image is explicitly `NOT_DEPLOYABLE`.
6. Local compose is development-only: single PostgreSQL, single Kafka broker, Vault dev mode, local MinIO and hardcoded local credentials.
7. No accepted production-like environment, PostgreSQL HA/pooler/PITR, immutable image promotion, full object restore, target load, chaos, complete security acceptance or operational soak evidence was found.

## 2. Current maturity

- **Implementation-verified capabilities:** 9 of 25.
- **Operationally proven capabilities:** 0 of 25.
- **External integrations:** `FAIL_CLOSED`; they are outside this acceptance contour and cannot be represented as live.
- **Open P0 blocks:** IR-OPS, logistics completion, document custody, independent workers, object storage, PostgreSQL HA, backup/restore, security acceptance, deployment acceptance and soak.

## 3. Production-like feasibility

The target contour is feasible without rewriting the Deal architecture. The strongest foundations are PostgreSQL authority, canonical Deal commands, integer money, RLS, atomic auction, disputes and durable outbox.

The infrastructure sequence is:

1. deployable independent outbox/background worker;
2. immutable digest-based API/web/worker artifacts;
3. production-like Kubernetes overlays and migration gate;
4. PostgreSQL 16 HA + pooler + WAL/PITR;
5. S3-compatible immutable evidence custody;
6. observability/SLO/alerts;
7. load, chaos, security, restore and rollback acceptance;
8. 72-hour → 14-day → 30-day soak.

## 4. Formal decision

> Платформа промышленно спроектирована и технически готова к следующему этапу, но статус production operationally accepted не подтверждён из-за отсутствия production-like deployment evidence, независимой worker-топологии, PostgreSQL HA/PITR, полного restore, target load/chaos/security acceptance, operational soak и закрытия IR-OPS.

## 5. First implementation slice

**IR-TOPOLOGY-WORKER:** package the durable PostgreSQL outbox runner as a separate non-root immutable worker image and Kubernetes Deployment. The API must remain unable to start the worker unless explicitly enabled. Acceptance must cover two workers, graceful shutdown, restart after claim, lease expiry, stale-token acknowledgement, backlog recovery and disabled Kafka fail-closed behavior.
