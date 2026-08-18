# PC-CROP Federal Accounting — read-only self-service Connection Center UI

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Stacked on: PR #4418 / `7d725d7bfbd4ecebc2ebef12530af8b8493c0a47`

## What this slice adds

The required route now exists as a real protected screen:

`/platform-v7/settings/connections`

It reads the existing server-authoritative Connection Center through the bounded accounting BFF from PR #4418. It owns no connection state and uses no local cache/fallback authority.

The screen answers in human language:

- what connection this is;
- what is actually confirmed now;
- what is still missing;
- whether independent checks are complete;
- whether real exchange is externally confirmed.

The only active control is **«Проверить статус»**. It re-reads the server state; it does not send a command to 1C/EDO or treat HTTP success as provider success.

## Honest maturity rendering

The UI preserves the existing evidence ladder instead of inventing a second status system:

- `NOT_ATTESTED` → «Ещё не готово»;
- `ADAPTER_READY` → «Подготовка завершена», but explicitly not real exchange;
- `TEST` → «Тестовый обмен подтверждён», but explicitly not real exchange;
- `CONFIRMED_LIVE + mayCarryRealTraffic=true` → «Реальный обмен подтверждён».

If the server ever returns `mayCarryRealTraffic=true` with a lower maturity, the presentation fails closed and shows «Требуется проверка статуса» rather than turning green.

Unknown maturity also fails closed.

## No fake FGIS/transport state

The current Connection Center backend models `ONE_C`, `EDO` and `BANK_STATEMENT`. It does not yet return FGIS «Зерно» or transport EPD as Connection Center kinds.

The page still names those required future areas, but says only that the platform does not yet show a confirmed status for them on this screen. It does not manufacture `NOT_CONNECTED`, `HEALTHY` or any other state.

## No technical/secret surface

The page does not display OData, OAuth scopes, client secrets, endpoints, refresh tokens, raw provider codes or XSD details.

«Подключить 1С», «Подключить ЭДО», «Отправить бухгалтеру» and «Отправить администратору 1С» are visible but disabled with an explicit human reason because the corresponding server mutations are not opened yet. There is no silent disabled button.

## Route/RBAC boundary

The route is registered as one exact Design System v8 route. `/platform-v7/settings` and arbitrary sibling settings paths remain unknown.

Coarse cabinet access admits seller/buyer and the existing oversight/control roles that can need connection state. Field-only roles are refused before render. `GUEST` remains the organization cabinet role, and the protected layout now permits the Connection Center path so an accountant represented as `role=GUEST, job_profile=ACCOUNTANT` is not blocked at the shell before server capability/RLS can decide.

This is only the coarse web fence. API membership/capability/RLS remains authority.

## Failure direction

If either Connection Center read fails, the screen removes connection cards and shows an unavailable state. It does not keep yesterday's connection status on screen as current.

## What remains before self-service connection is functional

1. Merge/land the #4418 GET-only BFF prerequisite.
2. Durable 1C installation/binding/pairing/machine-credential persistence and guarded `/connector/v1/*` runtime.
3. Official EDO organization/box/account authorization persistence.
4. Server commands for connect/revoke/reauthorize and their action-state contracts.
5. «Отправить бухгалтеру / администратору 1С» server command + audit/rate limits.
6. Safe diagnostics preview/send from the separate self-service diagnostics contract.
7. FGIS and transport connection read models in the same Connection Center authority.
8. External evidence before any connection is shown as real/live.

## Claims deliberately not made

- no connection was created or revoked;
- no 1C/EDO provider was contacted;
- no FGIS/transport status was invented;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
