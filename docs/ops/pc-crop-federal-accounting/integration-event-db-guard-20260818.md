# PC-CROP Federal Accounting — database guard for integration telemetry

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Stacked on: PR #4423 / `1bad00abaf7219d34c9b19f677a66a688688150c`

## Why application redaction alone is not enough

PR #4423 changes the known `IntegrationEventsService` writer to store structural metadata only and changes the staff endpoint to return a metadata-only projection.

That is necessary but not sufficient for the master invariant `secret_leakage_to_logs = 0`: another direct Prisma/raw SQL writer added later could bypass that service and insert a provider request, response or free-text exception into the same existing `integration_events` table.

This slice adds the database backstop to the existing table. It does **not** create a second telemetry/audit store.

## What PostgreSQL now accepts for new/updated rows

`requestPayload` and `responsePayload` may be SQL NULL or one exact structural metadata object:

- `NULL`
- `NUMBER`
- `BOOLEAN`
- `OTHER`
- `ARRAY` + bounded item count + truncated flag
- `OBJECT` + bounded field count + truncated flag
- `STRING` + bounded length + truncated flag

No original scalar, object field name, sample, raw JSON or arbitrary extra key satisfies the CHECK.

`errorMessage` may be SQL NULL or one bounded machine-safe uppercase code. Free-text exception detail is rejected at the database boundary.

## Why constraints are NOT VALID

All three CHECK constraints are added `NOT VALID` deliberately.

In PostgreSQL that means:

- every new INSERT is checked immediately;
- every future UPDATE of a row is checked immediately;
- existing historical rows are not scanned/rejected during this migration.

This is the correct boundary for this slice. Historical telemetry may intersect retention, incident evidence or legal hold. Rewriting/deleting it requires a separate governed cleanup decision. Until then PR #4423 already prevents the default staff endpoint from returning raw historical payload/error fields.

The migration contains no UPDATE/DELETE against `integration_events` and no `VALIDATE CONSTRAINT`.

## Defence in depth

The database validator is deliberately stricter than “is JSON”. It checks:

- top-level value must be an object;
- exact metadata key count;
- required keys by kind;
- numeric counts are non-negative integers within the same application bounds;
- truncated is a JSON boolean;
- unknown kind fails closed;
- malformed input returns false rather than throwing open.

Application redaction stays the first line because it can give clean telemetry. PostgreSQL is the last line because it sees every writer.

## What remains

1. Governed historical scrub/retention/legal-hold decision.
2. Validate the NOT VALID constraints only after historical rows are proven compliant or intentionally transformed.
3. Add tenant/organization ownership + RLS/FORCE RLS to organization-scoped integration telemetry.
4. If raw provider evidence is ever legally/security required, store it through a separate bounded evidence/JIT path rather than reopening default telemetry.

## Claims deliberately not made

- historical raw telemetry is not claimed scrubbed;
- the constraints are not claimed validated against history;
- no provider/1C/EDO traffic was sent;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
