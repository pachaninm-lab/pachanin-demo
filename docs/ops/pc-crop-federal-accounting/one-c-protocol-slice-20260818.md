# PC-CROP Federal Accounting — 1C connector protocol slice

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Base main: `aa237f085ddb9d1447a6625b586c15cc8d989ce5`

## What this slice closes

This is the first concrete Wave 6 slice after the provider-neutral Connection Center and attestation were merged.
It implements the offline-buildable protocol contract for our own local/server 1C connector without claiming a live 1C integration.

The contract now fixes:

- exactly seven typed commands from the master execution contract;
- the `/connector/v1/*` route vocabulary;
- self-discovery fields, including one database exposing multiple legal entities;
- explicit `OneCCompatibilityProfile` values: `BSHP_3`, `KFH`, `BP_3`, `ERP`, `KA`, `UT`, `UNKNOWN`;
- organization binding to one explicitly discovered 1C organization GUID;
- a high-entropy, one-time pairing primitive with TTL and salted SHA-256 verification;
- sync states `QUEUED`, `DELIVERED_TO_CONNECTOR`, `CREATED_IN_1C`, `POSTED`, `REJECTED`, `RECONCILIATION_REQUIRED`, `UNKNOWN`;
- `CREATE_DRAFT` as the fail-closed default and `AUTO_POST` only with separate exact-installation/configuration acceptance evidence;
- timeout/network ambiguity → `UNKNOWN`, never success;
- `UNKNOWN` cannot be blindly re-queued before reconciliation.

## Security boundary proven by code

The protocol cannot represent arbitrary SQL, arbitrary code execution, a database dump or unrestricted record reads.
Unknown payload keys are refused instead of ignored, so a valid typed command cannot be widened by smuggling an extra `sql`/`code`/`dump` field beside it.

The binding is organization-specific. A connector installation may discover several legal entities in one 1C database, but a binding to one of them grants nothing about the others. The next machine-identity slice must carry this exact binding in its scoped credential.

Pairing stores only a salted hash. This slice intentionally does **not** pretend the pure verification function is atomic consumption; the next persistence slice must consume the challenge under a database guard/transaction and issue a scoped machine identity.

## What remains before `/connector/v1/*` may be exposed in runtime

1. Durable `ConnectorInstallation` and `OrganizationBinding` persistence under RLS/FORCE RLS.
2. One-time pairing challenge persistence with atomic consume and replay refusal.
3. Scoped machine identity/credential that is bound to installation + connection + platform organization + 1C organization GUID.
4. Durable `IntegrationJob` queue with idempotency/correlation/revision/attempt and pull semantics.
5. Controller/guard for the eight `/connector/v1/*` routes.
6. Heartbeat and safe diagnostics metadata.
7. Mapping persistence and explicit mapping authority.
8. A real 1C extension/client that speaks this protocol and passes the shared transport/connector contract suite.
9. Compatibility acceptance against supported configurations before any profile is marketed as supported.
10. Only after external evidence may Connection Center move through `ADAPTER_READY` → `TEST` → `CONFIRMED_LIVE`.

## Claims deliberately NOT made

- no universal 1C compatibility;
- no `1C:Совместимо` certification;
- no 1C:Fresh publication;
- no live customer database tested;
- no vendor credential or external response exists;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
