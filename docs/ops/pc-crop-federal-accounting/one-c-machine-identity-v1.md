# PC-CROP Federal Accounting — 1С scoped machine identity v1

Date: 2026-08-24  
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`  
Master issue: #4321  
Tracking: #4607  
Stacked on: `feat/one-c-compatible-connector-4607`

Status: **POLICY ONLY / NOT PERSISTED / NOT ROUTED / NOT PRODUCTION**.

## Purpose

After one-time pairing the local/server 1С connector must authenticate as a narrowly scoped machine, never as a farmer, accountant, administrator or broad tenant service account.

The bearer proves possession only. Authorization remains in a server-owned record so revocation, organization binding and command scope cannot be widened by editing a self-contained token.

## Bearer and persistent shape

Issued bearer format is exactly:

`credentialId.secret`

where:

- `credentialId` is an exact UUID-shaped identifier;
- `secret` is 32 cryptographically random bytes encoded as 43 base64url characters;
- total bearer length is exactly 80 characters;
- the persistent record contains only credential id, random 16-byte hex salt, SHA-256 verifier, scope and lifecycle timestamps;
- plaintext secret is returned once and is never part of the persistent shape;
- secret comparison is timing-safe.

Malformed or oversized bearer input is rejected before it can become an unbounded hashing input.

## Server-owned scope

A credential is bound to the exact tuple:

- connector installation id;
- connection id;
- platform organization id;
- exact 1С organization GUID;
- connector protocol version;
- explicit subset of the canonical seven 1С commands.

The bearer itself contains none of those authority claims.

## Fail-closed rules

Verification denies when any of the following is true:

- malformed persistent record;
- malformed bearer or wrong secret;
- not-yet-valid credential;
- expired credential;
- revoked credential;
- installation/connection/platform organization/1С legal-entity mismatch;
- protocol mismatch;
- command not present in the server-owned allowed-command set.

Persistent integrity is also checked: credential id and salt must have their exact generated shapes, expiry must be after issuance, revocation cannot predate issuance and record version must be a positive integer.

## Revocation

Revocation is modeled as an immutable server-side value change with an optimistic version increment. An already revoked value is idempotent at policy level. The future database transaction remains authoritative for concurrent revoke/rotate behavior.

Every future `/connector/v1/*` request must resolve the current persisted credential record. Caching a self-contained authorization token in front of revocation would weaken this contract and is not allowed.

## What this slice deliberately does not do

- no Prisma schema or migration;
- no credential table;
- no pairing endpoint or machine-auth guard;
- no `/connector/v1/*` runtime route;
- no 1С traffic;
- no compiled `.cfe`;
- no customer credential;
- no Connection Center maturity change;
- no production deployment;
- no claim of `1С:Совместимо` certification.

## Required next proof before runtime authentication

1. Durable ConnectorInstallation and OrganizationBinding authority.
2. Atomic one-time pairing consumption + credential issuance/rotation.
3. RLS/FORCE RLS or equivalent server-enforced organization boundary.
4. Machine bearer lookup on each protected connector request.
5. Audit events for issue/rotate/revoke/denied scope use without secret leakage.
6. Durable IntegrationJob/lease semantics before jobs/ACK/result/fail routes open.
7. Exact production-like and real 1С acceptance before any live claim.

New mandatory recurring cost: **0 ₽**.
