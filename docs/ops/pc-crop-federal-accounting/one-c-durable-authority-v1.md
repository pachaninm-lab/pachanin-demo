# PC-CROP Federal Accounting — durable 1С authority v1

Date: 2026-08-24
Authority: #4321 (`PC-CROP-FEDERAL-ACCOUNTING`)
Tracking: #4607
Status: **DURABLE DB AUTHORITY / BOOTSTRAP ROUTES / NOT PRODUCTION**.

This slice establishes the PostgreSQL authority and the minimum bounded bootstrap surface required to pair our own local/server 1С connector. It is rebuilt on the current migration chain; the historical #4430 migrations are not inserted retroactively.

## Durable entities
- `ConnectorInstallation`: global physical/logical 1С information-base identity keyed by opaque `database_instance_id`.
- `OrganizationBinding`: exact platform organization ↔ exact 1С legal-entity GUID binding; tenant/org authority lives here.
- `PairingChallenge`: one-time, bounded-lifetime bootstrap; plaintext code is returned once and never persisted.
- `MachineCredential`: scoped verifier/lifecycle row; plaintext bearer is returned once and never persisted.

The installation table retains `tenant_id` only as a forward-only, NULL-constrained tombstone. No final authorization function reads or populates it. Global uniqueness and advisory locking use only `database_instance_id`; organization/tenant authority is binding-owned.

## Database security
- dedicated `connector` schema;
- NOLOGIN/NOBYPASSRLS authority role with no members;
- FORCE RLS on connector tables;
- ordinary runtime roles receive bounded function EXECUTE, never connector-table CRUD;
- fixed SECURITY DEFINER functions validate server-side identity/binding state;
- the connector authority has no organization UPDATE privilege or UPDATE policy; a second NOLOGIN/memberless broker owns one fixed `FOR SHARE` helper, has only column-scoped `UPDATE("updatedAt")`, and is RLS-blocked from every real update;
- canonical `public.audit_events` is reused, with secret/verifier/raw-discovery material excluded.

## Pairing invariants
- human challenge issuance is organization-member DB-proven and requires `integrations.configure` + fresh MFA at repository level;
- one pending challenge per organization;
- consume is atomic and one-time;
- pairing request does not select the platform organization or 1С organization GUID as an authority knob;
- server matches exactly one discovered legal entity by platform INN/KPP; zero or multiple matches fail closed;
- same opaque information base can expose legal entities from different tenants, but one installation/GUID cannot bind to two platform organizations;
- credential rotation revokes the previous credential in the same transaction;
- machine authentication uses exact bounded bearer syntax before lookup and verifies the persisted scope with timing-safe comparison;
- explicit binding revoke immediately revokes its active machine credential.

## Bootstrap HTTP surface

Human Connection Center routes are authenticated, no-store and user-rate-limited:
- `POST /accounting/connections/one-c/pairing-challenge`;
- `GET /accounting/connections/one-c/runtime`;
- `POST /accounting/connections/one-c/:bindingId/revoke`.

The human controller's role list is only an admission ceiling. The repository still requires a PostgreSQL-proven ACTIVE organization membership, the exact durable capability, and fresh MFA for issue/revoke. Generic GUEST access is not widened.

Connector bootstrap exposes exactly one public, IP-rate-limited route: `POST /connector/v1/pair`. Its input is an exact `{code, discovery}` object. Unknown fields, client-selected platform organization fields, malformed discovery and free-form mutation knobs fail closed. It returns the scoped bearer once with no-store headers.

Heartbeat, jobs, ACK/result/fail, events and mappings remain closed until their durable lease/idempotency state machines are accepted.

## Acceptance
The PostgreSQL acceptance suite proves replay denial, failed-discovery non-consumption, rotation, old-credential rejection, cross-tenant collision denial, organization isolation, audit redaction, authority-role isolation, exact lock-broker policy shape and denial of direct organization mutation by both connector and lock roles. Controller contracts prove the exact public boundary, unknown-field refusal and bounded error projection. The PostgreSQL suite is added to the existing `PC-CROP Accounting Core Acceptance` workflow.

## Deliberately not in this slice
- no heartbeat/jobs/ACK/result/fail/events/mappings runtime;
- no production credential or 1С traffic;
- no compiled `.cfe` extension;
- no Connection Center maturity promotion;
- no production deploy;
- no certification claim;
- no new mandatory recurring cost.
