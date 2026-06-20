# API Runtime — Source-of-Truth Audit (platform-v7)

Status: **controlled-pilot / pre-integration**. This document tracks how the
`apps/api` runtime stores and serves data while it is gradually moved from the
process-memory `RuntimeCoreService` toward a repository architecture and,
later, a DB-backed path. Nothing here is live-integrated; the DB-backed path is
**not active** by default.

Honest framing (do not overstate):
- No `production-ready`, `fully live`, `fully integrated` claims.
- No `bank connected` / `FGIS connected` / `EDO connected`.
- The platform does **not** itself release money or guarantee payment.

## Current source of truth

`apps/api/src/modules/runtime-core/runtime-core.service.ts` (~1075 lines) is the
in-memory source of truth for deals, shipments, documents, labs, disputes,
evidence, timelines, blockers and money impact. Prisma (`PrismaService`,
SQLite) exists and `DatabaseSeedService` seeds it, but the runtime store remains
the authoritative path in pilot mode.

## Repository boundaries

| Domain | Boundary | Default adapter | DB-backed adapter |
|---|---|---|---|
| Deal | ✅ `DealRepository` | `RuntimeDealRepository` | `PrismaDealRepository` (disabled skeleton) |
| Payment (reads) | ✅ `PaymentRepository` | `RuntimePaymentRepository` | `PrismaPaymentRepository` (disabled skeleton) |
| Document | ✅ `DocumentRepository` | `RuntimeDocumentRepository` | `PrismaDocumentRepository` (disabled skeleton) |
| Shipment / Logistics | ✅ `ShipmentRepository` | `RuntimeShipmentRepository` | `PrismaShipmentRepository` (disabled skeleton) |
| Lab | ✅ `LabRepository` | `RuntimeLabRepository` | `PrismaLabRepository` (disabled skeleton) |
| Dispute | ❌ not yet | — | — |
| Evidence | ❌ not yet | — | — |

### Deal repository boundary (this change)

- `deal.repository.ts` — `DEAL_REPOSITORY` token + `DealRepository` interface.
- `runtime-deal.repository.ts` — default adapter, wraps `RuntimeCoreService`
  deal methods (`listDeals`, `getDeal`, `dealWorkspace`, `dealPassport`,
  `dealTimeline`, `createDeal`, `transitionDeal`) with no behavior change.
- `prisma-deal.repository.ts` — disabled DB-backed skeleton. Implements only
  read snapshots (`list`, `getById`); `workspace/passport/timeline/create/
  transition` are **not supported and fail loudly**. Requires `PrismaService`
  or throws at construction.
- `deal-repository.factory.ts` / `selectDealRepository` — selects the adapter.
  Default is the runtime adapter; the Prisma adapter is selected **only** under
  the explicit `PLATFORM_V7_DEAL_REPOSITORY=prisma` flag.
- `DealsService` now depends on `DEAL_REPOSITORY` and keeps all permission,
  object-scope and release-gate logic (no change to those).

#### Deliberate hardening (documented behavior change)

Previously `DealsService` silently preferred Prisma for `list`/`getOne` whenever
`PrismaService` was injected (`@Global` PrismaModule), falling back to runtime
on empty/error. That is a **silent Prisma activation** and is disallowed by the
project safety rules. The boundary removes it:
- In pilot / degraded mode (DB down or no flag) the effective behavior is
  unchanged — the runtime store serves deals, exactly as before.
- The Prisma read path is now reachable **only** via the explicit flag, and
  never silently falls back between adapters.

### Payment read boundary (this change)

- `payment.repository.ts` — `PAYMENT_REPOSITORY` token + `PaymentRepository`
  interface (read surface: `list`, `detail`, `worksheet`, `bankWorkspace`).
- `runtime-payment.repository.ts` — default adapter, wraps RuntimeCore payment
  reads with no behavior change.
- `prisma-payment.repository.ts` — disabled DB-backed read skeleton. `list`/
  `detail` snapshots only; `worksheet`/`bankWorkspace` fail loudly. Requires
  `PrismaService` or throws.
- `payment-repository.factory.ts` / `selectPaymentRepository` — runtime adapter
  by default; Prisma only under explicit `PLATFORM_V7_PAYMENT_REPOSITORY=prisma`.
- `SettlementEngineService` routes its read surface through the repository and
  defaults to the runtime adapter when not injected (tests / direct
  instantiation). **Money mutations are NOT moved** — reserve, release, bank
  callback, confirm, adjust, importBankStatement and the `upsertPayment`
  snapshot all remain on RuntimeCore. The platform still never self-confirms a
  reserve or self-releases money; release stays bank-callback driven.

Deferred to a future MoneyEngine + idempotency PR: extracting reserve/release/
callback into a domain service and any DB-backed write path.

### Document read/write boundary (this change)

- `document.repository.ts` — `DOCUMENT_REPOSITORY` token + `DocumentRepository`
  interface (`list`, `getById`, `upload`, `sign`, `generateDealPackage`).
- `runtime-document.repository.ts` — default adapter, wraps RuntimeCore document
  methods with no behavior change.
- `prisma-document.repository.ts` — disabled DB-backed skeleton: `list`/`getById`
  snapshots only (via `dealDocument`); `upload`/`sign`/`generateDealPackage`
  fail loudly. Requires `PrismaService` or throws. No file storage / signature
  integration.
- `document-repository.factory.ts` / `selectDocumentRepository` — runtime by
  default; Prisma only under explicit `PLATFORM_V7_DOCUMENT_REPOSITORY=prisma`.
- `DocumentsService` reads through the repository and keeps the document-matrix
  / release-gate / completeness logic. No behavior change; document
  completeness and release-blocker behavior are unchanged.

### Shipment / logistics boundary (this change)

- `shipment.repository.ts` — `SHIPMENT_REPOSITORY` token + `ShipmentRepository`
  interface (`list`, `getById`, `workspace`, `create`, `transition`,
  `recordCheckpoint`, `verifyPin`).
- `runtime-shipment.repository.ts` — default adapter, wraps RuntimeCore shipment
  methods with no behavior change.
- `prisma-shipment.repository.ts` — disabled DB-backed skeleton: `list`/`getById`
  snapshots only; workspace/create/transition/recordCheckpoint/verifyPin fail
  loudly. Requires `PrismaService`. No live GPS / telematics.
- `shipment-repository.factory.ts` / `selectShipmentRepository` — runtime by
  default; Prisma only under explicit `PLATFORM_V7_SHIPMENT_REPOSITORY=prisma`.
- `LogisticsService` reads through the repository and keeps driver-isolation
  access checks (a driver can only access their own shipment) and the
  best-effort checkpoint DB snapshot. The previous **silent Prisma-first** read
  path for shipment list/getOne is removed (documented hardening): pilot/
  degraded behavior is unchanged (runtime serves shipments), Prisma read path
  reachable only via the explicit flag.

### Lab boundary (this change)

- `lab.repository.ts` — `LAB_REPOSITORY` token + `LabRepository` interface
  (`list`, `getById`, `create`, `collect`, `recordTest`, `finalize`).
- `runtime-lab.repository.ts` — default adapter, wraps RuntimeCore lab methods
  with no behavior change.
- `prisma-lab.repository.ts` — disabled DB-backed skeleton: `list`/`getById`
  snapshots only; create/collect/recordTest/finalize fail loudly. Requires
  `PrismaService`. No live lab integration / external protocol upload;
  quality-delta semantics stay on RuntimeCore.
- `lab-repository.factory.ts` / `selectLabRepository` — runtime by default;
  Prisma only under explicit `PLATFORM_V7_LAB_REPOSITORY=prisma`.
- `LabsService` reads through the repository. Removes the previous silent
  Prisma-first read path for list/getOne (pilot/degraded behavior unchanged;
  finalize-protocol and quality-delta behavior unchanged).

## Still owned by RuntimeCore (future split candidates)

State transitions, blockers, money impact, document completeness, evidence
append, synthetic timelines — all still live inside `RuntimeCoreService`.
Recommended next splits (docs-only until each has its own narrow PR):
`StateMachine`, `MoneyEngine`, `BlockerResolver`, `TimelineBuilder`, and the
remaining repository boundaries (Payment, Document, Shipment, Lab, Dispute,
Evidence).

## External blockers (unchanged, explicit)

live bank credentials/contracts · FGIS access · EDO/EPD access ·
KEP/signature provider · production DB/deploy credentials · real pilot
counterparties.
