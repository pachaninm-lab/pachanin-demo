# PC-CROP Federal Accounting — IntegrationJob pull-lease contract

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Stacked on: PR #4421 / `0ae02939e08e18f61e887d60953123104008b4f5`

## Purpose

The master contract requires asynchronous integrations, pull jobs for the local 1C connector, idempotent business effects and no blind retry after an ambiguous external result.

PR #4421 defines the command envelope and retry classification. This slice adds the next missing execution boundary: how one durable job is leased to one machine for a bounded time, how that machine proves possession, and how one lease can report at most one terminal result.

No new queue or database authority is created here. The future repository must extend the existing durable Outbox/Inbox mechanisms.

## Exact lease scope

A lease is bound to:

- tenant partition;
- provider partition;
- platform organization;
- connection;
- machine credential id;
- job id;
- command idempotency key;
- correlation id;
- payload hash;
- optimistic revision;
- attempt.

The bearer itself contains only `leaseId.secret`. It does not carry tenant/org/connection/provider claims that the connector could edit.

Persistent lease shape stores only a random salt and SHA-256 verifier. Verification is timing-safe.

## Pull/ACK/result semantics

1. The repository atomically chooses a queued job and issues a short lease.
2. The connector receives the bearer with the job.
3. ACK is idempotent and records that the connector accepted ownership.
4. The same valid lease may report one terminal connector result.
5. A second terminal report is refused.
6. An expired lease cannot ACK or report a result.

The contract does not require ACK to be a second authorization source. Possession of the valid scoped lease is the authorization proof; ACK is operational evidence.

## Terminal result vocabulary

- `REPORTED_SUCCESS`
- `BUSINESS_REJECTION`
- `UNKNOWN_RESULT`

`REPORTED_SUCCESS` is deliberately not named `CONFIRMED_LIVE`. It requires an external evidence identifier from the connector side, but that identifier alone is not enough to promote Connection Center to live. Connection Center still needs its separate evidence ladder and real external confirmation.

`UNKNOWN_RESULT` remains reconciliation-required.

## Why expired lease is not automatic retry

A connector may have committed the 1C/EDO/provider operation and then lost the response. Therefore:

lease expires after delivery → `RECONCILIATION_REQUIRED`

not:

lease expires → blindly queue again.

That is the anti-duplicate business-effect rule required by the master contract.

## Secret/log safety

Terminal result uses a bounded uppercase machine-safe code. Free-text provider errors, passwords, tokens and secret-bearing diagnostic strings do not belong in this contract.

## What remains

1. Durable IntegrationJob projection using existing Outbox/Inbox authority.
2. Atomic database lease acquisition with row/version lock and uniqueness.
3. Credential + lease verification in the `/connector/v1/jobs*` guard.
4. Durable ACK/result/fail transitions and audit.
5. Reconciliation command for expired/unknown jobs before requeue.
6. Fair scheduler using provider + tenant partitions from #4421.
7. Dead-letter projection and human accounting task.
8. 10k+ organization/provider-outage recovery acceptance.

## Claims deliberately not made

- no job was persisted;
- no connector runtime endpoint was exposed;
- no external system was contacted;
- no provider success was promoted to live;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
