import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');
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
  });

  it('keeps the public function anonymous and never returns the canonical lot or seller identity', () => {
    const migration = read(migrationPath);
    const publicFunction = migration.split('CREATE FUNCTION auction.list_public_market_lot_cards')[1] ?? '';
    const returns = publicFunction.split('AS $function$')[0] ?? '';
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

  it('fail-closes the SECURITY DEFINER reader unless caller, owner and FORCE RLS authority remain valid', () => {
    const migration = read(migrationPath);
    expect(migration).toContain('pg_catalog.has_function_privilege(');
    expect(migration).toContain('session_user,');
    expect(migration).toContain("'auction.list_public_market_lot_cards(integer)'::regprocedure");
    expect(migration).toContain("'EXECUTE'");
    expect(migration).toContain("RAISE EXCEPTION 'PUBLIC_MARKET_READER_DENIED'");
    expect(migration).toContain("current_user <> 'pc_inventory_authority'");
    expect(migration).toContain('c.relrowsecurity');
    expect(migration).toContain('c.relforcerowsecurity');
    expect(migration).toContain("RAISE EXCEPTION 'PUBLIC_MARKET_RLS_AUTHORITY_INVALID'");
    expect(migration).toContain("USING ERRCODE = '42501'");
  });

  it('updates the projection transactionally and preserves forward-only history when a lot stops being public', () => {
    const migration = read(migrationPath);
    expect(migration).toContain('CREATE CONSTRAINT TRIGGER auction_public_market_lot_sync');
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain('EXECUTE FUNCTION auction.sync_public_market_lot_card()');
    expect(migration).toContain('ON CONFLICT (lot_id) DO UPDATE');
    expect(migration).toContain("status text NOT NULL CHECK (status IN ('BIDDING', 'HIDDEN'))");
    expect(migration).toContain("SET status = 'HIDDEN'");
    expect(migration).toContain("WHERE c.status = 'BIDDING'");
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('serves a bounded PostgreSQL authority envelope without tenant, seller or database activity identifiers', () => {
    const service = read(servicePath);
    expect(service).toContain('auction.list_public_market_lot_cards(${PUBLIC_MARKET_LIMIT})');
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

  it('keeps the public web read unauthenticated, PostgreSQL-bound, metadata-minimal and fail-closed', () => {
    const helper = read(webHelperPath);
    expect(helper).toContain("serverApiUrl('/market/lots')");
    expect(helper).toContain("cache: 'no-store'");
    expect(helper).toContain("headers: { accept: 'application/json' }");
    expect(helper).not.toContain('serverAuthHeaders');
    expect(helper).toContain("scope: 'PUBLIC_MARKET'");
    expect(helper).toContain("projection: 'ANONYMIZED_PUBLIC_MARKET'");
    expect(helper).toContain("sellerIdentity: 'REDACTED'");
    expect(helper).not.toContain('transactionId');
    expect(helper).toContain('available: false');
    expect(helper).toContain('items: Object.freeze([])');
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

  it('gates full market actions behind localized auth and keeps a mobile-safe home surface', () => {
    const teaser = read(webTeaserPath);
    const css = read(webCssPath);
    const home = read(webHomePath);
    expect(teaser).toContain('/platform-v7/register?lang=');
    expect(teaser).toContain('/platform-v7/login?lang=');
    expect(home).toContain("import { PublicMarketTeaser } from './PublicMarketTeaser';");
    expect(home).toContain("<a href='#market'>{marketNavLabel}</a>");
    expect(home).toContain('<PublicMarketTeaser locale={locale} />');
    expect(teaser).toContain("id='market'");
    expect(teaser).toContain("data-testid='public-market-teaser'");
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (max-width: 390px)');
  });
});
