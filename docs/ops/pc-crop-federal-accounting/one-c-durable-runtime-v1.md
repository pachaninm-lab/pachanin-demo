# Durable 1С connector runtime v1

Status: repository and isolated PostgreSQL evidence only. This document does not claim a production connection or “1С:Совместимо” certification.

## Scope

This layer extends the proven installation, organization-binding and rotating machine-credential authority with:

- a bounded heartbeat projection;
- durable command jobs linked to the canonical `public.outbox_entries` store;
- one active short-lived pull lease per job;
- ACK plus one bounded result or failure receipt;
- explicit reconciliation and dead-letter states.

It does not open `/connector/v1/events` or `/connector/v1/mappings`, connect to a 1С database, accept procedure/RPC/SQL names, use real 1С data, create production credentials or change the REG.RU production contour.

## Machine protocol

All machine routes are framework-public only so the connector can reach them. Each route except one-time pairing requires the rotating machine bearer in `Authorization`. Job mutation routes additionally require the one-time lease bearer in `X-One-C-Job-Lease`. HTTP collapses unknown, expired, revoked, wrong-secret and wrong-scope credentials to one `401 ONE_C_MACHINE_AUTH_REQUIRED` response.

| Route | Bounded effect |
|---|---|
| `POST /connector/v1/heartbeat` | Update one binding liveness projection using only READY/DEGRADED/BLOCKED and enumerated diagnostic codes |
| `GET /connector/v1/jobs` | Atomically lease up to 25 due jobs allowed by the persisted credential and binding capability lists |
| `POST /connector/v1/jobs/:id/ack` | Record exact delivery ACK for the current lease |
| `POST /connector/v1/jobs/:id/result` | Record CREATED_IN_1C or POSTED with a bounded external evidence identifier |
| `POST /connector/v1/jobs/:id/fail` | Record an enumerated failure class and explicit effect knowledge |

The lease bearer is `leaseId.secret`. PostgreSQL returns plaintext once and stores only a random salt plus SHA-256 verifier. Application verification uses timing-safe comparison; every mutation then rechecks current credential, binding, installation, lease, job, revision, attempt and payload-hash scope inside PostgreSQL.

## Command and queue authority

There are exactly seven protocol-v1 commands. The application and PostgreSQL repeat the same flat, scalar payload allow-lists. Unknown fields—including `sql`, `procedure`, `rpc`, `code` and dump-like payloads—are refused. Job scope is derived from the active organization membership and binding; it is never accepted from a connector report.

Enqueue is an internal repository operation and has no browser or connector HTTP route. One transaction writes the durable job, audit evidence and a canonical outbox row. The outbox row uses `PENDING` with `nextRetryAt=infinity` until the dedicated connector claims it, preventing the generic Kafka worker from competing for this pull transport. ACK advances the outbox delivery receipt to `SENT`; a conclusive result advances it to `CONFIRMED`. Connector reports are stored separately as append-only inbox-style receipts because the regulatory inbox’s provider-signature and environment contract does not match a local machine bearer.

## Lifecycle

| Job state | Sync state | Meaning |
|---|---|---|
| `QUEUED` | `QUEUED` | Durable and eligible when due |
| `LEASED` | `DELIVERED_TO_CONNECTOR` | Pull response assigned the job conservatively; receipt not yet acknowledged |
| `ACKNOWLEDGED` | `DELIVERED_TO_CONNECTOR` | Connector accepted this exact revision/attempt/hash |
| `SUCCEEDED` | `CREATED_IN_1C` or `POSTED` | Connector report includes external evidence ID |
| `REJECTED` | `REJECTED` | Bounded business rejection; no blind retry |
| `RECONCILIATION_REQUIRED` | `RECONCILIATION_REQUIRED` | Delivery/result may have taken effect |
| `DEAD_LETTER` | `REJECTED` or `RECONCILIATION_REQUIRED` | Terminal operational/security refusal |

An expired delivered lease always becomes `RECONCILIATION_REQUIRED`; it is never automatically requeued. A transient failure can auto-retry only when the connector explicitly reports `CONFIRMED_NO_EFFECT`, and attempts are bounded at 1–5 with capped jittered backoff. `UNKNOWN_RESULT` and every transient failure with unknown effect require reconciliation first.

## Human reconciliation

The safe human projection at `GET /accounting/connections/one-c/runtime/jobs` excludes command payloads, lease verifiers and secret material. `POST /accounting/connections/one-c/runtime/jobs/:id/reconcile` requires an ACTIVE PostgreSQL-proven membership, `INTEGRATIONS_CONFIGURE`, and fresh MFA. It accepts only:

- `REQUEUE_CONFIRMED_NO_EFFECT`;
- `CONFIRM_CREATED_IN_1C`;
- `CONFIRM_POSTED`;
- `CONFIRM_REJECTED`;
- `DEAD_LETTER`.

Success confirmation requires a bounded external evidence ID. Every exact action is idempotent; a conflicting replay fails closed. Requeue increments the command revision, cannot exceed the configured attempt ceiling, and is permitted only after a human has independently confirmed there was no 1С effect.

## Database boundary

`connector.one_c_runtime_state`, `connector.one_c_jobs`, `connector.one_c_job_leases` and `connector.one_c_job_receipts` use enabled and forced RLS. Ordinary application principals have no direct connector-table privileges. Fixed functions are owned by the existing memberless, NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS `pc_one_c_connector_authority` role. The migration is forward-only and adds no mandatory recurring cost.

## Remaining gates

This is not production connection evidence. Before any production use, separate exact-head acceptance must cover the supported 1С configurations, extension distribution/signing, real-but-sanitized customer acceptance under authorization, operations/monitoring/backup, security review and the official certification process. External correspondence remains restricted to chain №1097 and requires an approved draft plus an explicit send instruction.
