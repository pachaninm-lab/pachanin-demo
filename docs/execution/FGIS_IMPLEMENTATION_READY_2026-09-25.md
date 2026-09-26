# FGIS implementation ready — applicability, Grain to Inventory and external truth

Baseline: MASTER v2.1 R8/ACX, `main` `bfbcd7642e54678153073a6d864695739b550b9c` at 25 September 2026. This is an internal delivery contract, not a claim of government-system access, legal applicability or production acceptance. Official law/API versions and the running REG.RU revision must be rechecked before each mutation slice.

## CURRENT STATE

- `docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json` is the existing government-system inventory. FGIS_GRAIN is SANDBOX_ONLY in the registry; EFGIS_ZSN, FGIS_SEED, FGIS_SATURN, GIS_EPD and relevant conditional systems are DISABLED. A registry's program-level `CORE_CROP` classification is not per-Deal legal applicability.
- `apps/api/src/modules/regulatory-integration/` has a Control Tower, durable inbox/reconciliation and a pinned FGIS Grain 1.0.23 operation/transport surface. `fgis-grain-tenant-read.contract.ts` explicitly declares NOT_ATTESTED, requires server authorization/attestation and rejects write operation codes in its read path. Existing generated schema is a pinned contract surface, not current organization credentials or live finality.
- `RegulatoryRuleVersion` in `apps/api/prisma/schema.prisma` stores generic versioned rule source/payload/effective interval. There is no accepted tenant-scoped per-Deal applicability read projection with evaluated context, `APPLICABLE | NOT_APPLICABLE | UNKNOWN`, evidence and blocking stages (#5526).
- Canonical Inventory lives in `apps/api/src/modules/inventory/`. FGIS Grain lot/СДИЗ evidence has separate existing tables/contracts; the accepted reconciliation that confirms/augments/conflicts with one canonical Inventory Batch is still #5370. The web Control Tower can show capability/freshness, not infer a Deal's compliance or tradeable quantity.
- #5531 lists organization access/delegation, credentials, certificate/signature, operator and external E2E blockers. A publicly located ЗСН document or fixture is source provenance, not tenant access or an implemented adapter.

## KEEP

Keep one GovernmentSystemPort→provider adapter→canonical Regulatory projection and one Inventory Batch authority. Reuse the existing FGIS Grain 1.0.23 generated operations, tenant read authorization, durable inbox/outbox, Control Tower and rule registry; quarantine legacy client-selected FGIS commands. Preserve RLS, append-only evidence, exact source/freshness timestamps and honest UNKNOWN/degraded states. Do not create another SDK, queue, legal rule table in the browser or independent grain lot inventory.

## GAPS

1. Server per-Deal/batch/shipment applicability and blocking-stage decision #5526, including affirmative NOT_APPLICABLE and fail-closed UNKNOWN.
2. Authorized FGIS Grain dictionaries/lot/СДИЗ read, checkpointed delta sync and deterministic Grain→Inventory reconciliation with quantity conservation #5370.
3. Real organization/provider access, credential/signing/delegation and official mutation/receipt finality #5531; no acceptance mutation to manufacture evidence.
4. Field/geometry/right/season ЗСН, seed sale/status/buyer confirmation, metadata-driven Saturn, accredited operator EPD lifecycle, OTC applicability and conditional Argus-Fito/VetIS/Росаккредитация. These are separate rule and adapter capabilities, not blanket enabled flags.
5. Product Deal/Control Tower reads need to render applicability, source/freshness, reconciliation/conflict, evidence and safe next step without guessing from crop name or adapter availability.

## ROOT CAUSES

Current integration capability/transport state answers whether a configured interface is available, not whether a legal obligation applies to a particular deal. Pinned Grain operation definitions do not provide this organization a credential, verified signing authority or production endpoint. External Grain lots are source evidence, while inventory/title/reservation are canonical internal authority. Treating ACK or a copied lot as final acceptance would create false compliance or double-sell risk.

## TARGET

For each authorized Deal and required system, the server returns a versioned applicability result with evaluated context, source and effective rule, evidence/freshness, blocking stage, permitted override authority and explanation. Grain source facts reconcile to a canonical Inventory Batch as MATCH/CONFLICT/UNKNOWN without increasing tradeable quantity. Product screens expose these independent axes and show an explicit blocked/pending path. A capability becomes LIVE_ACCEPTED only with current external contract/access and permitted E2E evidence.

## ARCHITECTURE

- Existing Regulatory Core owns rule selection and applicability. Inputs are commodity/OKPD2/TNVED as applicable, origin/destination, field, seed/pesticide facts, transport, deal stage, organization and current rule version. Missing context/rule/source produces UNKNOWN, not NOT_APPLICABLE.
- GovernmentSystemPort adapters normalize official source facts into versioned evidence with raw encrypted reference, external ID/operation, provider/configuration, digest/signature/transport evidence, source time, received time and freshness. The adapter does not decide inventory title, settlement or legal finality by itself.
- Grain lot/СДИЗ projection joins the existing Inventory Batch through a server-owned deterministic mapping and reconciliation record. It may confirm, augment provenance or conflict; it must never mint a second batch or increase sellable quantity beyond canonical reservation/title rules.
- Asynchronous mutations reuse IR-20 durable delivery, correlation and inbox. Transport acceptance, provider processing and final official acceptance remain separate states; unknown post-send outcome requires status reconciliation of the same operation before retry.
- PRODUCT consumes typed canonical read DTOs. Integration maturity, legal applicability, document state, Inventory reconciliation and Deal blocker status remain distinct UI dimensions.

## EXACT FILES / MODULES

- Rules: `apps/api/prisma/schema.prisma` `RegulatoryRuleVersion`, `apps/api/src/modules/auth/regulatory-rule-registry.policy.ts` and the existing `apps/api/src/modules/regulatory-integration/` Control Tower policy/repository/controller/DTO. Extend the established owner for #5526 rather than adding a client law engine.
- Grain: `apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.*`, tenant-read contract/repository/controller/transport, existing СДИЗ projection/exchange/ack repositories and focused PostgreSQL tests. #5370 must specify exact new migration and Inventory read/projection sites after fresh migration-head discovery.
- Inventory: `apps/api/src/modules/inventory/inventory.repository.ts`, its contract/controller and reservation authority; preserve current batch and RLS boundaries.
- Registry/source: `docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json` and its schema, plus the accepted ЗСН document source-lock artifact if present on the implementation base. Registry changes need their own verified provenance and review; do not edit v1 history to claim live access.
- PRODUCT consumer candidates: `apps/web/app/platform-v7/{fgis-zerno,fgis-access,fgis-to-lot}/page.tsx`, `apps/web/app/platform-v7/deals/grain-sdiz/page.tsx`, Deal 360 and the existing `apps/web/components/platform-v7/P7FgisRuntimeCheckPanel.tsx`. Verify exact imports/current production path before admitting a bounded source PR.

## DATA / SCHEMA

Use versioned, scoped rule and applicability results keyed to Deal/batch/shipment context and effective interval. Persist immutable source evidence with separate source `lastModified`, platform `fetchedAt`, digest, provider/configuration/operation version and supersession/revocation; no raw secret or unencrypted payload in UI. Checkpoint delta cursor/pagination with a unique external identity/version so replay is idempotent and delete/cancel/supersede is not lost. A Grain→Inventory reconciliation row stores both identities, quantity/unit normalization, match/conflict reason, evidence version, checkedAt and resolution audit. Foreign keys/RLS must deny cross-tenant/cross-org linking. Migrate forward without rewriting historical batches as verified.

## API / CONTRACTS

CORE #5526 publishes a read-only, authorized per-Deal projection with each system/obligation's `APPLICABLE | NOT_APPLICABLE | UNKNOWN`, rule ID/version/effective interval, evaluated context identity, source/evidence refs, checkedAt/freshness, reason codes, required evidence and blocking stages. CORE #5370 publishes `MATCH | CONFLICT | UNKNOWN` Grain↔Inventory identity/quantity provenance and source freshness; #5531 records external activation separately. Exact endpoint, DTO, accepted SHA and negative tests must accompany `READY_FOR_CONSUMER=true`. PRODUCT may not derive these states from route text, crop labels, adapter presence or HTTP/ACK.

## UX

Control Tower and Deal 360 show whether a requirement applies, what evidence supports it, when the external source last changed, what the platform last fetched, and whether it blocks the current stage. UNKNOWN/degraded provides owner, missing fact and safe next step. Grain lot and internal Inventory Batch are shown as linked source versus canonical stock, with explicit conflict and no inflated available quantity. For EPD, distinguish draft, signed, operator accepted, GIS delivered, government accepted and finalized only where official contract evidence permits. RU/EN/ZH and mobile expose the same distinctions; no green badge from HTTP 2xx.

## SECURITY

Tenant/organization/Deal authorization and FORCE RLS gate source reads and projections. Server determines applicable system and provider binding; clients cannot supply authority, verification or override. Certificates/keys/credentials/signature content remain outside Git/UI. Sign/create/cancel/redeem requires current contract, identity/delegation, MFA/step-up where applicable and audit. An override, if policy permits, is versioned with actor/reason/evidence and cannot convert missing external acceptance into a fact.

## CONCURRENCY

Checkpoint delta pages and source versions transactionally; restart/replay cannot lose deletes or duplicate facts. Concurrent platform edits and external lot changes produce a conflict/reconciliation decision, never last-write-wins verified quantity. Use stable operation/correlation/idempotency keys for outbound work and unique inbox identity for callbacks; row/version locks prevent conflicting transitions. Source-rule version changes re-evaluate applicability and mark prior projections stale without retroactively forging acceptance.

## FAILURE / RECOVERY

Source outage, stale/malformed response, schema drift, missing field geometry/right or contradictory evidence fail closed as UNKNOWN/CONFLICT and keep the blocking stage until authorized resolution. After possible government mutation timeout, mark UNKNOWN/PENDING_RECONCILIATION; do not blind replay. Durable receipt can be reprocessed exactly once, and ACK is not final. Rollback and restore preserve evidence lineage, cursor, source version and pending operations. Offline field input remains unaccepted evidence until server acknowledgement and conflict handling.

## EXTERNAL BLOCKERS

#5531 must record each required system/operator's official contract/version/effective date, organization onboarding/delegation, environment/endpoint, credential/certificate/signature/operator reference, callback/receipt trust, current access, checkedAt, owner, permitted E2E and blocked capability. Registry `DISABLED` or `SANDBOX_ONLY` stays that way without evidence. For FGIS Grain, pinned 1.0.23 is contract identity only. For EPD, verify an accredited operator binding instead of assuming direct GIS access. Do not perform a legally significant government mutation merely for acceptance.

## TESTS

- Applicability positive/negative: APPLICABLE, affirmatively NOT_APPLICABLE and UNKNOWN; absent commodity/field/route/deal facts, stale/overlapping rule version, conflicting evidence, revoked source and cross-tenant read.
- Grain read/delta: official contract fixture, pagination/checkpoint crash/restart, idempotent replay, delete/cancel/supersede, malformed XML/schema drift, source and fetch timestamps, signature/transport evidence.
- Inventory: one canonical Batch, source quantity normalization, match/conflict, no double sell, concurrent reserve/source update and cross-organization denial under PostgreSQL RLS.
- Mutations only in permitted test environment with exact contract: outbound durable write before ACK, duplicate/delayed callback, timeout UNKNOWN, same-operation reconciliation, signature failure and no false finality.
- Product: legal applicability versus capability/availability, stale/degraded/forbidden/conflict/unknown, status/evidence accessibility, RU/EN/ZH/mobile, no client inference or fake source.

## ACCEPTANCE

Internal R8 passes only with accepted exact-head rule/projection/Inventory contract tests, independent review, security/concurrency/recovery, a typed PRODUCT handoff and exact-main REG.RU live read acceptance. Each external system has its own evidence-backed maturity; unavailable access remains CONTRACT_PENDING or EXTERNAL_ACCESS_PENDING and cannot be LIVE_ACCEPTED. MASTER R8.1–R8.11 and conditional applicability, EPD and A07/S10 are evaluated separately. Actual legal mutation and signing require their own authorization and cannot be substituted by sandbox fixtures. Full aggregate FGIS PASS requires the MASTER's R8 Definition of Done and section 10 external-blocker rule, not a Control Tower page alone.

## DEPENDENCIES

CORE #5526 owns per-Deal applicability; #5370 owns Grain→Inventory; #5531 owns external access; IR-20 owns durable delivery; canonical Inventory and Deal stage authority remain separate. PRODUCT consumes accepted DTOs only. The full UX matrix #5605/#5606 and bank/document/EPD handoffs share Deal evidence but cannot declare regulatory finality independently.

## IMPLEMENTATION ORDER

1. Resolve exact main, rule registry, Grain read/Inventory authority and official source versions; classify KEEP/EXTEND/EXTERNAL_BLOCKER per system.
2. Implement CORE #5526 fail-closed per-Deal read projection and accept negative/rule-version/RLS tests; hand off the exact DTO.
3. Implement #5370 authorized Grain read/delta and canonical Inventory reconciliation with crash/replay/quantity tests; keep mutations disabled.
4. PRODUCT renders the two accepted projections and degraded/UNKNOWN/conflict states in a narrow admitted Deal/Control Tower slice, then accepts exact REG.RU read paths.
5. Verify real contracts and organization access per #5531. Only then add permitted Grain mutations, ZSN/seed/Saturn, EPD operator and conditional systems one capability at a time with external E2E. Re-evaluate full R8 acceptance without converting an external blocker into PASS.
