import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const accessPage = read('apps/web/app/platform-v7/fgis-access/page.tsx');
const accessContract = read('apps/web/lib/platform-v7/farmerFgisAccessEngine.ts');
const workspace = read('apps/web/components/transaction-ux/AuctionPostgresAuthorityWorkspace.tsx');
const auctionServer = read('apps/web/lib/auction-server.ts');
const auctionRoutes = [
  'apps/web/app/platform-v7/auction/page.tsx',
  'apps/web/app/platform-v7/auction/import/page.tsx',
  'apps/web/app/platform-v7/auction/admission/page.tsx',
  'apps/web/app/platform-v7/auction/bids/page.tsx',
  'apps/web/app/platform-v7/auction/deal-basis/page.tsx',
].map(read);

const forbiddenFixtureMarkers = [
  'FARMER_FGIS_ACCESS_STATE',
  'FGIS-LOT-2607-014',
  'SDIZ-2607-5512',
  'ООО «Колос-Агро»',
  '7701234567',
];

describe('platform-v7 FGIS access PostgreSQL authority flow', () => {
  it('uses the same canonical import workspace instead of a second FGIS implementation', () => {
    expect(accessPage).toContain('AuctionPostgresAuthorityWorkspace');
    expect(accessPage).toContain("stage='import'");
    expect(accessPage).toContain('lotId={firstParam(searchParams?.lotId)}');
    expect(accessPage).toContain("getAuctionAuthorityMetadata('import')");
    expect(accessPage).not.toContain('style={{');
    expect(accessPage).not.toContain('platformV7RouteIcon');
    for (const marker of forbiddenFixtureMarkers) expect(accessPage).not.toContain(marker);
  });

  it('retains organization confirmation without claiming live FGIS access', () => {
    expect(accessPage).toContain('/api/platform-v7/gov-id/start?flow=fgis');
    expect(accessPage).toContain('Подтвердить организацию');
    expect(accessPage).toContain('Confirm organization');
    expect(accessPage).toContain('确认组织');
    expect(accessPage).toContain('не заменяет доступ к ФГИС');
    expect(accessPage).toContain('does not replace grain-registry access');
    expect(accessPage).toContain('不能替代粮食登记系统访问');
  });

  it('keeps the historical farmer access engine type-only and fixture-free', () => {
    expect(accessContract).toContain('Type-only compatibility contract');
    expect(accessContract).not.toMatch(/export\s+(?:const|let|var|function|class)\b/);
    expect(accessContract).not.toContain('/platform-v7/');
    expect(accessContract).not.toContain('canPullFgisDealSeed');
    expect(accessContract).not.toContain('fgisAccessStatusLabel');
    expect(accessContract).not.toContain('fgisPullStatusLabel');
    for (const marker of forbiddenFixtureMarkers) expect(accessContract).not.toContain(marker);
  });

  it('accepts only authenticated tenant-scoped PostgreSQL auction envelopes', () => {
    expect(auctionServer).toContain("serverApiUrl('/lots/my')");
    expect(auctionServer).toContain('serverApiUrl(`/auctions/lots/${safeLotId}/workspace`)');
    expect(auctionServer).toContain('serverAuthHeaders()');
    expect(auctionServer).toContain("cache: 'no-store'");
    expect(auctionServer).toContain("source !== 'POSTGRESQL'");
    expect(auctionServer).toContain("scope !== 'AUCTION'");
    expect(auctionServer).toContain('dealCreated !== Boolean(dealId)');
    expect(auctionServer).not.toContain('fixture');
  });

  it('cross-checks tenant actor and lot identity and remains read-only', () => {
    expect(workspace).toContain('left.tenantId === right.tenantId');
    expect(workspace).toContain('left.actorId === right.actorId');
    expect(workspace).toContain('workspaceResult.data.lotId === selectedLot.id');
    expect(workspace).toContain('const workspace = authorityConsistent');
    expect(workspace).toContain('The UI is read-only');
    expect(workspace).toContain('dealCreated && workspace?.executionBridge.dealId');
    expect(workspace).not.toMatch(/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
    expect(workspace).not.toContain('BID-001');
    expect(workspace).not.toContain('FGIS-LOT-2607-014');
  });

  it('keeps all canonical auction routes on the same workspace', () => {
    for (const route of auctionRoutes) {
      expect(route).toContain('AuctionPostgresAuthorityWorkspace');
      expect(route).not.toContain('FGIS_AUCTION_STATE');
      expect(route).not.toContain('AUCTION_DEAL_BRIDGE');
    }
  });
});
