# SQL acceptance proofs

Executable proofs that run directly against a migrated PostgreSQL database, as a
non-superuser, so row-level security is genuinely enforced rather than bypassed.

## Why a non-superuser matters

A superuser (and `postgres` in particular) has `BYPASSRLS`. Running these checks
as `postgres` makes every policy silently pass and every isolation assertion
meaningless — a cross-tenant reader appears to see rows it must never see. The
scripts therefore `SET ROLE` to an unprivileged probe role before asserting
anything.

## auction-cross-tenant-participation.acceptance.sql

Covers P0.3: a verified lot belonging to seller organization A is traded to
buyer organization B, where A and B hold **separate tenants**, which is what
production registration produces (`auth.service.ts` assigns
`tenant_${randomUUID()}` per organization).

What it asserts:

| # | Assertion |
| --- | --- |
| 2 | Without a grant, the counterparty sees no lot and cannot bid |
| 3 | Participation grants are issued by the lot's own tenant; a grant naming the seller is refused |
| 4 | Cross-tenant buyers are admitted, and the admission records the buyer's real tenant |
| 5 | The counterparty reads the lot only through `auction.lot_showcase`; the base table stays closed and the withheld columns are absent from the projection |
| 6 | Both cross-tenant buyers can bid |
| 7 | A buyer sees only its own bids, while still seeing the leading price it must beat |
| 8 | A BUYER membership inside the seller organization cannot self-bid |
| 9 | Revocation closes visibility and bidding immediately |
| 10 | Replaying a bid returns the original receipt rather than bidding twice |
| 11 | Closing produces exactly one award, the correct cross-tenant winner, and a deal basis carrying both tenants |

### Running it

```bash
createdb tp
psql -d tp -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
for d in apps/api/prisma/migrations/*/; do
  psql -d tp -v ON_ERROR_STOP=1 -f "$d/migration.sql"
done

psql -d tp <<'SQL'
CREATE ROLE app_probe NOLOGIN;
GRANT USAGE ON SCHEMA auction, public TO app_probe;
GRANT SELECT ON ALL TABLES IN SCHEMA auction TO app_probe;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_probe;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auction TO app_probe;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_probe;
SQL

psql -d tp -f apps/api/test/sql/auction-cross-tenant-participation.acceptance.sql
```

`0001_postgresql_initial` ends with an `INSERT INTO "_prisma_migrations"` and
fails when the migrations are replayed with plain `psql` instead of
`prisma migrate deploy`. That single failure is bookkeeping only and does not
affect the schema under test.

The script is written to run once against a fresh database. Re-running it on the
same database correctly trips idempotency (`AUCTION_IDEMPOTENCY_PAYLOAD_MISMATCH`)
because the command receipts from the first run are still present.

### Still to be converted

These assertions belong in the `apps/api/test/industrial` Jest harness alongside
`auction-atomic-execution.e2e-spec.ts` so they run in CI. That conversion is
pending; note that the existing industrial spec seeds every bidding counterparty
into one shared tenant, which is the assumption P0.3 removes.
