# PC-CROP Federal Accounting — self-service support contracts

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Base main: `aa237f085ddb9d1447a6625b586c15cc8d989ce5`

## Safe diagnostics from §53

A client must be able to send support useful information without sending the contents of the 1C database or credentials.

The diagnostic preview therefore contains exactly five fields:

- connector version;
- configuration version;
- last heartbeat timestamp;
- pending job count;
- bounded machine-safe error codes.

The same object is intended to be shown to the user before any future “Отправить диагностику” action sends it. An exact-shape guard rejects extra fields such as a database dump, password, private key, OAuth token, client secret, endpoint or arbitrary payload.

Free-text logs are not accepted as `safeErrorCodes`: codes use a bounded uppercase machine vocabulary only. Repeated codes are deduplicated.

## Action contract from §61

Every future integration button has one explicit state:

- `AVAILABLE`
- `DISABLED_WITH_REASON`
- `RUNNING`
- `UNKNOWN_RESULT`
- `FAILED`
- `SUCCEEDED`

Rules are fail-closed:

- disabled requires a human-readable reason;
- failed requires a reason;
- unknown result requires an explanation/reconciliation next step and is never success;
- running requires a correlation id;
- a sensitive action must declare a full confirmation dialog requirement;
- only `AVAILABLE` is a state from which a mutation may start;
- only explicit `SUCCEEDED` counts as terminal success.

This removes silent-disabled and silent-failure behavior before UI implementation begins.

## What remains

1. Render these states in Connection Center and accounting task UI.
2. Wire safe diagnostics to server-authoritative connector heartbeat/job state.
3. Let the user preview exactly what will be sent.
4. Add the future support-send command with audit, rate limit and no secret fields.
5. Apply the action contract to connect/check/revoke/reauthorize/map/send/retry buttons.
6. Full confirmation dialog for sensitive connector/provider actions.

## Claims deliberately not made

- no diagnostics were sent anywhere;
- no connection state was changed;
- no secrets were read;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
