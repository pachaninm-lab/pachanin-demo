# PC-CROP Federal Accounting — provider-neutral EDO contract

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Base main: `aa237f085ddb9d1447a6625b586c15cc8d989ce5`

## What this slice closes

Sections 25–26 of the master contract now have a code-level provider-neutral boundary before any real Diadoc/Saby/1C-EDO credential is introduced.

Exact route vocabulary:

- `ONE_C_EDO`
- `DIRECT_DIADOC`
- `DIRECT_SABY`
- `OTHER_ADAPTER`
- `MANUAL`

Exact provider-neutral states:

- `DRAFT`
- `READY_TO_SIGN`
- `SIGNED`
- `SUBMITTED`
- `DELIVERED`
- `COUNTERPARTY_ACTION_REQUIRED`
- `ACCEPTED`
- `REJECTED`
- `CORRECTION_REQUIRED`
- `ANNULMENT_PENDING`
- `ANNULLED`
- `ERROR`
- `UNKNOWN`

The adapter surface is also pinned to the contract's nineteen operations: connect/disconnect/health, organization and counterparty resolution, route check, draft/validate/send, document/status, accept/reject/correct/annul, events and original/signature/service-document downloads.

## Routing rule: do not duplicate an existing 1C-EDO path silently

When `ONE_C_EDO` is the selected primary route, adding Diadoc, Saby or another automatic adapter is classified as a duplicate automatic channel. A manual evidence route is not an automatic provider channel.

This slice does not invent a priority between Diadoc and Saby when 1C-EDO is not the chosen path. Provider choice belongs to organization onboarding and real supported connectivity, not a hardcoded preference.

## Diadoc isolation

The binding shape is exactly one platform organization + one provider organization + one provider box.

A user/application authorization that can see several boxes does not authorize all of them. `validateDiadocBinding` requires the selected box to be in the explicitly authorized box list. A different box is denied.

No customer password field is introduced. Real authorization remains the separate official application-authorization/vendor track required by the master contract.

## Saby isolation

The binding requires one platform organization + one provider organization + one concrete provider account. Rate-limit profile persistence/behavior remains for the Integration Core persistence slice; this contract does not invent vendor limits before real API conditions are known.

## Failure direction

A timeout or connection loss after `send` becomes `UNKNOWN`, never `DELIVERED` or `ACCEPTED`.
`UNKNOWN` requires reconciliation before retry. A provider-confirmed error remains `ERROR` and is not confused with ambiguous delivery.

## What remains

1. Durable provider connection/binding/credential models under RLS/FORCE RLS.
2. Official Diadoc application authorization and exact selected box binding.
3. Official Saby API/OAuth/service authorization and exact account binding.
4. Token refresh/revoke/reauthorize paths without password storage.
5. ProviderRateLimitProfile from real written API conditions/limits.
6. Durable inbox/outbox/event dedupe and forged-callback verification.
7. Real adapter implementations that pass the same provider-neutral contract.
8. Roaming, duplicate event, outage and correction/annulment provider acceptance.
9. Only external evidence may move the Connection Center to honest TEST/CONFIRMED_LIVE.

## Claims deliberately not made

- no Diadoc/Saby/1C-EDO production connection;
- no vendor password/token stored;
- no production box/account selected;
- no provider rate limit guessed;
- no external success status;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
