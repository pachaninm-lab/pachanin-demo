# PC-CROP Federal Accounting — scoped 1C machine identity

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Stacked on: `claude/pc-crop-onec-protocol-20260818` / `d1d70372e3cb80b20eacaad00d7b9a6f4b65d9c1`

## Why this exists

The master contract says that after one-time pairing the 1C connector receives a **scoped machine credential**. It must not run as the farmer, accountant or a broad tenant service account.

This slice defines that identity boundary before a route or credential table can accidentally make it broader.

## Persistent authority, not token claims

The bearer is `credentialId.secret`. It contains no organization, role, 1C GUID or command list.
Those claims live only in the server-owned record:

- connector installation id;
- connection id;
- platform organization id;
- exact 1C organization GUID;
- protocol version;
- allowed typed commands;
- issued / expiry / revocation timestamps;
- optimistic version.

This is deliberate. A self-contained bearer token with organization claims would make the token itself an authority copy. A server-owned record gives immediate revocation and one answer to “what is this machine allowed to do?”.

The secret is generated with cryptographic randomness. Persistent state stores only a random salt and SHA-256 verifier. Comparison is timing-safe. The plaintext secret is returned only once.

## Isolation properties

One 1C database may expose several legal entities. A credential bound to one exact 1C organization GUID is denied when presented for another GUID, even if the installation and database are the same.

The same exact-match rule applies to:

- installation;
- connection;
- platform organization;
- 1C legal entity;
- protocol version.

A job command can additionally be checked against the binding's allowed command profile.

## Failure direction

- wrong secret → deny;
- wrong credential id → deny;
- cross-organization scope → deny;
- expired → deny;
- revoked → deny immediately;
- protocol drift → deny;
- malformed persistent verifier → deny, not throw open;
- command not in profile → deny.

## What remains before this may authenticate `/connector/v1/*`

1. Durable credential/binding persistence under organization-scoped RLS/FORCE RLS.
2. Atomic pairing consume + credential issue in one server-side transaction.
3. Credential lookup by id on every request, with revocation/expiry checked from persistent state.
4. Durable IntegrationJob queue and idempotency keys.
5. Controller guard binding request context to this exact machine scope.
6. Audit events for pairing, issue, rotation, revoke, denied cross-scope access and job transitions.

This slice creates no runtime route and therefore cannot make Connection Center report `ADAPTER_READY`.

## Claims deliberately not made

- no live 1C adapter;
- no credential stored in production;
- no customer 1C database contacted;
- no universal compatibility;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
