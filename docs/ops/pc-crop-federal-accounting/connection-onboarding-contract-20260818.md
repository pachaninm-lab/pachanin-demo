# PC-CROP Federal Accounting — Connection Center onboarding contract

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Base main: `aa237f085ddb9d1447a6625b586c15cc8d989ce5`

## Purpose

Section 22 says Connection Center must ask normal business questions, not force a farmer to understand OData, OAuth or server topology.

This slice fixes those decisions in code before the settings page is built.

## Questions and outcomes

Question 1: where is accounting kept?

- 1C
- another system
- unknown

If 1C, question 2: where does 1C run?

- 1C:Fresh
- local/server
- service company
- unknown

The decision paths are:

- Fresh → Fresh connection track;
- local/server → local 1C connector track;
- service company → send to the servicing 1C administrator/company;
- other accounting → manual/other-adapter track;
- unknown → send to accountant and/or 1C administrator.

“Не знаю” is therefore a supported route, not an error or a technical dead end.

## Connection statuses

The public status vocabulary is pinned exactly:

- NOT_CONNECTED
- CONNECTING
- HEALTHY
- DEGRADED
- ACTION_REQUIRED
- OFFLINE
- REVOKED
- SECURITY_HOLD

The public card shape has five safe fields only: kind, status, title, safe description and next action. It cannot carry OData, OAuth scopes, `client_secret`, endpoint or refresh token.

## What remains

1. `/platform-v7/settings/connections` page and route registration.
2. Read current server-authoritative Connection Center state through the bounded BFF.
3. Render the wizard and handoff actions.
4. Pairing/machine-identity runtime before any “Подключить 1С” mutation becomes AVAILABLE.
5. Official EDO provider authorization before direct Diadoc/Saby mutations become AVAILABLE.
6. Safe diagnostics preview/send and explicit action-state rendering.

## Claims deliberately not made

- no real 1C/EDO connection is created;
- no email/handoff is sent;
- no secret or endpoint is read;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
