# Banks implementation ready — canonical operation, provider evidence and truthful UX

Baseline: MASTER v2.1 REQ-BNX-001–008, R9 and ACX, `main` `bfbcd7642e54678153073a6d864695739b550b9c` on 25 September 2026. This package separates internal implementation from a live bank contract. It is not an activation, money-movement authorization or production acceptance record. Re-resolve the schema and exact main before CORE changes.

## CURRENT STATE

- The canonical PostgreSQL settlement contour already has `settlement.bank_operations` with tenant/deal/payment/terms, operation type, amount, idempotency, callback and status fields (`apps/api/prisma/migrations/20260713140000_settlement_postgresql_authority/migration.sql`; `apps/api/src/modules/settlement-engine/settlement-postgresql.repository.ts`). It currently records `required_partner_id`, not a durable link to a concrete `IntegrationBinding`/`ProviderCapability`/`Provider`.
- A separate legacy Prisma `BankOperation` maps `public.bank_operations` in `apps/api/prisma/schema.prisma` and carries `bankName`/`bankRef` without tenant/organization/binding identity. It must not be silently treated as the canonical settlement operation or used to infer a provider. Reconcile readers/writers before migration; do not create a third bank operation store.
- `Provider`, `ProviderCapability`, `IntegrationBinding` and append-only `IntegrationCapabilityEvidence` exist with tenant/organization composite keys and versioned maturity. `BankCapabilityRouter` checks server-held binding identity, LIVE_ACCEPTED, credential/callback trust and capability before real traffic. Sber/Alfa/T-Bank files in `apps/api/src/modules/bank-adapters/` are reference adapters, not evidence of our active contracts or credentials.
- PRODUCT's bank/release-safety and Deal 360 surfaces state unknown/reconciliation rather than claiming an operation was sent, debited or finalized without evidence. The concrete operation→bank name handoff #5525, activation #5530 and exact live acceptance remain open.

## KEEP

Preserve the existing Settlement authority, ledger, RLS, payment/version controls, durable inbox/outbox, signed callback checks, reconciliation and provider-neutral registry. Keep money finality separate from provider linkage: `LINKED` only identifies an evidenced route, never a completed reserve/release/refund. Preserve current truthful UNKNOWN/PENDING_RECONCILIATION copy and the bank-neutral PaymentPort/BankPort boundary.

## GAPS

1. No accepted server read projection proves which persisted canonical BankOperation used which version of IntegrationBinding and Provider. A `bankName`, partner string, adapter class or webhook text is not that proof.
2. The reference adapters lack per-organization signed contract, production binding, credential references, callback trust, permitted capability and same-operation statement/status evidence for real Sber, Alfa and T-Bank traffic.
3. ProviderComplianceMatrix, restriction/unlock provenance, beneficiary-change safeguards and scheme-specific authority require accepted CORE evidence and negative tests.
4. Bank↔ledger↔documents↔1С reconciliation, degraded behavior, disputes/undisputed release and conditional finance products need end-to-end acceptance, not only copy or isolated adapter tests.

## ROOT CAUSES

The settlement operation schema predates the provider-neutral binding registry. Its partner ID cannot prove provider/capability/version or organization scope. The public legacy BankOperation model has an independent shape. Reference adapter conformance and HTTP/callback success lack organization-specific legal and trust evidence. PRODUCT cannot repair these gaps by selecting or guessing a bank in the browser.

## TARGET

An authorized user can inspect a single canonical operation with amount/basis/status, a server-proven `LINKED | NOT_LINKED | CONTRADICTORY` provider lineage, separate activation/freshness/reconciliation state, the next safe step and an audit/evidence path. Reserve, hold, release, refund and finality remain controlled by the existing Settlement and contractual provider policy. Each actual provider is named only after current binding and operation evidence; missing external prerequisites render NOT ACTIVATED/UNKNOWN.

## ARCHITECTURE

- CORE extends the existing Settlement operation and IntegrationBinding relationship, not a parallel provider registry or payment core. The operation freezes binding/capability/provider identity and versions at request admission; a later binding rotation does not rewrite historical lineage.
- Provider routing consumes a server-held, organization-consistent, versioned authority snapshot. The reference adapter can normalize capabilities, but activation requires contract, environment, credential/callback trust and LIVE_ACCEPTED evidence.
- Durable outbound dispatch and inbound callback keep correlation and operation identity. A transport ACK only advances transport state. Canonical payment/ledger finality follows verified contractual response and reconciliation rules.
- PRODUCT consumes a read DTO; it cannot choose a provider, set maturity, unlock restrictions or assert bank finality. Presentation separates operation lifecycle, provider linkage, contract activation and money outcome.

## EXACT FILES / MODULES

- Canonical write/read authority: `apps/api/src/modules/settlement-engine/settlement-postgresql.repository.ts`, `settlement-engine.service.ts`, `settlement-engine.controller.ts`, focused settlement PostgreSQL/callback tests and a forward-only `apps/api/prisma/migrations/<new>_bank_operation_binding_linkage/migration.sql` selected after current migration-head check.
- Provider authority: `apps/api/src/modules/service-providers/integration-binding.repository.ts`, `integration-binding.contract.ts`, `apps/api/src/modules/bank-adapters/bank-capability.router.ts`, `bank-adapter.port.ts`, reference adapters and contract tests. Do not put credentials in these source files.
- Existing reconciliation: `apps/api/src/modules/bank-reconciliation/`, `apps/api/src/modules/integration-events/`; extend only where the canonical same-operation and durable evidence path actually requires it.
- PRODUCT consumers after CORE READY_FOR_CONSUMER: `apps/web/app/platform-v7/bank/release-safety/page.tsx`, `apps/web/lib/bank-release-server.ts`, Deal 360 bank panel and narrowly scoped tests. Re-resolve exact filenames/imports at handoff; do not write a second bank UI data source.
- `public.bank_operations` legacy paths in `apps/api/src/modules/deals/` and `apps/api/prisma/schema.prisma` require explicit coexistence/migration classification. Do not backfill lineage from their `bankName`.

## DATA / SCHEMA

Add a durable immutable linkage on the authoritative `settlement.bank_operations` path with operation ID, tenant/organization, integrationBindingId, providerId/providerCapabilityId, binding/provider/capability/configuration versions, checkedAt and evidence reference or a normalized snapshot table keyed one-to-one to operation. Choose a FK strategy only after checking current table ownership and RLS; enforce same tenant/organization/provider capability at the DB boundary where practical. Existing operations remain NOT_LINKED until affirmative evidence; never guess from `required_partner_id`, `bankName`, payload or statement text. Make migrations forward-compatible with old readers and rollback safe without rewriting accepted money history. Keep secret values and raw signed material out of DTOs and audit logs.

## API / CONTRACTS

CORE #5525 supplies a versioned tenant-scoped operation read projection: `bankOperationId`, linkage state, binding/provider/capability identifiers and versions if valid, evidence/maturity/freshness, operation status, reconciliation status and typed contradiction reason. Missing/wrong-org/revoked/stale link is NOT_LINKED or CONTRADICTORY; no client input can create LINKED. Document exact controller route, DTO and accepted SHA with `READY_FOR_CONSUMER=true` before PRODUCT reads it. The activation matrix #5530 records each provider's actual contract, environment, credential/callback trust, authorized operation scheme/capability and same-operation status/statement query. No public API specification alone proves our activation.

## UX

Show the operation amount and basis from canonical money authority; show provider name only from a valid operation lineage. Separate `request recorded`, `transport sent`, `provider acknowledged`, `reconciliation required`, and contract-defined final outcome. Explain who owns a restriction, what evidence is missing and which action is available; never show “no debit” after a timeout. RU/EN/ZH and mobile labels keep the same money/finality meaning. A disabled reserve/release/refund states why and how to recover, without offering a fresh blind operation.

## SECURITY

Server-side tenant/organization/deal permission and FORCE RLS govern the projection. Signed callback verifies provider/key identity, operation, amount/currency/version, freshness and replay before durable ACK. Credentials are server-held references with rotation/revocation evidence. Beneficiary/account change requires request, MFA, authority/account ownership, notice, risk review, contractual cooling-off/four-eyes and effective version; no retroactive reroute. Provider restrictions cannot be bypassed by another binding, splitting or new beneficiary. Maker/checker and step-up remain enforced by the existing authority.

## CONCURRENCY

Freeze the binding snapshot atomically with operation acceptance. Unique command/idempotency and callback identities prevent duplicate effects; settlement version checks reject stale action. Rotation during in-flight operation preserves the old version for reconciliation. Competing requests or callback/statement races converge on one operation and ledger effect; a conflicting amount or provider opens an incident instead of a new route.

## FAILURE / RECOVERY

After a possible external mutation and lost response, mark UNKNOWN/PENDING_RECONCILIATION and query status/statement using the same operation identity before any policy-approved retry. Delayed/duplicate callback is replay-safe; crash after durable inbox ACK replays once. Missing binding, expired trust, provider outage, mismatch and statement conflict fail closed, with correlation, incident owner and partial undisputed release only when existing policy permits. Restore/rollback must preserve immutable operation lineage and money invariants.

## EXTERNAL BLOCKERS

For each Sber/Alfa/T-Bank product and scheme, #5530 must record exact contracting organization, signed/current product terms, allowed environment/capability, binding, credential reference, callback trust, status/statement access, required operator step, checkedAt, owner and affected UX/action. Label CONTRACT_PENDING or EXTERNAL_ACCESS_PENDING when absent. No real-money or provider mutation solely for tests, and no LIVE_ACCEPTED claim from a reference adapter, sandbox receipt or mock callback.

## TESTS

- PostgreSQL/RLS: valid linked operation; no binding; wrong tenant/org/provider/capability; stale/revoked/expired evidence; concurrent binding rotation; legacy row; unique idempotency; migration/rollback.
- Contract: per-provider allowed operations and schemes, unsupported capability, changed contract/version, callback signature/key rotation/replay, amount/currency mismatch, out-of-order response and unknown outcome.
- Reconciliation: same-operation status/statement, duplicate/delayed callbacks, crash/replay, conflicting statement, provider outage and ledger/document/1С mismatch. No double posting or false finality.
- PRODUCT: provider name only for LINKED with evidence, independent money/activation axes, UNKNOWN/NOT ACTIVATED/CONTRADICTORY, bank restriction/disabled action, RU/EN/ZH/mobile/a11y and tenant denial.

## ACCEPTANCE

Internal #5525 requires exact-head negative PostgreSQL/contract/security tests, independent review, an accepted DTO/read path and READY_FOR_CONSUMER handoff. PRODUCT then uses the exact contract and passes focused + browser/live read acceptance. Each real provider separately requires verified contract/credential/callback/statement evidence, permitted controlled E2E and current REG.RU revision. Final R9/BNX acceptance includes monetary A08–A10/A14/A16–A18/A20 cases, reconciliation and restrictions; a nonmonetary internal slice cannot be scored as bank live PASS. Exact-head CI, owner audit, independent review, SHA-bound merge and exact-main release/live evidence apply to every slice.

## DEPENDENCIES

CORE #5525 is the read/linkage authority. #5530 is real activation. Canonical Settlement, IntegrationBinding and IR-20 durable delivery stay single owners; Deal/Inventory/basis/dispute/evidence and 1С/ЭДО/ЭПД provide cross-system reconciliation inputs. PRODUCT's bank UX follows READY_FOR_CONSUMER; no source or money authority is acquired by this document.

## IMPLEMENTATION ORDER

1. CORE reconciles `settlement.bank_operations` with the legacy Prisma model and selects a forward-only linkage schema; test scope/RLS and preserve historical UNKNOWN.
2. CORE writes the frozen operation→binding→provider lineage and read projection with negative/concurrency/recovery tests; accept #5525 exact SHA and hand off DTO.
3. PRODUCT renders the operation's verified provider and separate money/activation/reconciliation states in a narrowly admitted UI slice; accept on REG.RU.
4. Onboard one actual contractual bank scheme, then other provider families one by one under #5530, with live trust and same-operation reconciliation; never claim all three from adapter availability.
5. Complete provider restrictions, beneficiary-change controls, finance products and Bank↔Ledger↔Documents↔1С daily/full reconciliation before aggregate BANKS/R9 PASS.
