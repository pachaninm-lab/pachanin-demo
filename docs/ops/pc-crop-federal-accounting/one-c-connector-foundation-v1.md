# 1С:Совместимо — connector foundation v1

Status: **FOUNDATION / NOT CONNECTED / NOT CERTIFIED**  
Master authority: #4321  
Tracking: #4607  
Date: 2026-08-24

This is an implementation contract, not a compatibility or certification claim. `ONE_C.adapterImplemented` remains false. Connection Center remains the authority for live-connection maturity; no profile, unit test or successful CI run may by itself produce `ADAPTER_READY`, `TEST` or `CONFIRMED_LIVE`.

## 1. Certification facts checked before implementation

Official 1С sources used for the design:

- Certification requirements: https://1c.ru/rus/products/1c/predpr/compat/soft/requirements.htm
- Certification conditions: https://1c.ru/rus/products/1c/predpr/compat/soft/condition.htm
- REST/OData interface: https://v8.1c.ru/platforma/rest-interfeys/
- HTTP services: https://v8.1c.ru/platforma/http-servisy/
- Integration capabilities: https://v8.1c.ru/platforma/integraciya/
- Licensing FAQ / documented-access boundary: https://v8.1c.ru/priobretenie-i-vnedrenie/otvety-na-tipovye-voprosy-po-litsenzirovaniyu-1s-predpriyatiya-8/

The certification target must be reproducible and configuration-specific. Before submission we must pin the supported 1С platform version, exact configuration/editor/version/release, installation and connection procedure, interaction technology, examples, user guide and a reproducible demonstration/test procedure. Direct DBMS access is outside this design.

## 2. Network topology

Primary topology: **customer 1С -> outbound HTTPS -> Прозрачная Цена**.

The customer's 1С side initiates Internet communication. The platform does not require a public inbound hole into the customer's 1С host, does not require public OData publication and does not connect directly to the 1С DBMS.

This topology is selected because it works behind NAT/firewalls, keeps 1С credentials inside the customer's environment, supports bounded pull/ack/result semantics and separates transport from configuration-specific object mappings.

OData and custom 1С HTTP services remain valid profile-level mechanisms where a supported configuration genuinely needs them, but they are not the default Internet boundary.

## 3. Canonical protocol v1 routes

The recovered master execution contract defines exactly these routes:

- `POST /connector/v1/pair`
- `POST /connector/v1/heartbeat`
- `GET /connector/v1/jobs`
- `POST /connector/v1/jobs/:id/ack`
- `POST /connector/v1/jobs/:id/result`
- `POST /connector/v1/jobs/:id/fail`
- `POST /connector/v1/events`
- `POST /connector/v1/mappings`

There is no generic RPC endpoint. Adding a route is a versioned protocol/security change.

## 4. Exact seven-command allowlist

The previously governed master 1С protocol (#4413) was recovered and inspected instead of inventing the two missing commands. The canonical v1 allowlist is exactly:

1. `UPSERT_COUNTERPARTY`
2. `CREATE_SALES_DRAFT`
3. `CREATE_PURCHASE_DRAFT`
4. `CREATE_CORRECTION_DRAFT`
5. `GET_DOCUMENT_STATUS`
6. `PUSH_PAYMENT_STATUS`
7. `GET_REFERENCE_CANDIDATES`

Unknown commands fail closed. Each command has an explicit required/allowed payload shape; unknown payload fields are refused rather than ignored. `GET_REFERENCE_CANDIDATES` is bounded to a maximum result limit and is not an unrestricted database read.

Explicitly forbidden protocol surfaces include arbitrary SQL, arbitrary 1С code, dynamic procedure execution, shell/process execution, full information-base dump and unrestricted record reads.

## 5. Self-discovery and compatibility

`OneCSelfDiscovery` reports only bounded connector facts required to establish compatibility and organization binding:

- 1С platform version;
- configuration name and version;
- opaque information-base instance identifier;
- discovered legal entities (`guid`, `inn`, optional `kpp`, `name`);
- advertised subset of the seven supported commands;
- connector version;
- protocol version.

A discovery report with the wrong protocol version, no legal entity, duplicate legal-entity GUID or unknown capability is rejected.

The protocol has explicit compatibility profile vocabulary:

- `BSHP_3`
- `KFH`
- `BP_3`
- `ERP`
- `KA`
- `UT`
- `UNKNOWN`

These names are compatibility classifications, not proof that a particular release has passed acceptance. Until an exact configuration/release is tested, the profile must not be promoted into a live-support claim.

## 6. One information base, several legal entities

One 1С information base may expose several legal entities. Discovery of those entities does **not** authorize them all.

A binding explicitly names:

- one platform organization;
- one discovered 1С organization GUID;
- one connector installation;
- one connection;
- one capability subset;
- one compatibility profile;
- one binding status.

A binding cannot claim a GUID that the connector did not discover and cannot enable a capability the connector did not advertise. The durable persistence slice must preserve this exact authorization boundary and add PostgreSQL/RLS enforcement rather than trusting tenant/org coordinates supplied by a browser or connector.

## 7. Pairing bootstrap

The protocol contains a high-entropy one-time pairing primitive:

- default lifetime: 10 minutes;
- random secret is returned only to the pairing caller;
- persistent shape contains random salt + SHA-256 verifier, not plaintext code;
- comparison is timing-safe;
- consumed or expired pairing material is rejected;
- TTL is bounded and cannot be extended beyond one hour by the primitive.

This foundation slice defines and tests the primitive only. It does **not** persist pairing rows or issue a production machine credential. Durable atomic consumption, rotation and revocation belong to the next persistence slice.

## 8. Draft-first document safety

`CREATE_DRAFT` is the default and fail-closed posting mode.

`AUTO_POST` becomes effective only when separate server-side acceptance evidence matches the exact connector installation and exact configuration version. A connector cannot opt itself into automatic posting.

Document jobs carry stable document/version identifiers, payload hash and format revision. Payment amounts remain whole minor-unit strings (`amountKopecks`), never floating-point money.

## 9. Ambiguous result handling

External HTTP success is not business success.

The sync vocabulary includes `QUEUED`, `DELIVERED_TO_CONNECTOR`, `CREATED_IN_1C`, `POSTED`, `REJECTED`, `RECONCILIATION_REQUIRED` and `UNKNOWN`.

Timeout, network loss or an ambiguous external effect maps to `UNKNOWN`, never success. `UNKNOWN` cannot jump directly back to `QUEUED`; reconciliation is mandatory before retry. Terminal `POSTED` and `REJECTED` states cannot drift back into execution.

This rule prevents duplicate 1С documents after a timeout that happened after 1С had already committed the effect.

## 10. Mapping profiles: accounting and elevator are separate

The generic connector core must not contain configuration-specific object names before the certification baseline is fixed.

### Accounting profile

The first certification profile will be built for the exact configuration/release agreed with 1С. Candidate business objects already represented by the canonical protocol are counterparties, sales/purchase/correction drafts, document status, payment status and bounded reference matching. 1С-ЭДО can be layered later without changing the transport security boundary.

### CPS / elevator profile

The existing «ЦентрПрограммСистем» material describes a deeper internal enterprise contour: acceptance/shipment, quantitative-quality accounting, laboratory, scales, silos/warehouses, production, accounting/tax, settlements, transport/equipment and related operational facts. That remains a separate compatibility/mapping profile.

«Прозрачная цена» should pass external Deal context and receive proven execution facts. It should not duplicate the customer's internal elevator/production accounting.

## 11. Existing platform authority to reuse

Do not build a second truth system. Later runtime slices must reuse or extend:

- Accounting Connection Center maturity/evidence ladder;
- Connection Attestation gates;
- immutable accounting-document versions and external receipts;
- existing tenant/organization authorization and RLS patterns;
- canonical outbox/inbox/integration-event primitives where semantics match;
- existing remediation tasks `ONE_C_TRANSFER_FAILED` and `ONE_C_NOT_TRANSFERRED` once a real adapter exists.

## 12. Security inventory consequence

Adding a production TypeScript connector file changes the repository-owned cryptographic inventory. The canonical protocol itself also uses SHA-256, cryptographic randomness and timing-safe comparison for pairing. The generated inventory therefore must be regenerated and committed; the security guard must not be bypassed or weakened.

## 13. Certification evidence package

Before any `1С:Совместимо` submission we need repository-backed evidence for:

1. supported 1С platform version;
2. exact configuration/editor/version/release;
3. connector/extension version and release notes;
4. installation instructions;
5. pairing/connection instructions;
6. interaction technology description and examples;
7. supported command/object matrix;
8. negative/security cases;
9. deterministic test dataset and expected results;
10. reproducible test stand / demonstration procedure;
11. user guide;
12. proof of rights to the submitted product;
13. compatibility results on the exact current target release.

The `1С:Совместимо` certificate/logo is not claimed before 1С issues it.

## 14. External facts still required

These items are still external dependencies, not reasons to invent configuration details:

- 1С confirmation/recommendation of the certification baseline configuration;
- legal access/registration data for the 1С product used in compatibility testing;
- a real or licensed test information base on the exact target release;
- final certification submission and 1С verification;
- production acceptance against a real customer installation before any `CONFIRMED_LIVE` claim.

All correspondence with 1С remains outside this code path and is handled through the agreed existing email thread only after owner approval.

## 15. Next implementation slices

1. Regenerate cryptographic inventory and obtain green canonical SBOM/IP Clean Room gate for this exact protocol.
2. Port the already reviewed scoped machine-credential policy onto current `main` without blind-merging its stale branch.
3. Add durable `ConnectorInstallation`, `OrganizationBinding`, atomic pairing and credential lifecycle under PostgreSQL/RLS.
4. Add machine-authenticated heartbeat and safe diagnostics.
5. Reuse the canonical outbox/inbox authority for durable pull jobs, leases, ACK/result/fail and reconciliation.
6. Port the outbound-only BSL extension transport/discovery source and keep configuration adapter fail-closed.
7. Build the first exact configuration adapter after the certification baseline is confirmed.
8. Add 1С-ЭДО routing and the separate CPS/elevator mapping profile.
9. Compile/install the extension in a real test 1С environment and collect reproducible acceptance evidence.
10. Only after real external exchange and evidence may Connection Center maturity advance.
