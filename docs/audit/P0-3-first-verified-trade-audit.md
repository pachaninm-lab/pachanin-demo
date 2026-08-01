# P0.3 — First Verified Trade: audit of the existing contour

Audit base: `main` @ `758f55b` (`fix(tai): resolve PostgreSQL authority from active API DATABASE_URL (#3584)`).
Scope: step 1 of the P0.3 brief — establish what already exists for auction / bid / award / Deal /
RLS / tenant before any code is written, so that no second trading system is created.

Verdict up front: **the existing auction contour is complete and well-built, but it is
structurally single-tenant. P0.3 cannot be delivered by wiring UI to it.** The blocker is
architectural, not cosmetic, and it must be resolved before steps 2–7 are meaningful.

---

## 1. What already exists (do not rebuild)

The auction authority is **raw SQL in a bounded `auction` schema**, deliberately outside Prisma's
public-schema ownership. `schema.prisma` contains no auction models — this is intentional, not an
omission.

| Object | Location |
| --- | --- |
| `auction.lots`, `auction.bids`, `auction.awards` | `20260713210000_auction_postgresql_authority` |
| Single-winner guard | `20260713211000_auction_single_winner_guard` |
| `auction.admissions`, `auction.command_receipts` | `20260715013000_auction_atomic_execution` |
| **Current** `register_verified_lot`, `record_admission`, `place_bid`, `close_lot`, `lock_lot` | `20260715013100_auction_atomic_execution` |
| `bind_deal`, `award_guard` | `20260715013000_auction_atomic_execution` |
| `replay_command`, `save_command` | `20260715013300_auction_atomic_execution` |

Note the migration ordering: `013050` **drops** the `013000` versions of `register_verified_lot`
and `place_bid`; `013100` recreates them. Any change must target the `013100` definitions —
reading `013000` in isolation gives a stale picture of the command surface.

Requirements from brief item 4 that are **already implemented** and must simply be reused:

- **Kopecks** — `amount_kopecks_per_ton`, `start/step_price_kopecks_per_ton` (`013100:6-39`).
  The `*_rub_per_ton` columns are derived (`/ 100`) and legacy.
- **Decimal volume** — `volume_tons numeric(20,6)` on both lots and bids.
- **Idempotency** — `replay_command` / `save_command` keyed on
  `(command, idempotency_key, request_hash)`, plus a unique actor-idempotency index.
- **Optimistic concurrency** — `p_expected_version` vs `lot.version`, raising
  `AUCTION_STALE_VERSION`; `touch_version()` triggers bump on every UPDATE.
- **Serialization** — `lock_lot()` takes `pg_advisory_xact_lock` on
  `tenant:auction:lot_id` before `SELECT … FOR UPDATE`.
- **Cutoff** — `AUCTION_BID_CUTOFF_REACHED` when `now >= auction_ends_at` (`013100:458`).
- **Auto-extension** — window/increment applied inside the same locked transaction
  (`013100:547-554`).
- **Volume ceiling** — `p_volume_tons > lot.volume_tons` → `AUCTION_BID_TERMS_INVALID`.
- **Actor risk gate** — `current_actor_active()` requires ACTIVE user, matching membership *and*
  role, org `status IN ('VERIFIED','ACTIVE')`, `kycStatus='APPROVED'`, `amlStatus='CLEAR'`,
  `sanctionHit=false` (`013100:51-78`).
- **Single winner** — `auction_awards_tenant_lot_key UNIQUE (tenant_id, lot_id)` makes a second
  award for a lot impossible at the storage layer.

`close_lot` already performs the winner selection, flips losers to `OUTBID`, writes exactly one
`auction.awards` row, and emits a canonical **deal basis** (`integration_events`, type
`DEAL_BASIS_READY`, with `basis_hash`). Deal creation is then gated by
`deals_insert` RLS, which admits a row only when
`app_deal_basis_deal_visible(to_jsonb(deals))` matches that confirmed basis
(`20260712195000_deal_insert_basis_only`). `bind_deal` closes the loop and moves the lot to
`IN_DEAL`.

This is a sound design. **Brief item 5 is already ~90% built.**

---

## 2. The blocking finding: one tenant per organization

Two facts, taken together, make cross-organization trade impossible today.

**Fact A — every organization gets its own tenant.**

`schema.prisma`, `model Organization`:

```prisma
tenantId String @default(cuid())
```

and production registration hard-assigns a fresh one — `apps/api/src/modules/auth/auth.service.ts:296`:

```ts
tenantId: `tenant_${randomUUID()}`,
```

So seller org A and buyer org B, both self-registered, **never** share a `tenantId`.

**Fact B — the entire auction contour is keyed on a single session tenant.**

Every command resolves the lot with:

```sql
WHERE tenant_id = current_setting('app.current_tenant_id', true)
```

(`place_bid` `013100:446`, `close_lot` `013100:666`, `record_admission` `013100:288`), and every
RLS policy on `auction.lots` / `bids` / `awards` / `admissions` is
`tenant_id = current_setting('app.current_tenant_id', true)`. `deals_select` and `deals_insert`
are bound the same way (`20260712193000:159`, `20260712195000:8`).

**Consequence:** a real buyer B cannot see lot of seller A, cannot be admitted to it, cannot bid on
it, and — even if a Deal were created — could not read the Deal that names B as `buyerOrgId`.
Not "leaks", not "renders wrong": returns nothing, by correct design.

### Why the contour nonetheless passes its tests

`apps/api/test/industrial/auction-atomic-execution.e2e-spec.ts:360-366` seeds the seller and
**all** bidding buyers into one shared `TENANT` constant. A fifth org, `FOREIGN_ORG`, is seeded
into `FOREIGN_TENANT` — and is used purely as a **negative** case asserting that a
different-tenant actor is rejected.

So the suite proves cross-tenant *isolation works*. That is precisely the behavior which blocks
P0.3. The auction is verified under an assumption — all counterparties in one tenant — that
production registration structurally never produces. This is the "критический разрыв" in the
brief, now with exact evidence.

---

## 3. Secondary gaps found

1. **No self-bid prohibition.** Brief item 4 lists "запрет self-bid" as an existing command to
   connect. It does not exist. `place_bid` (`013100:408-623`) never compares
   `lot.seller_org_id` against `app.current_org_id`. The only `seller_org_id = current_setting(...)`
   occurrence in the migrations is inside the `auction_admissions` **RLS policy**
   (`013000:978`), which is unrelated. Today the guard is incidental: `assert_actor(ARRAY['BUYER'])`
   stops a `FARMER` session, but an org holding both a FARMER and a BUYER membership could bid on
   its own lot. This must be added explicitly.

2. **`PublishedLot` does not exist.** Brief item 2 asks for a `PublishedLot → AuctionLot` bridge.
   There is no `PublishedLot` model, table, or type anywhere in the repository. The FGIS layer
   that *does* exist is SDIZ-shaped — `FgisGrainSdizProjection`, `FgisGrainSdizProjectionBatch`,
   `FgisGrainExchange`, `FgisGrainTenantReadAuthorization` — and carries no publication,
   passport, or reservation concept. The bridge has **no upstream source to bridge from** until
   #3585 lands.

3. **`register_verified_lot` trusts client-supplied provenance.** It accepts
   `p_source_type` / `p_source_external_id` / `p_source_certificate_id` as parameters and stamps
   `source_verified_at := clock_timestamp()` and `admission_status := 'ADMITTED'`
   unconditionally (`013100:192-193`). Nothing verifies the identifiers against an FGIS record.
   Brief item 2 — server-derived provenance — is a genuine correction to this function, not new
   surface.

4. **Buyer-facing read model is absent.** Brief item 3 needs a projection exposing permitted lot
   fields while withholding raw FGIS payload, credentials, internal IDs, reserves, PII and rival
   bids. `auction.lots` currently has one SELECT policy granting the *entire row* to any actor in
   the tenant, including `source_external_id` and `source_certificate_id`. There is no
   column-filtered view to build the cross-org showcase on.

---

## 4. Existing precedent for the tenant fix

The FGIS layer has already solved a structurally identical problem — granting one tenant scoped,
audited, expiring read access to another party's regulated data — via
`FgisGrainTenantReadAuthorization` (`20260730101500_fgis_grain_tenant_read_authority`):
explicit `allowedOperations`, `status`, `validUntil`, `authorizationReference`, attestation
evidence fields, versioning, and a paired audit + audit-head chain.

That is the shape to follow for cross-org auction participation, rather than inventing a second
mechanism or weakening the tenant predicate. It also keeps the change inside the auction bounded
context and away from the #3563 auth/registration boundary, which the brief forbids touching.

---

## 5. What this means for sequencing

Steps 2–7 of the brief are all downstream of a decision the audit cannot make on its own:
**how a lot becomes visible and biddable across tenant boundaries.** Wiring the UI first, as the
brief anticipates, would either return empty result sets or require loosening the tenant predicate
— the one change that would create the cross-organization leak P0.3 exists to prevent.

Additionally, the `PublishedLot → AuctionLot` bridge cannot be written until #3585 defines
`PublishedLot`.

---

## 6. Empirical confirmation

The findings above were derived from source, then executed against a PostgreSQL 16 instance built
by replaying all 93 migrations, with assertions run as a **non-superuser** (a superuser holds
`BYPASSRLS`, which makes every policy silently pass).

Confirmed by execution:

- **Three independent layers**, not one, enforce same-tenant trade. Beyond the RLS policies and the
  `WHERE tenant_id = current_setting(...)` lookups, `record_admission` additionally requires
  `organization."tenantId" = lot.tenant_id` (`013100:314`) and rejects a cross-tenant buyer with
  `AUCTION_BUYER_AUTHORITY_INVALID`. A cross-tenant buyer could not even be *admitted*, let alone bid.
- RLS behaves as read: under a non-privileged role, a buyer in its own tenant sees `0` lots; the
  same role with the seller's tenant in context sees `1`.
- `place_bid` raises `AUCTION_LOT_NOT_FOUND` for a cross-tenant buyer regardless of RLS, because the
  lookup is tenant-scoped inside the function.

One correction to §3 item 4, found only by executing it: it is not enough to add a column-filtered
showcase view. RLS filters **rows, not columns**, so a policy extended to honour a cross-tenant
grant hands the counterparty the whole base row — `source_external_id`, `source_certificate_id`,
`seller_user_id` and the pickup address included. This was observed directly before being fixed. The
base lot policy must stay tenant-local, with the showcase view running under the owner's rights and
carrying the authorization in its own `WHERE` clause.

A second issue surfaced the same way: `lock_lot()` derives its advisory lock from
`app.current_tenant_id`. Once bidders arrive from their own tenants, two buyers bidding on the same
lot take two *different* locks and serialize against nothing.

Both are addressed in `20260801120000_auction_cross_tenant_participation`; the executable proof is
`apps/api/test/sql/auction-cross-tenant-participation.acceptance.sql`.

Every finding is cited to `file:line` so it can be re-checked independently.
