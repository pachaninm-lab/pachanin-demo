# PC-CROP Federal Accounting — integration command contract

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Base main: `aa237f085ddb9d1447a6625b586c15cc8d989ce5`

## Purpose

Sections 55–57 require one provider-neutral rule for external effects before 1C, EDO, grain, transport or payment adapters can safely share a queue.

This slice implements that rule without creating a second Outbox/Inbox/IntegrationJob store. Persistence must extend the repository's existing durable mechanisms later.

## Command envelope

Every external command carries:

- `idempotencyKey`
- `correlationId`
- `organizationId`
- `connectionId`
- `externalId` when known
- SHA-256 `payloadHash`
- optimistic `revision`
- `attempt`

The payload hash is computed over the exact bytes handed to the integration layer. Canonicalization belongs to the domain/caller; this policy intentionally does not canonicalize a second time because two canonicalizers are two potential hashes for one business payload.

## Retry direction

Automatic retry is allowed only for explicitly transient classes:

- network failure
- timeout with a known non-ambiguous transport classification
- provider rate limit
- provider 5xx

The following are not ordinary retry:

- business rejection → `DO_NOT_RETRY`
- authorization rejection → `DO_NOT_RETRY`
- invalid payload → `DO_NOT_RETRY`
- ambiguous external result → `RECONCILE_BEFORE_RETRY`
- stale revision → `STALE_CONFLICT` / HTTP 409 semantics
- payload-hash mismatch or security hold → `SECURITY_REVIEW`

This preserves the master rule: at-least-once transport is acceptable, but the business effect must be idempotent and a business rejection must never be blindly replayed.

## Backoff and fairness

Transient retries use bounded exponential backoff with full jitter. The runtime provides randomness/clock; the policy defines the bound.

A future durable queue must carry both:

- provider partition;
- tenant partition;

plus a priority class. That gives the scheduler the data needed for provider isolation and tenant fairness rather than letting one broken provider or one large tenant monopolize the queue.

## What remains

1. Extend the existing durable outbox/inbox instead of adding competing sources of truth.
2. Durable IntegrationJob projection/state, idempotency uniqueness and optimistic revision guard.
3. Pull lease/ack/result/fail semantics for the 1C connector.
4. Provider-specific rate-limit/circuit-breaker profiles from real provider conditions.
5. Dead-letter projection and operator/accountant task.
6. 10k+ org/connection outage and recovery acceptance.

## Claims deliberately not made

- no external command was sent;
- no durable queue was created in this slice;
- no provider failure was observed;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
