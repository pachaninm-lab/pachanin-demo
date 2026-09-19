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
| Dispute | ✅ `DisputeRepository` | `RuntimeDisputeRepository` | `PrismaDisputeRepository` (disabled skeleton) |
| Evidence | ⏭️ N/A by design (see below) | — (DB-first integrity store) | — |

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

### Dispute boundary (this change)

- `dispute.repository.ts` — `DISPUTE_REPOSITORY` token + `DisputeRepository`
  interface (`list`, `getById`, `add`). `list` is async (future DB adapter);
  `getById`/`add` stay synchronous because the in-memory store returns a live
  object reference that the service mutates in place (triage / evidence /
  decision), preserving the existing synchronous controller semantics.
- `runtime-dispute.repository.ts` — default adapter. Owns the in-memory dispute
  store and its pilot seed (moved verbatim out of `DisputesService`).
- `prisma-dispute.repository.ts` — disabled DB-backed skeleton: `list` read
  snapshot only (via `dispute` with evidence + moneyHold relations);
  `getById`/`add` fail loudly. Requires `PrismaService` or throws.
- `dispute-repository.factory.ts` / `selectDisputeRepository` — runtime by
  default; Prisma only under explicit `PLATFORM_V7_DISPUTE_REPOSITORY=prisma`.
- `DisputesService` reads/appends through the repository and keeps **all** money
  logic in place: money-hold creation on dispute open and the decision
  `MoneyInstruction` builder (REFUND_BUYER / RELEASE_TO_SELLER / SPLIT_RELEASE)
  are **not moved** into any adapter. Consistent with Payment money-safety, the
  boundary abstracts dispute DATA ACCESS only.

#### Deliberate hardening (documented behavior change)

`DisputesService` previously preferred a **silent Prisma-first** read in `list()`
(falling back to the in-memory store on empty/error) and issued fire-and-forget
Prisma mirror writes on create/decision whenever `PrismaService` was injected.
Both are silent Prisma activations and are removed:
- In pilot / degraded mode (no flag / DB down) the effective behavior is
  unchanged — the in-memory store serves and stores disputes exactly as before,
  including money holds and decision money instructions.
- The Prisma read path is reachable **only** via the explicit flag; the
  money-bearing mutation path is never silently mirrored to the DB. No live
  payout, no bank release — disputes only emit money *instructions* as before.

### Evidence: boundary pattern deliberately NOT applied

`EvidencePackService` (`apps/api/src/modules/evidence-pack`) is intentionally
excluded from the runtime-default / Prisma-disabled boundary pattern. It is a
**DB-first hash-chain integrity store**: each evidence file is sha256-hashed and
linked to the previous entry via `prevHash`, and `verifyChain` validates the
chain. Prisma is the **intended primary** store; the in-memory `Map` is an
explicit, honest *degraded fallback* used only when the DB is unavailable, and
it returns `chainIntact: false` / `chainVerified: false` so callers can see the
integrity guarantee is not in force.

Applying the per-domain boundary inversion here (making an in-memory adapter the
default and disabling Prisma behind a flag) would be **wrong**: it would weaken
the integrity/audit story rather than harden it, and would invert a module whose
correct behavior is already DB-first with a transparent fallback. Evidence is
therefore marked N/A by design, not "pending a boundary". Any future change to
evidence belongs to a dedicated integrity/audit hardening track (e.g. signed
chain anchoring), not to this repository-boundary phase.

### Boundary phase — status

The repository-boundary phase is substantively complete for every API domain
where the pattern fits: **Deal, Payment (reads), Document, Shipment, Lab,
Dispute**. Each extracts data access into a per-domain repository with the
in-memory runtime adapter as the default and a disabled, fail-loud Prisma
skeleton behind an explicit `PLATFORM_V7_*_REPOSITORY=prisma` flag. No DB-backed
path is active; no live integration; money mutations remain on RuntimeCore /
their owning services. The DB-backed activation, MoneyEngine extraction and
RuntimeCore decomposition remain locked (`lockedUntilCurrentGreen`) and need an
explicit owner decision before they start — they are larger than a single
narrow reviewable change.

## Still owned by RuntimeCore (future split candidates)

State transitions, blockers, money impact, document completeness, evidence
append, synthetic timelines — all still live inside `RuntimeCoreService`.
Recommended next splits (docs-only until each has its own narrow PR):
`StateMachine`, `MoneyEngine`, `BlockerResolver`, `TimelineBuilder`. (The
repository-boundary phase itself is complete; Evidence is N/A by design — see
above.)

## External blockers (unchanged, explicit)

live bank credentials/contracts · FGIS access · EDO/EPD access ·
KEP/signature provider · production DB/deploy credentials · real pilot
counterparties.
