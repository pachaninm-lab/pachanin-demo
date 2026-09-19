# Platform V7 Real Operation Readiness Alignment

Status: **architecture/audit only**. This document changes no runtime code.

Linked work:
- Standing queue: #1974
- Real-operation readiness: #1982
- Product/UX/system audit: #1981
- Seller cabinet pass: #1976
- Review gate: #1978
- QA smoke gate: #1979

## Purpose

The shell/cabinet UX audit is necessary but not sufficient. A platform that must support real organizations, high concurrent usage and real deal execution cannot be judged by role screens alone.

This alignment makes the boundary explicit:

- UX/shell/cabinet work improves operator clarity and reduces front-end confusion.
- Real readiness requires persistent state, server-side access control, auditable runtime actions, operational monitoring and integration paths.
- Do not present the current contour as live-ready until those runtime layers are implemented and verified.

## Readiness domains that must not be hidden inside UI PRs

Each domain must be delivered as its own narrow implementation or audit PR:

1. **Data**
   - durable database-backed deal state;
   - entities for organizations, users, roles, lots, bids, deals, documents, logistics, quality, payments, disputes, evidence and audit.

2. **Access**
   - server-side role and organization checks;
   - tenant isolation;
   - denied-action logging;
   - no reliance on frontend-only role selection.

3. **Runtime**
   - deal state machine;
   - idempotent actions;
   - concurrency handling;
   - action receipts;
   - event journal.

4. **Money**
   - ledger basis;
   - reserve, hold, release, refund and commission states;
   - bank reconciliation basis;
   - no unsupported fund-release claims.

5. **Documents and evidence**
   - document matrix by role and deal stage;
   - versioning;
   - approval/signature basis;
   - evidence chain for disputes;
   - immutable audit trail.

6. **Logistics, quality and acceptance**
   - рейс lifecycle;
   - weight and quality tolerances;
   - elevator, lab, surveyor and driver evidence flows;
   - offline-safe proof capture plan.

7. **Integrations**
   - bank, EDO, FGIS/SDIZ, EPD, GPS, elevator and lab adapter modes;
   - mock, pre-integration and live modes clearly separated;
   - retries, timeouts, rate limits and failure handling.

8. **Load and operations**
   - load test plan for high concurrent usage;
   - latency budgets;
   - queues/background jobs;
   - caching and rate limiting;
   - logs, metrics, alerts, rollback and incident workflow;
   - backup and restore.

9. **Legal and compliance readiness**
   - legal basis for real transactions;
   - data retention;
   - support and escalation process;
   - partner credential and contract gates.

## UX audit acceptance now tied to real-readiness

A role cockpit is not accepted just because it looks finished. It must honestly expose operational state:

- what happened;
- what is blocked;
- money at risk;
- responsible party;
- next safe action;
- whether the data is mock, pre-integration or live;
- whether an action is executable, blocked or pending external integration.

## Review rule

A PR must declare its type in the description:

- UI
- data
- runtime
- access
- money
- documents
- integration
- load
- ops
- QA
- docs

UI PRs must not silently modify backend, DB, auth, session, API, package files or lockfiles. Runtime PRs must not be disguised as cabinet polish.

## Honesty rule

Do not claim:

- production-ready;
- fully live;
- secure server-side cabinet isolation;
- real fund release;
- live partner integration;
- thousands-user readiness.

Allowed framing until runtime layers exist:

- moving toward real-operation readiness;
- frontend/cabinet layer under controlled execution;
- runtime, access, data, integration, load and ops layers are explicit required tracks.
