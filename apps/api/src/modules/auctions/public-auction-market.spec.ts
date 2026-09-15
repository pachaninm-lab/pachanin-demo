import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PublicAuctionMarketService } from './public-auction-market.service';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const minorUnitMigrationPath = 'apps/api/prisma/migrations/20260715013100_auction_atomic_execution/migration.sql';
const migrationPath = 'apps/api/prisma/migrations/20260913143000_public_market_lot_projection/migration.sql';
const servicePath = 'apps/api/src/modules/auctions/public-auction-market.service.ts';
const controllerPath = 'apps/api/src/modules/auctions/public-auction-market.controller.ts';
const modulePath = 'apps/api/src/modules/auctions/auctions.module.ts';
const webHelperPath = 'apps/web/lib/public-market-server.ts';
const webTeaserPath = 'apps/web/components/platform-v7/PublicMarketTeaser.tsx';
const webCssPath = 'apps/web/components/platform-v7/PublicMarketTeaser.module.css';
const webHomePath = 'apps/web/components/platform-v7/PlatformV7StrategicHome.tsx';

function read(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

describe('anonymous public Auction market projection', () => {
  it('projects only inventory-bound admitted BIDDING lots with truthful trust state', () => {
    const migration = read(migrationPath);
    expect(migration).toContain("l.status = 'BIDDING'");
    expect(migration).toContain("l.admission_status = 'ADMITTED'");
    expect(migration).toContain('JOIN auction.inventory_bindings b');
    expect(migration).toContain("'DECLARED'");
    expect(migration).toContain("'PUBLIC_ALLOWED'");
    expect(migration).toContain('l.auction_ends_at > transaction_timestamp()');
    expect(migration).toContain("l.source_type = 'OTHER'");
    expect(migration).toContain('l.source_verified_at IS NULL');
    expect(migration).toContain('l.source_certificate_id IS NULL');
    expect(migration).toContain('ON auction.public_market_lot_cards (projected_at DESC, auction_ends_at ASC, public_ref ASC)');
    expect(migration).toContain("WHERE status = 'BIDDING' AND trade_permission = 'PUBLIC_ALLOWED'");
  });

  it('binds projected prices to the canonical minor-unit schema authority', () => {
    const precursor = read(minorUnitMigrationPath);
    const migration = read(migrationPath);
    expect(precursor).toContain('ADD COLUMN IF NOT EXISTS start_price_kopecks_per_ton bigint');
    expect(precursor).toContain('start_price_kopecks_per_ton = start_price_rub_per_ton * 100');
    expect(migration).toContain("a.attname = 'start_price_kopecks_per_ton'");
    expect(migration).toContain("pg_catalog.format_type(a.atttypid, a.atttypmod) = 'bigint'");
    expect(migration).toContain('PUBLIC_MARKET_REQUIRES_AUCTION_MINOR_UNIT_PRICE_AUTHORITY');
    expect(migration).toContain('l.start_price_kopecks_per_ton');
    expect(migration).not.toContain('l.start_price_rub_per_ton');
  });

  it('keeps the public function anonymous and never returns the canonical lot or seller identity', () => {
    const migration = read(migrationPath);
    const publicFunction = migration.split('CREATE FUNCTION auction.list_public_market_lot_cards')[1] ?? '';
    const returns = publicFunction.split('AS $function$')[0] ?? '';
    expect(returns).toContain('observed_at timestamptz');
    expect(returns).toContain('public_ref text');
    expect(returns).toContain('culture text');
    expect(returns).toContain('region text');
    expect(returns).not.toMatch(/tenant|seller|organization|user|address|source_external|certificate|inventory|reservation|lot_id/i);
  });

  it('does not grant runtime principals direct access to the projection table', () => {
    const migration = read(migrationPath);
    expect(migration).toContain('ALTER TABLE auction.public_market_lot_cards FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('TO pc_inventory_authority');
    expect(migration).toContain('REVOKE ALL ON auction.public_market_lot_cards FROM PUBLIC');
    expect(migration).toContain("REVOKE ALL ON TABLE auction.public_market_lot_cards FROM %I");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION auction.list_public_market_lot_cards(integer) TO %I");
    expect(migration).not.toMatch(/GRANT\s+SELECT\s+ON\s+(?:TABLE\s+)?auction\.public_market_lot_cards\s+TO\s+(?:app_|pc_deal|one_deal)/i);
  });

  it('fail-closes the SECURITY DEFINER reader unless caller, function owner and FORCE RLS authority remain valid', () => {
    const migration = read(migrationPath);
    const authorityGuard = migration.indexOf("current_user <> 'pc_inventory_authority'");
    const callerPrivilegeGuard = migration.indexOf('pg_catalog.has_function_privilege(');
    expect(authorityGuard).toBeGreaterThan(-1);
    expect(callerPrivilegeGuard).toBeGreaterThan(authorityGuard);
    expect(migration).toContain("session_user = 'pc_inventory_authority'");
    expect(migration).toContain('session_user = current_user');
    expect(migration).toContain('p.prosecdef');
    expect(migration).toContain("pg_catalog.pg_get_userbyid(p.proowner) = 'pc_inventory_authority'");
    expect(migration).toContain('session_user,');
    expect(migration).toContain("'auction.list_public_market_lot_cards(integer)'::regprocedure");
    expect(migration).toContain("'EXECUTE'");
    expect(migration).toContain("RAISE EXCEPTION 'PUBLIC_MARKET_READER_DENIED'");
    expect(migration).toContain('c.relrowsecurity');
    expect(migration).toContain('c.relforcerowsecurity');
    expect(migration).toContain("RAISE EXCEPTION 'PUBLIC_MARKET_RLS_AUTHORITY_INVALID'");
    expect(migration).toContain("USING ERRCODE = '42501'");
  });

  it('updates the projection transactionally, skips unrelated lot updates and preserves forward-only hiding', () => {
    const migration = read(migrationPath);
    expect(migration).toContain('CREATE CONSTRAINT TRIGGER auction_public_market_lot_sync');
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain('EXECUTE FUNCTION auction.sync_public_market_lot_card()');
    expect(migration).toContain('ON CONFLICT (lot_id) DO UPDATE');
    expect(migration).toContain("status text NOT NULL CHECK (status IN ('BIDDING', 'HIDDEN'))");
    expect(migration).toContain("SET status = 'HIDDEN'");
    expect(migration).toContain("AND status <> 'HIDDEN'");
    expect(migration).toContain("WHERE c.status = 'BIDDING'");
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);

    const deltaGuardStart = migration.indexOf("IF TG_OP = 'UPDATE'");
    const deltaGuardEnd = migration.indexOf('THEN\n    RETURN NEW;', deltaGuardStart);
    const upsertStart = migration.indexOf('ON CONFLICT (lot_id) DO UPDATE');
    expect(deltaGuardStart).toBeGreaterThan(-1);
    expect(deltaGuardEnd).toBeGreaterThan(deltaGuardStart);
    expect(upsertStart).toBeGreaterThan(deltaGuardEnd);
    const deltaGuard = migration.slice(deltaGuardStart, deltaGuardEnd);
    expect(deltaGuard).toContain('NEW.culture IS NOT DISTINCT FROM OLD.culture');
    expect(deltaGuard).toContain('NEW.volume_tons IS NOT DISTINCT FROM OLD.volume_tons');
    expect(deltaGuard).toContain('NEW.start_price_kopecks_per_ton IS NOT DISTINCT FROM OLD.start_price_kopecks_per_ton');
    expect(deltaGuard).toContain('NEW.auction_ends_at IS NOT DISTINCT FROM OLD.auction_ends_at');
    expect(deltaGuard).toContain('NEW.admission_status IS NOT DISTINCT FROM OLD.admission_status');
    expect(deltaGuard).toContain('NEW.inventory_binding_id IS NOT DISTINCT FROM OLD.inventory_binding_id');
    expect(deltaGuard).toContain('NEW.source_verified_at IS NOT DISTINCT FROM OLD.source_verified_at');
    expect(deltaGuard).not.toContain('NEW.version');
  });

  it('uses one PostgreSQL statement and one server-side statement clock for live and empty public-market reads', () => {
    const migration = read(migrationPath);
    const service = read(servicePath);
    const publicFunction = migration.split('CREATE FUNCTION auction.list_public_market_lot_cards')[1] ?? '';

    expect(publicFunction).toContain('v_observed_at timestamptz := statement_timestamp();');
    expect(publicFunction).toContain('AND c.auction_ends_at > v_observed_at');
    expect(publicFunction).toContain('v_observed_at AS observed_at');
    expect(publicFunction).toContain('WHERE NOT EXISTS (SELECT 1 FROM live_cards)');
    expect(service).toContain('SELECT *');
    expect(service).toContain('FROM auction.list_public_market_lot_cards(${PUBLIC_MARKET_LIMIT + 1})');
    expect(service).not.toContain('WITH observation AS MATERIALIZED');
    expect(service).not.toContain('LEFT JOIN LATERAL');
    expect(service).not.toContain('transaction_timestamp()');
    expect(service).toContain('row.observed_at.getTime() !== observedAt.getTime()');
    expect(service).toContain('row.auction_ends_at.getTime() <= observedAt.getTime()');
    expect(service).toContain('isEmptyProjectionRow(row)');
    expect(service).toContain("PUBLIC_MARKET_POSTGRESQL_CLOCK_DRIFT");
    expect(service).toContain("PUBLIC_MARKET_AUCTION_NOT_LIVE");
    expect(service.match(/\$queryRaw/g)?.length).toBe(1);
    expect(service).not.toContain('$transaction');
    expect(service).not.toContain('RepeatableRead');
  });

  it('serves a bounded PostgreSQL authority envelope without tenant, seller or database activity identifiers', () => {
    const service = read(servicePath);
    expect(service).toContain('auction.list_public_market_lot_cards(${PUBLIC_MARKET_LIMIT + 1})');
    expect(service).toContain("source: 'POSTGRESQL'");
    expect(service).toContain("scope: 'PUBLIC_MARKET'");
    expect(service).toContain("projection: 'ANONYMIZED_PUBLIC_MARKET'");
    expect(service).toContain("sellerIdentity: 'REDACTED'");
    expect(service).toContain("disclosureCode: 'SELLER_DECLARED_NOT_INDEPENDENTLY_VERIFIED'");
    expect(service).not.toContain('tenantId:');
    expect(service).not.toContain('sellerOrgId');
    expect(service).not.toContain('sellerUserId');
    expect(service).not.toContain('address:');
    expect(service).not.toContain('txid_current');
    expect(service).not.toContain('transactionId');
  });

  it('mounts a rate-limited public read route without weakening the authenticated auction controller', () => {
    const controller = read(controllerPath);
    const module = read(modulePath);
    expect(controller).toContain("@Controller('market')");
    expect(controller).toContain('@Public()');
    expect(controller).toContain("name: 'public_market_lots'");
    expect(controller).toContain("scope: 'ip'");
    expect(controller).toContain("@Get('lots')");
    expect(module).toContain('PublicAuctionMarketController');
    expect(module).toContain('PublicAuctionMarketService');
  });

  it('keeps the public web read unauthenticated, bounded, PostgreSQL-bound, metadata-minimal and fail-closed', () => {
    const helper = read(webHelperPath);
    expect(helper).toContain("serverApiUrl('/market/lots')");
    expect(helper).toContain("cache: 'no-store'");
    expect(helper).toContain("headers: { accept: 'application/json' }");
    expect(helper).toContain('PUBLIC_MARKET_FETCH_TIMEOUT_MS = 2_000');
    expect(helper).toContain('signal: AbortSignal.timeout(PUBLIC_MARKET_FETCH_TIMEOUT_MS)');
    expect(helper).not.toContain('serverAuthHeaders');
    expect(helper).toContain("scope: 'PUBLIC_MARKET'");
    expect(helper).toContain("projection: 'ANONYMIZED_PUBLIC_MARKET'");
    expect(helper).toContain("sellerIdentity: 'REDACTED'");
    expect(helper).not.toContain('transactionId');
    expect(helper).toContain('available: false');
    expect(helper).toContain('items: Object.freeze([])');
  });

  it('streams public market data behind Suspense so the home shell does not wait for market authority', () => {
    const teaser = read(webTeaserPath);
    expect(teaser).toContain("import { Suspense } from 'react';");
    expect(teaser).toContain('export function PublicMarketTeaser');
    expect(teaser).not.toContain('export async function PublicMarketTeaser');
    expect(teaser).toContain("<Suspense fallback={<MarketLoading text={copy.loading} />}>");
    expect(teaser).toContain('<PublicMarketLotResults locale={lang} />');
    expect(teaser).toContain('async function PublicMarketLotResults');
    expect(teaser).toContain("data-testid='public-market-teaser-loading'");
    expect(teaser).toContain("aria-busy='true'");

    const wrapperStart = teaser.indexOf('export function PublicMarketTeaser');
    const suspenseStart = teaser.indexOf('<Suspense ', wrapperStart);
    const asyncChildStart = teaser.indexOf('async function PublicMarketLotResults');
    const authorityFetch = teaser.indexOf('getPublicMarketLots()', asyncChildStart);
    expect(suspenseStart).toBeGreaterThan(wrapperStart);
    expect(asyncChildStart).toBeGreaterThan(suspenseStart);
    expect(authorityFetch).toBeGreaterThan(asyncChildStart);
  });

  it('renders a truthful anonymized teaser without demo fallback or identity leakage', () => {
    const teaser = read(webTeaserPath);
    expect(teaser).toContain('Демо-лоты не подставляются');
    expect(teaser).toContain('No demo lots are substituted');
    expect(teaser).toContain('系统不会填充演示批次');
    expect(teaser).not.toMatch(/LOT-001|BID-001|DL-2607-014/);
    expect(teaser).toContain('Продавец скрыт');
    expect(teaser).toContain('Наличие заявлено продавцом');
    expect(teaser).toContain('Независимое подтверждение не получено');
    expect(teaser).toContain('Полная карточка, контрагент, предложение и ставка доступны только после входа.');
    expect(teaser).not.toContain('lot.seller');
    expect(teaser).not.toContain('lot.address');
    expect(teaser).not.toContain('lot.publicRef}</');
    expect(teaser).not.toMatch(/href=.*publicRef/);
  });

  it('gates per-lot details and bidding plus section-level market actions behind localized auth without leaking lot identity', () => {
    const teaser = read(webTeaserPath);
    const css = read(webCssPath);
    const home = read(webHomePath);
    expect(teaser).toContain('/platform-v7/register?lang=');
    expect(teaser).toContain('/platform-v7/login?lang=');
    expect(teaser).toContain("details: 'Подробнее после входа'");
    expect(teaser).toContain("bid: 'Сделать ставку'");
    expect(teaser).toContain("details: 'View details after sign-in'");
    expect(teaser).toContain("bid: 'Place a bid'");
    expect(teaser).toContain("details: '登录后查看详情'");
    expect(teaser).toContain("bid: '参与竞价'");
    expect(teaser).toContain("data-testid='public-market-lot-actions'");
    expect(teaser).toContain('href={loginHref}>{copy.details}</a>');
    expect(teaser).toContain('href={registerHref}>{copy.bid}');
    expect(teaser).not.toMatch(/href=.*publicRef/);
    expect(home).toContain("import { PublicMarketTeaser } from './PublicMarketTeaser';");
    expect(home).toContain("const MARKET_NAV_LABEL: Record<Locale, string> = {");
    expect(home).toContain('const marketNavLabel = MARKET_NAV_LABEL[normalizedLocale];');
    expect(home).not.toContain("const marketNavLabel = normalizedLocale ===");
    expect(home).toContain("<a href='#market'>{marketNavLabel}</a>");
    expect(home).toContain('<PublicMarketTeaser locale={locale} />');
    expect(teaser).toContain("id='market'");
    expect(teaser).toContain("data-testid='public-market-teaser'");
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (max-width: 390px)');
  });
});

describe('public market teaser page bounds', () => {
  const observedAt = new Date('2026-09-15T12:00:00.000Z');
  const lotRow = (index: number) => ({
    observed_at: observedAt,
    public_ref: `market-00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    culture: 'wheat',
    grade: '3',
    volume_tons: '10.500000',
    start_price_kopecks_per_ton: '9007199254740993',
    region: 'Тамбовская область',
    auction_ends_at: new Date('2026-09-16T12:00:00.000Z'),
    status: 'BIDDING',
    verification_status: 'DECLARED',
    trade_permission: 'PUBLIC_ALLOWED',
    lot_version: String(index + 1),
    projected_at: observedAt,
  });
  const emptyRow = {
    observed_at: observedAt,
    public_ref: null,
    culture: null,
    grade: null,
    volume_tons: null,
    start_price_kopecks_per_ton: null,
    region: null,
    auction_ends_at: null,
    status: null,
    verification_status: null,
    trade_permission: null,
    lot_version: null,
    projected_at: null,
  };
  const harness = (rows: unknown[]) => {
    const query = jest.fn().mockResolvedValue(rows);
    const prisma = { $queryRaw: query } as unknown as ConstructorParameters<typeof PublicAuctionMarketService>[0];
    return { query, service: new PublicAuctionMarketService(prisma) };
  };

  it.each([0, 1, 6, 7])('returns one bounded six-card page for %i eligible rows', async (count) => {
    const rows = count === 0 ? [emptyRow] : Array.from({ length: count }, (_, index) => lotRow(index));
    const { query, service } = harness(rows);
    const result = await service.listLots();
    const returned = Math.min(count, 6);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0].values).toEqual([7]);
    expect(result.items).toHaveLength(returned);
    expect(result.items.map((item) => item.publicRef)).toEqual(rows.slice(0, returned).map((row) => row.public_ref));
    expect(result.pageInfo).toEqual({ limit: 6, returned, hasMore: count > 6 });
    expect(result.authority.observedAt).toBe(observedAt.toISOString());
    expect(result.authority.version).toBe(String(returned));
    for (const item of result.items) {
      expect(item.startPriceKopecksPerTon).toBe('9007199254740993');
      expect(item.volumeTons).toBe('10.5');
      expect(item.verificationStatus).toBe('DECLARED');
    }
  });

  it('rejects a result exceeding the requested page plus one-row lookahead', async () => {
    const { service } = harness(Array.from({ length: 8 }, (_, index) => lotRow(index)));
    await expect(service.listLots()).rejects.toMatchObject({
      response: { code: 'PUBLIC_MARKET_PAGE_BOUND_EXCEEDED' },
    });
  });

  it('validates the lookahead row before using it as evidence of more results', async () => {
    const rows = Array.from({ length: 7 }, (_, index) => lotRow(index));
    rows[6].auction_ends_at = observedAt;
    const { service } = harness(rows);
    await expect(service.listLots()).rejects.toMatchObject({
      response: { code: 'PUBLIC_MARKET_AUCTION_NOT_LIVE' },
    });
  });

  it('rejects clock drift in the lookahead row instead of publishing mixed snapshots', async () => {
    const rows = Array.from({ length: 7 }, (_, index) => lotRow(index));
    rows[6].observed_at = new Date(observedAt.getTime() + 1);
    const { service } = harness(rows);
    await expect(service.listLots()).rejects.toMatchObject({
      response: { code: 'PUBLIC_MARKET_POSTGRESQL_CLOCK_DRIFT' },
    });
  });

  it('renders the complete API page without discarding another subset in the web consumer', () => {
    const teaser = read(webTeaserPath);
    const childStart = teaser.indexOf('async function PublicMarketLotResults');
    const childEnd = teaser.indexOf('\nfunction LotCard', childStart);
    expect(childStart).toBeGreaterThan(-1);
    expect(childEnd).toBeGreaterThan(childStart);
    const child = teaser.slice(childStart, childEnd);
    expect(child).toContain('const items = market.items;');
    expect(child).toContain('{items.map((lot) => (');
    expect(child).not.toMatch(/\.slice\s*\(/);
  });
});
