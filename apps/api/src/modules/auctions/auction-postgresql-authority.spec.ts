import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');

function read(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

const migrationPath =
  'apps/api/prisma/migrations/20260713210000_auction_postgresql_authority/migration.sql';
const servicePath = 'apps/api/src/modules/auctions/auction-authority.service.ts';
const controllerPath = 'apps/api/src/modules/auctions/auctions.controller.ts';
const lotsControllerPath = 'apps/api/src/modules/lots/lots.controller.ts';

describe('auction PostgreSQL authority', () => {
  it('creates no hard-coded auction or Deal facts', () => {
    const implementation = [read(migrationPath), read(servicePath)].join('\n');

    expect(implementation).not.toMatch(/INSERT\s+INTO\s+public\.auction_/i);
    expect(implementation).not.toContain('LOT-001');
    expect(implementation).not.toContain('BID-001');
    expect(implementation).not.toContain('DL-2607-014');
    expect(implementation).not.toContain('FGIS-LOT-2607-014');
    expect(implementation).not.toContain('Math.random');
    expect(implementation).not.toContain('Date.now');
  });

  it('enforces tenant FORCE-RLS for every auction authority table', () => {
    const migration = read(migrationPath);

    for (const table of ['auction_lots', 'auction_bids', 'auction_awards']) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ON public.${table}\nFOR SELECT`);
    }
    expect(migration).toContain("current_setting('app.current_tenant_id', true)");
    expect(migration).not.toMatch(/CREATE\s+POLICY[\s\S]+FOR\s+(?:INSERT|UPDATE|DELETE|ALL)/i);
  });

  it('binds lot, bid, award and server-issued Deal to one tenant and lot', () => {
    const migration = read(migrationPath);

    expect(migration).toContain('FOREIGN KEY (tenant_id, lot_id)');
    expect(migration).toContain('FOREIGN KEY (tenant_id, lot_id, winning_bid_id)');
    expect(migration).toContain('server-issued Deal must match auction tenant and lot');
    expect(migration).toContain('deal_tenant_id IS DISTINCT FROM NEW.tenant_id');
    expect(migration).toContain('deal_source_lot_id IS DISTINCT FROM NEW.lot_id');
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
  });

  it('exposes only read endpoints and does not create bids, awards or Deals', () => {
    const controller = read(controllerPath);

    expect(controller).toContain("@Get('origin-modes')");
    expect(controller).toContain("@Get('lots/:lotId/workspace')");
    expect(controller).not.toMatch(/@(Post|Patch|Put|Delete)\(/);
    expect(controller).not.toContain('createDeal');
    expect(controller).not.toContain('selectWinner');
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
