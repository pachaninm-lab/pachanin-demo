# PC-CROP Federal Accounting — durable 1C runtime persistence

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Stacked on: `claude/pc-crop-onec-extension-transport-20260818` / `85e485d409a4f64c2d60e741c683c8d986ebf00e`
Operational status: `NOT_ATTESTED`

## Purpose

The existing 1C slices define:

- the provider-neutral connector protocol;
- a scoped machine-identity policy;
- outbound-only 1C extension source with discovery and typed commands.

They did not yet give the server a durable authority for a real installed connector. This slice adds that authority and the minimum one-time HTTP bootstrap without inventing a second accounting source of truth or a second audit system.

## Durable entities

The `connector` PostgreSQL schema contains four lifecycle authorities.

### ConnectorInstallation

Represents one opaque 1C information-base installation, keyed by stable `databaseInstanceId`.

It is deliberately **not tenant-owned**. One 1C database may contain multiple legal entities, and those legal entities may correspond to different platform organizations/tenants. Installation metadata therefore describes the information base itself: platform/configuration/connector/protocol versions, capability vocabulary and heartbeat/pairing timestamps.

### OrganizationBinding

Maps exactly one platform organization to exactly one organization GUID inside a ConnectorInstallation.

The binding stores the verified INN/KPP/name snapshot and the allowed typed-command profile. Unique active indexes enforce:

- one active binding per platform organization;
- one active `(installation, oneCOrganizationGuid)` binding globally.

Thus the same 1C legal entity cannot authorize two platform organizations, including across tenant boundaries.

### PairingChallenge

A human with durable `integrations.configure` capability and fresh MFA may issue a short-lived one-time pairing code.

The plaintext code is returned once. PostgreSQL persists only:

- a SHA-256 lookup hash;
- a random salt;
- a salted SHA-256 verifier;
- organization/membership attribution;
- expiry and lifecycle state.

Only one PENDING challenge may exist per organization. A newer code revokes an older unused code.

### MachineCredential

Pairing mints a cryptographic `credentialId.secret` bearer. The bearer plaintext is returned once to the connector and is never stored.

Persistent credential state contains only:

- random credential ID;
- random salt;
- salted SHA-256 verifier;
- installation/binding/platform organization/1C GUID/protocol/command scope;
- issue/expiry/revoke timestamps and version.

Credential rotation revokes the previous ACTIVE credential for the binding in the same transaction.

## Server-selected binding identity

The connector pairing body has the protocol shape:

`{ code, discovery }`

There is no separate client/browser `selectedOrganizationGuid` authority.

PostgreSQL resolves the one-time code to its platform organization and then selects **exactly one** legal entity from discovery by:

1. platform organization INN;
2. platform KPP when the platform has one;
3. exact-one-match requirement.

Zero matches fail. Multiple matches fail. List order never resolves ambiguity.

The database additionally rejects:

- non-array discovery;
- empty or >500 organization arrays;
- unknown keys outside `guid`, `inn`, `kpp`, `name`;
- malformed GUID-safe identifier, INN, KPP or name;
- duplicate organization GUIDs.

This means a browser/connector cannot choose another discovered legal entity and ask the server to trust that choice.

## Cross-tenant installation isolation

A physical 1C information base is globally serialized by opaque `databaseInstanceId` during pairing. Two concurrent pairings of different legal entities in the same database therefore see one ConnectorInstallation.

Organization authority stays on OrganizationBinding and MachineCredential. The installation never grants another tenant access to a binding, credential or organization.

The negative acceptance case pairs a second tenant against the same information-base ID and same 1C organization GUID and requires PostgreSQL to refuse `ONE_C_ENTITY_ALREADY_BOUND_TO_ANOTHER_ORGANIZATION`.

## Authorization

Human operations use the narrow `withOrganizationMemberContext` transaction path:

- generic `withTrustedContext` still rejects `Role.GUEST`;
- organization-member context first establishes the authenticated user/org/tenant/session settings;
- PostgreSQL must then resolve an ACTIVE membership with `app_pc_crop_membership_id()` before work executes.

This preserves the intended accounting model `role=GUEST + job_profile=ACCOUNTANT/...` without widening GUEST across unrelated platform contours.

On top of the membership proof:

- pairing challenge requires `integrations.configure` + fresh MFA;
- binding read requires `integrations.read`;
- binding revoke requires `security.connection.revoke` + fresh MFA.

Capability is derived from durable membership job profile/delegation, never from request JSON.

## HTTP bootstrap

This slice opens only the bootstrap operations required to turn the durable authority into an installable flow.

Human side:

- `POST /accounting/connections/one-c/pairing-challenge` — capability + fresh MFA; one-time code; `no-store`;
- `GET /accounting/connections/one-c/runtime` — capability-gated safe status projection;
- `POST /accounting/connections/one-c/:bindingId/revoke` — explicit machine-safe reason code + revoke capability + fresh MFA.

Connector side:

- `POST /connector/v1/pair` — the **only public connector route in this slice**.

The pair route:

- is IP-rate-limited;
- is `no-store`;
- accepts exact top-level `{ code, discovery }` only;
- rejects unknown organization fields before repository execution;
- does not accept organizationId, tenantId, connectionId, capability or selected GUID authority from the connector;
- returns the machine bearer exactly once after PostgreSQL consumes the code.

Heartbeat, jobs, ACK/result/fail, events and mappings are still closed.

## Database authority

`pc_one_c_connector_authority` is:

- `NOLOGIN`;
- `NOINHERIT`;
- `NOSUPERUSER`;
- `NOBYPASSRLS`;
- memberless.

Ordinary application roles receive no table CRUD in `connector`.

Fixed `SECURITY DEFINER` functions expose only bounded lifecycle operations. FORCE RLS remains enabled on connector tables. Narrow identity/audit RLS policies exist for the no-login authority role because FORCE RLS intentionally makes plain grants insufficient.

## Audit

Critical pairing/binding/revoke transitions append to the existing `public.audit_events` authority. No new audit table is introduced.

Audit metadata does not contain:

- pairing code;
- machine bearer;
- salt;
- code hash / secret hash / lookup hash;
- raw discovery payload.

The database instance is represented in audit only by a SHA-256 fingerprint. Revocation reasons are bounded machine-safe codes instead of arbitrary free text.

## Machine authentication

The API repository parses only the random credential ID from the bearer to locate one verifier row. Organization, installation, binding, one-C GUID, protocol and allowed commands all come from persistent state.

Possession is then checked with the existing timing-safe machine-credential policy. A request cannot provide its own organization or command scope.

The verifier is implemented now so the next runtime slice can put heartbeat and IntegrationJob endpoints behind it without introducing another credential model.

## Acceptance

The PostgreSQL acceptance test covers:

- `role=GUEST` organization member path;
- one-time code is not stored in plaintext;
- one pending challenge per organization;
- valid binding and bearer issuance;
- bearer/verifier plaintext separation;
- pairing-code replay refusal;
- wrong INN discovery leaves the challenge unconsumed;
- correct retry rotates the machine credential;
- previous credential becomes invalid immediately;
- cross-tenant same installation/GUID collision is refused;
- organization B cannot see organization A binding;
- explicit binding revoke invalidates the active bearer;
- ONE_C audit contains none of the tested secrets/verifiers;
- connector authority remains no-login, non-superuser, non-bypass and memberless.

Focused controller contracts additionally prove that only pair is public, GUEST admission is confined to the capability-gated human management controller, unknown request fields are refused and raw database text is not surfaced.

## Still outside this slice

This is durable server authority plus one-time bootstrap, not a live integration claim.

Still required before real exchange:

1. machine-authenticated heartbeat and safe diagnostics;
2. durable IntegrationJob projection on the existing Outbox/Inbox authority;
3. lease acquisition, ACK, result/fail and reconciliation routes;
4. reproducible `.cfe` build and provenance;
5. at least one exact 1C configuration compatibility profile with a real test information base;
6. production deployment and external evidence.

No production mutation occurs in this slice. Merge/green CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
