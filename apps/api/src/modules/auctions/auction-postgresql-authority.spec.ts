import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');

function read(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

const migrationPath =
  'apps/api/prisma/migrations/20260713210000_auction_postgresql_authority/migration.sql';
const atomicMigrationPath =
  'apps/api/prisma/migrations/20260715013000_auction_atomic_execution/migration.sql';
const atomicMoneyMigrationPath =
  'apps/api/prisma/migrations/20260715013100_auction_atomic_execution/migration.sql';
const atomicCompatibilityMigrationPath =
  'apps/api/prisma/migrations/20260715013200_auction_atomic_execution/migration.sql';
const servicePath = 'apps/api/src/modules/auctions/auction-authority.service.ts';
const commandServicePath = 'apps/api/src/modules/auctions/auction-command.service.ts';
const controllerPath = 'apps/api/src/modules/auctions/auctions.controller.ts';
const lotsControllerPath = 'apps/api/src/modules/lots/lots.controller.ts';

describe('auction PostgreSQL authority', () => {
  it('creates no hard-coded auction or Deal facts', () => {
    const implementation = [read(migrationPath), read(servicePath)].join('\n');

    expect(implementation).not.toMatch(/INSERT\s+INTO\s+auction\./i);
    expect(implementation).not.toContain('LOT-001');
    expect(implementation).not.toContain('BID-001');
    expect(implementation).not.toContain('DL-2607-014');
    expect(implementation).not.toContain('FGIS-LOT-2607-014');
    expect(implementation).not.toContain('Math.random');
    expect(implementation).not.toContain('Date.now');
  });

  it('isolates the bounded context and enforces tenant FORCE-RLS on every authority table', () => {
    const migration = read(migrationPath);

    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS auction');
    expect(migration).toContain('REVOKE ALL ON SCHEMA auction FROM PUBLIC');
    expect(migration).toContain('GRANT USAGE ON SCHEMA auction TO app_deal');
    for (const table of ['lots', 'bids', 'awards']) {
      expect(migration).toContain(`ALTER TABLE auction.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE auction.${table} FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ON auction.${table}\nFOR SELECT`);
    }
    expect(migration).toContain("current_setting('app.current_tenant_id', true)");
    expect(migration).not.toMatch(/CREATE\s+POLICY[\s\S]+FOR\s+(?:INSERT|UPDATE|DELETE|ALL)/i);
  });

  it('binds lot, bid, award and server-issued Deal to one tenant and lot', () => {
    const migration = [read(migrationPath), read(atomicMigrationPath)].join('\n');

    expect(migration).toContain('FOREIGN KEY (tenant_id, lot_id)');
    expect(migration).toContain('FOREIGN KEY (tenant_id, lot_id, winning_bid_id)');
    expect(migration).toContain('server-issued Deal must match auction tenant');
    expect(migration).toContain('deal_tenant_id IS DISTINCT FROM NEW.tenant_id');
    expect(migration).toContain('deal_lot_id IS DISTINCT FROM NEW.lot_id');
    expect(migration).toContain("bid_status NOT IN ('ACCEPTED', 'WINNING')");
  });

  it('uses a trusted PostgreSQL transaction to issue the authority proof', () => {
    const service = read(servicePath);

    expect(service).toContain('this.rls.withTrustedContext');
    expect(service).toContain("source: 'POSTGRESQL'");
    expect(service).toContain("scope: 'AUCTION'");
    expect(service).toContain('transaction_timestamp() AS observed_at');
    expect(service).toContain('txid_current() AS tx_id');
    expect(service).toContain('current_database() AS database_name');
    expect(service).toContain('tenantId: context.tenantId');
    expect(service).toContain('actorId: context.userId');
    expect(service).toContain('FROM auction.lots l');
    expect(service).toContain('FROM auction.bids b');
    expect(service).toContain('FROM auction.awards a');
  });

  it('exposes bounded role-specific command endpoints without client-issued authority', () => {
    const controller = read(controllerPath);
    const commands = read(commandServicePath);

    expect(controller).toContain("@Get('origin-modes')");
    expect(controller).toContain("@Get('lots/:lotId/workspace')");
    expect(controller).toContain("@Post('lots')");
    expect(controller).toContain("@Post('lots/:lotId/admissions')");
    expect(controller).toContain("@Post('lots/:lotId/bids')");
    expect(controller).toContain("@Post('lots/:lotId/close')");
    expect(controller).not.toContain('createDeal');
    expect(controller).not.toContain('selectWinner');
    expect(commands).toContain('randomUUID()');
    expect(commands).toContain('Prisma.TransactionIsolationLevel.Serializable');
    expect(commands).toContain('auction.place_bid');
    expect(commands).toContain('auction.close_lot');
    expect(commands).not.toMatch(/commandId:\s*string;/);
  });

  it('persists replay-safe command receipts, audit, outbox and one confirmed basis', () => {
    const migration = [read(atomicMigrationPath), read(atomicMoneyMigrationPath)].join('\n');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS auction.command_receipts');
    expect(migration).toContain('AUCTION_IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('ORDER BY bid.amount_kopecks_per_ton DESC, bid.placed_at ASC, bid.id ASC');
    expect(migration).toContain("'DEAL_BASIS_READY'");
    expect(migration).toContain("'CONFIRMED'");
    expect(migration).toContain('auction.append_audit');
    expect(migration).toContain('auction.append_outbox');
    expect(migration).toContain('auction.save_command');
    expect(migration).toContain('amount_kopecks_per_ton bigint');
    expect(migration).toContain('total_kopecks := round');
  });

  it('grants the restricted principal only the canonical Deal consumption surface', () => {
    const migration = read(atomicCompatibilityMigrationPath);

    expect(migration).toContain('GRANT SELECT ON');
    expect(migration).toContain('public."outbox_entries"');
    expect(migration).toContain('public."integration_events"');
    expect(migration).toContain('GRANT INSERT ON');
    expect(migration).toContain('public."deal_events"');
    expect(migration).toContain('public."audit_events"');
    expect(migration).toContain('GRANT UPDATE ("sagaStep", "updatedAt") ON public."deals" TO app_deal');
    expect(migration).toContain('app_deal_basis_deal_visible(jsonb)');
    expect(migration).toContain('app_deal_basis_participant_allowed');
    expect(migration).not.toMatch(/GRANT\s+ALL/i);
    expect(migration).not.toMatch(/GRANT\s+(?:UPDATE|DELETE)\s+ON\s+public\."outbox_entries"/i);
    expect(migration).not.toMatch(/GRANT\s+DELETE/i);
  });

  it('replaces the authenticated lot registry with the PostgreSQL authority envelope', () => {
    const controller = read(lotsControllerPath);

    expect(controller).toContain("@Get('my')");
    expect(controller).toContain('this.auctionAuthority.listAccessibleLots(user)');
    expect(controller).not.toMatch(/my\([^)]*\)[\s\S]{0,120}this\.lots\.list/);
  });

  it('fails closed on contradictory award and Deal state', () => {
    const service = read(servicePath);

    expect(service).toContain('AUCTION_WINNER_WITHOUT_AWARD');
    expect(service).toContain('AUCTION_AWARD_BID_MISMATCH');
    expect(service).toContain('AUCTION_AWARD_LOT_STATE_MISMATCH');
    expect(service).toContain('AUCTION_DEAL_AUTHORITY_MISMATCH');
    expect(service).toContain("award.award_status === 'DEAL_CREATED'");
    expect(service).toContain('award.deal_source_lot_id === lot.id');
  });
});
