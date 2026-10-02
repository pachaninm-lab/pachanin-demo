# PC-CROP Federal Accounting — Connection Center BFF read path

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Base main: `aa237f085ddb9d1447a6625b586c15cc8d989ce5`

## What changed

The backend already exposes server-authoritative, read-only Connection Center data at:

- `GET /accounting/connections`
- `GET /accounting/connections/attestations`

The web accounting BFF previously refused both, so a future self-service page could not read them without bypassing the existing bounded proxy.

This slice adds only those two exact GET paths to the BFF allowlist.

## What stays closed

The write allowlist is unchanged. In particular the BFF still refuses:

- `POST /accounting/connections`
- `POST /accounting/connections/attestations/subjects`
- gate-attestation writes
- every other unlisted API route.

That preserves the current rule: the surface displaying connection state cannot promote its own green tick.

The proxy remains:

- session-cookie authenticated;
- explicit-allowlist only;
- no-cache;
- redirect refusing;
- stateless;
- fail-closed to `ACCOUNTING_SERVICE_UNAVAILABLE` when the API cannot be reached.

## Why this is the next UI prerequisite

Section 22 requires `/platform-v7/settings/connections`; section 53 requires mass self-service without our employee. Before that page exists it needs a safe read path to the Connection Center. This slice provides that plumbing but does not yet create the page or connection mutations.

## Claims deliberately not made

- no settings page exists from this slice;
- no 1C/EDO connection can be created from this slice;
- no provider status is changed;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
