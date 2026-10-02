# PC-CROP Federal Accounting — integration event metadata-only exposure

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Base main: `aa237f085ddb9d1447a6625b586c15cc8d989ce5`

## Why this slice is P0

The existing generic `IntegrationEvent` path accepted arbitrary `requestPayload`, `responsePayload` and exception text, persisted them, and the staff event endpoint returned the whole database row. That is incompatible with the master invariants `secret_leakage_to_logs = 0` and the requirements that support is metadata-only by default and that security/integration telemetry excludes secrets and unnecessary sensitive payloads.

This slice closes the default forward-looking leak path without creating another event/audit store.

## Write-side change

`IntegrationEventsService.log()` no longer persists the original request or response value.

Instead it stores structural metadata only:

- value kind;
- array item count or object field count;
- string length;
- bounded/truncated marker.

It deliberately does **not** persist:

- object field names;
- scalar values;
- samples;
- raw JSON;
- hashes of raw values.

The last point is intentional: a hash of a low-entropy password or identifier can still be sensitive and can be brute-forced.

Free-text exception messages are not persisted verbatim. A bounded uppercase machine-safe code may survive; all other text collapses to `INTEGRATION_ERROR`.

If the telemetry insert itself fails, the logger emits only the generic text `Integration event log write failed`; it does not echo the database exception because a rejected-row error can include row values.

## Read-side change

`GET /api/integration-events` and `GET /api/integration-events/:id` now return an explicit metadata projection only:

- event id;
- adapter;
- direction;
- event type;
- status;
- HTTP status;
- duration;
- safe error code;
- timestamp.

They do not return request payload, response payload, raw error text, external id, deal id or idempotency key.

The projection is explicit rather than `{...row}`. Therefore adding a sensitive column to the database later does not make it escape automatically.

The list endpoint also rejects malformed time ranges and `take` values outside 1–500 instead of silently degrading to an empty result after a Prisma error.

## Existing historical rows

This code prevents new default writes/exposure but does not delete or rewrite historical `integration_events.request_payload`, `response_payload` or `error_message` rows. A separate governed data-cleanup/retention slice is still required before claiming the historical store is fully sanitized.

Until that cleanup is proven, the staff API no longer exposes those historical raw fields.

## What remains

1. Add tenant/organization ownership to integration event authority where the event is organization-scoped, extending the existing model rather than duplicating it.
2. RLS/FORCE RLS for organization-scoped integration event rows where applicable.
3. Governed historical scrub/retention migration with evidence.
4. Separate JIT/evidence workflow if security/compliance ever needs bounded raw provider evidence; do not reopen raw payloads on this default endpoint.
5. Structured correlation id and safe provider/connection identifiers for fleet tracing.
6. Security event/audit linkage for connector/provider revoke/rebind and denied cross-scope operations.

## Claims deliberately not made

- historical event payloads are not claimed scrubbed;
- this telemetry table is not promoted to legal/business authority;
- no provider/1C/EDO request was sent;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
