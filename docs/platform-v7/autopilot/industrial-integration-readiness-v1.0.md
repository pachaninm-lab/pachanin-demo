# Industrial Integration Readiness v1.0

Date: 2026-07-12

Owner: product owner

Executor: Codex

Target gate: Industrial Integration-Ready

Baseline at approval: `66bf4655eede522ca3f3963d6d7aaa5cee9c50a5`

## 1. Purpose

This document is the repository-controlled execution contract for making
platform-v7 technically ready for external integrations. It is not a statement
that the current platform has passed the target gate.

The gate is accepted only after all mandatory implementation, negative-test,
operations, recovery, security and evidence requirements below are satisfied on
an exact commit and deployment.

## 2. Target outcome

The grain-deal execution contour must have these properties:

- PostgreSQL is the only authority for every critical domain;
- business change, audit and integration event commit atomically;
- inbound and outbound messages are durable, idempotent and observable;
- tenant, actor, role, status, money and business basis are server-derived;
- documents, signatures and execution facts form a verifiable evidence chain;
- restart, horizontal scale and single-instance failure do not lose state;
- a partner is added by contract, configuration, credentials and versioned
  mapping without changing the canonical Deal core;
- operations, load, HA, DR and security properties have reproducible evidence.

## 3. Boundary of the gate

Included:

- PostgreSQL persistence and RLS;
- durable outbox and inbox;
- Partner API and outbound webhooks;
- canonical business bases;
- evidence storage and signature verification;
- real role workflows and offline conflict handling;
- adapter contracts and partner simulators;
- production configuration, SLO, load, HA, DR and security evidence;
- final acceptance pack.

External dependencies that Codex cannot fabricate:

- signed agreements with banks, EDO providers and government systems;
- production credentials, certificates and network access;
- organizational exchange regulations;
- production cloud accounts and allocated infrastructure;
- independent pentest opinion;
- external legal conclusion for a concrete data-processing contour.

Missing external access never permits a mock response to be labelled as live.

## 4. Baseline facts and open risks

Merged and preserved:

- PostgreSQL-authoritative canonical Deal command core and ordinary Deal routes;
- server-derived role and tenant isolation for the canonical Deal contour;
- RLS and separate restricted PostgreSQL principals;
- idempotent commands, optimistic concurrency and bank-callback authority;
- transactional Deal/audit/outbox creation for the canonical command path;
- PostgreSQL ledger and reconciliation evidence;
- durable PostgreSQL outbox worker mechanics;
- persistent authentication, sessions and MFA;
- correlation identifiers and initial operational metrics;
- isolated CI correctness, RLS and backup/restore evidence.

Confirmed open risks:

1. Documents, Logistics, Labs, Settlement and Disputes can bind process-memory
   repositories.
2. The legacy process-memory OutboxRelayService coexists with the durable worker.
3. Inbound webhook deduplication is held in process memory.
4. Partner credentials and subscriptions are held in process memory.
5. Some integrations can return sandbox/simulated/mock results without durable
   domain execution.
6. Production startup validates repository authority only for part of the graph.
7. Vendor mappings and provider-grade field contracts are incomplete.
8. Stub remains a default for some adapters.
9. Provider HA, PITR/restore, production-scale load and external security
   acceptance are unproven.
10. Some role and offline surfaces are not proven against authoritative server
    state.

## 5. Mandatory architecture rules

1. Critical state cannot live in process memory or a local file.
2. Unknown repository, integration or worker mode blocks production startup.
3. Tenant, actor, role, status, money and basis are server-derived.
4. Domain change, audit and outbox commit in one transaction.
5. Delivery is at least once; business effect is idempotent.
6. Transport failure or unknown response never becomes SENT or CONFIRMED.
7. One production owner exists for each worker class.
8. Confirmed evidence is immutable; correction creates a new version.
9. Stub/simulator is never represented as a connected external system.
10. RLS, scoped credentials, restricted DB principals and service identities
    follow least privilege.
11. Every command and delivery has correlation and idempotency identifiers.
12. Schema evolution is forward-only and tested on empty and existing databases.

## 6. Required operating modes

| Contour | Development | Test | Staging | Production |
|---|---|---|---|---|
| Critical repositories | explicit memory or prisma | explicit | prisma only | prisma only |
| Outbox owner | one explicit owner | test-controlled | dedicated worker | dedicated worker |
| Adapter | disabled/stub/sandbox | explicit | disabled/sandbox | disabled/live |
| Stub in authoritative flow | marked dev scenario only | isolated test only | forbidden | forbidden |
| Object storage | emulator/local adapter | emulator | S3-compatible | S3-compatible with retention |
| Secrets | non-production only | test secrets | secret manager | secret manager/KMS/HSM as required |

No implicit default may enable memory or stub in staging or production.

## 7. Ordered work packages

### IR-00 — Source-of-truth synchronization

Update baseline, remove closed blockers, create the IR-10 through IR-90 queue,
set one current step and one narrow allowed scope, and keep maturity wording
evidence-based.

Acceptance: dispatcher and guard agree on exactly one current step; state,
queue, progress and prompts do not conflict.

### IR-10 — Production repository authority

Convert Documents, Logistics, Labs, Settlement and Disputes in separate PRs.
Each domain must bind Prisma directly in production, reject unknown modes,
retain memory only as explicit test/development adapters, enforce trusted RLS,
and prove restart, multi-instance and cross-tenant behavior.

First slice: IR-10.1 Documents PostgreSQL Authority. Object storage and
cryptographic provider activation remain separate IR-40/IR-41 concerns.

### IR-20 — Canonical durable outbox

Remove the legacy relay and process-memory outbox from the production graph.
Enforce one dedicated owner and durable PENDING, PROCESSING, RETRY, SENT or
CONFIRMED, and DEAD transitions using DB time, bounded leases and `SKIP LOCKED`.
Persist attempts, classified errors and retry time; support audited re-drive,
backpressure and graceful shutdown.

Required failures: concurrent workers, crash after claim, crash after provider
send before local acknowledgement, false send result, timeout, 429, 4xx, 5xx,
expired lease, duplicate enqueue, restart and double-owner startup.

### IR-21 — Durable integration inbox

Persist provider, provider event ID, tenant mapping, raw-body hash, schema and
mapping versions, signature/key version, DB receive time, verification result,
state, attempts, error, correlation and linked domain operation. Verify
signatures over raw bytes, enforce replay windows and key lifecycle, separate
HTTP acknowledgement from domain processing, quarantine unknown schemas and
support audited re-drive.

### IR-22 — Persistent Partner API and outbound webhooks

Persist scoped credentials, organization binding, hash/protected secret
material, lifecycle, rotation and revocation. Persist webhook subscriptions and
filters, deliver through the durable outbox, classify attempts, enforce rate
limits/quotas/circuit breakers, sign outbound messages and expose OpenAPI and
AsyncAPI contracts. Revoke must apply immediately across instances.

### IR-30 — Canonical Deal and Payment Basis

Normalize winning bid, parties, subject, quantity, price, currency, terms,
tolerances, quality and required documents. Create immutable server snapshots
and hashes. Link every command to a basis version. Client DTOs cannot author
winner, price or payment terms. Amendments create new audited versions and
require the necessary party acceptance/signature.

### IR-31 — Normalized logistics and acceptance

Persist and verify Carrier, Driver, Vehicle, Trailer, Facility, Route/Trip,
Admission, Arrival, WeightTicket, Acceptance, Sample and Inspection or
semantically equivalent models. Enforce ownership, document validity,
idempotency, optimistic concurrency and server-issued offline bases. A
discrepancy can block or open a dispute but cannot move money automatically.

### IR-32 — Lab, document and dispute state machines

Implement sample custody, protocol lifecycle, method/equipment/calibration,
immutable results and correction versions; document requirement/blocker states;
and dispute reason, evidence, scoped amount, deadline and decision. All
decisions require actor, basis, DB time, evidence links, append-only audit and
server-derived role permission.

### IR-40 — Evidence object storage

Use production S3-compatible storage without filesystem fallback. Control
presigned access server-side; verify SHA-256 before and after upload; quarantine
until malware/CDR policy completes; enforce MIME/size/extension policy,
retention/WORM or equivalent, legal hold, versioning, lifecycle, access audit,
metadata/object restore and secret-safe logs.

### IR-41 — Signature verification

Create a provider boundary for CryptoPro/DSS or the approved provider. Persist
document hash, detached/embedded signature, certificate chain, validity,
purpose, revocation result, signer-organization-authority match, timestamp when
required, verification policy/algorithm version and immutable Action Receipt.
A positive status requires positive cryptographic verification.

### IR-50 — Adapter conformance

Every adapter declares capabilities, typed request/response, mapping version,
auth, timeout/retry, idempotency/correlation, error taxonomy, health/readiness,
PII logging policy, reconciliation and simulator fixtures. Production defaults
to disabled, not stub. Missing live credentials/base URL blocks activation.

### IR-51 through IR-55 — Priority integrations

| Package | System | Required before credentials |
|---|---|---|
| IR-51 | ESIA/SMEV | OAuth/claims boundary, representative mapping, envelope mapping, simulator, negative tests |
| IR-52 | FGIS Grain | SDIZ/lot mapping, callbacks, reconciliation, simulator, schema versions |
| IR-53 | EDO and signature | provider mappings, document lifecycle, inbox use, verification |
| IR-54 | Bank | reserve/release contract, callback keys, reconciliation, mismatch evidence, simulator and cutover controls |
| IR-55 | GPS/telematics | position/track mapping, device identity, stale/out-of-order policy and offline reconciliation |

Each package requires a data dictionary, sequence diagrams, provider contract
reference, field mapping, auth/key runbook, simulator, positive/negative
contract tests, reconciliation report, monitoring/alerts, sandbox checklist and
live cutover/rollback plan. Live activation requires real credentials, sandbox
evidence and explicit product-owner approval.

### IR-60 — Role cabinets on authoritative data

Remove production fixture authority. Use one server-derived shell and real
PostgreSQL read models. Each role gets one primary action, visible blocker and
next step, and correct loading/empty/error/forbidden/conflict states. Prove one
full deal across every involved role and visual regressions at key viewports.

### IR-61 — Offline, localization and accessibility

Distinguish LOCAL_QUEUED, SERVER_ACCEPTED, REJECTED and CONFLICTED. Persist the
server-issued actor/deal/version basis, replay idempotently and never confirm a
business fact from local storage alone. Protected surfaces and errors must be
complete in RU/EN/ZH without mixed language. Prove keyboard/focus/labels,
contrast, screen-reader announcements, mobile and low-bandwidth behavior.

### IR-70 — Production configuration and infrastructure profile

Create a typed fail-closed manifest for every repository, worker, storage and
integration mode. Use secret management and separate API/worker/migration
identities. Define PgBouncer/pools, multiple API instances, dedicated workers,
probes, zero-downtime-compatible migrations, rolling deployment/rollback,
network policy/egress allowlist, immutable image, SBOM/provenance and drift
detection.

### IR-71 — Observability, SLO and operations

Define SLI/SLO for API, commands, outbox/inbox, integrations and jobs. Propagate
correlation from HTTP through DB and partner delivery. Provide RED/USE metrics,
backlog/lease/retry/dead/reconciliation alerts, masked structured logs,
critical tracing, business/technical dashboards, incident routing and runbooks.

Initial verification targets unless superseded by product approval:

- API availability at least 99.9% monthly;
- p95 reads at most 500 ms without provider latency;
- p95 commands at most 1 second without provider latency;
- internal error rate below 0.5% at target load;
- lost durable events: zero;
- unexplained money discrepancies: zero.

### IR-72 — Production-scale load, HA and DR

Minimum profile: 1,000 concurrently active users, 5,000 live sessions, 50,000
active deals, two API instances, two competing workers, soak, partner latency
and outage injection, DB failover/exhaustion, backup, PITR and isolated restore.
Measure and approve RTO/RPO; restore metadata and evidence objects; document
query plans, capacity, failures and residual risks.

### IR-80 — Security and compliance evidence

Maintain threat models for identity, money, webhook, documents, tenant
isolation and supply chain. Run security tests, SAST, dependency/secret/container
scans, SBOM, key inventory/rotation, privileged-access review, abuse controls,
headers review and data classification/retention. Prepare technical evidence for
applicable Russian law and contracts without self-declaring legal compliance.
Prepare external pentest scope and remediate findings. No Critical/High finding
may remain open.

### IR-90 — End-to-end industrial acceptance

Required main path:

1. Create organization and participant authority.
2. Publish lot/procurement.
3. Persist server winner and Deal Basis.
4. Create Deal and Payment Terms.
5. Reserve via bank simulator.
6. Assign verified carrier, driver and vehicle.
7. Run offline load/trip commands and reconnect.
8. Record arrival, weight, acceptance and discrepancy.
9. Record laboratory sample and protocol.
10. Exchange documents and verify signature.
11. Exchange FGIS data through the simulator.
12. Establish release basis or dispute.
13. Confirm release or controlled block.
14. Produce audit trail, evidence package and Action Receipts.
15. Reconcile with zero unexplained discrepancy.

Mandatory failures: duplicate command/webhook, out-of-order callback, revoked
key, cross-tenant read/write, stale offline command, worker crash before and
after send, 24-hour partner outage, object hash mismatch, invalid/expired
signature, DB failover, backup restore and rolling deployment during active
deals.

Every scenario requires a reproducible test, result log and exact
commit/deployment link.

## 8. Required checks per PR

Use the nearest applicable set:

- autopilot dispatcher and scope guard;
- format/lint, TypeScript typecheck and unit tests;
- module integration tests;
- Prisma validate/generate;
- forward migration on empty and baseline databases;
- drift check;
- positive/negative RLS;
- restart persistence;
- idempotency and concurrency;
- API/web build for the affected scope;
- targeted E2E;
- secret/dependency/security scans;
- exact-head CI.

Every PR records scope/files, migration impact, security/RLS impact, failure
semantics, exact check results, limitations, rollback/cutover and exact head.

## 9. Final GO/NO-GO

GO requires all of the following:

1. Every critical repository is PostgreSQL-authoritative.
2. RuntimeCore is absent from staging/production critical graphs.
3. One durable outbox and one durable inbox operate.
4. Partner credentials and subscriptions are persistent and governed.
5. Business bases and evidence are versioned/immutable.
6. Every role completes the real end-to-end deal without fixtures.
7. Offline reconnect/conflict behavior is proven.
8. Priority adapters pass conformance and simulator contracts.
9. Production configuration is fail-closed.
10. HA, load, PITR and restore have measured protocols.
11. SLO, monitoring, alerts and runbooks are accepted.
12. No Critical/High security finding is open.
13. Exact-head CI and final acceptance are green.
14. The evidence pack links commits, deployments and reports.

Automatic NO-GO conditions include process-memory authority, two competing
delivery mechanisms, memory-only webhook deduplication, production stub/mock,
unknown schema accepted as success, client authority over tenant/actor/status/
money/basis, cross-tenant access, false SENT/CONFIRMED, unexplained money
variance, unproven restore or HA/load, open Critical/High finding, non-exact or
incomplete CI, or missing audit/evidence for a critical operation.

## 10. Final artifacts

1. Current state, queue, progress and prompts.
2. Production runtime architecture.
3. Data model and migration history.
4. OpenAPI/AsyncAPI and integration dictionaries.
5. Partner simulators and conformance suite.
6. Full E2E acceptance suite.
7. RLS/RBAC/security evidence.
8. Load/soak/HA report.
9. PITR/restore/RTO/RPO report.
10. SLO, dashboards, alerts and runbooks.
11. Threat model, SBOM and pentest remediation register.
12. Activation checklist per partner.
13. Final Industrial Integration-Ready evidence pack.

## 11. Execution rule

Run packages in this dependency order:

`IR-00 → IR-10 → IR-20 → IR-21 → IR-22 → IR-30 → IR-31 → IR-32 → IR-40 → IR-41 → IR-50 → IR-51…IR-55 → IR-60 → IR-61 → IR-70 → IR-71 → IR-72 → IR-80 → IR-90`.

One PR equals one narrow work package or explicit vertical slice. Do not
auto-merge. Advance the queue only after exact-head checks and diff review.
