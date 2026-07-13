import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const auctionRoutes = [
  'apps/web/app/platform-v7/auction/page.tsx',
  'apps/web/app/platform-v7/auction/import/page.tsx',
  'apps/web/app/platform-v7/auction/admission/page.tsx',
  'apps/web/app/platform-v7/auction/bids/page.tsx',
  'apps/web/app/platform-v7/auction/deal-basis/page.tsx',
];

const workspacePath = 'apps/web/components/transaction-ux/AuctionPostgresAuthorityWorkspace.tsx';

describe('platform-v7 FGIS access flow', () => {
  it('keeps FGIS page connected to organisation check and deal import flow', () => {
    const page = read('apps/web/app/platform-v7/fgis-access/page.tsx');
    expect(page).toContain('/api/platform-v7/gov-id/start?flow=fgis');
    expect(page).toContain('Подтвердить организацию для ФГИС');
    expect(page).toContain('право на импорт партии');
    expect(page).toContain('platformV7RouteIcon');
  });

  it('keeps FGIS page connected to route icon registry', () => {
    const page = read('apps/web/app/platform-v7/fgis-access/page.tsx');
    expect(page).toContain("platformV7RouteIcon('fgis')");
    expect(page).toContain("platformV7RouteIcon('auction')");
    expect(page).toContain("platformV7RouteIcon('compliance')");
  });

  it('keeps FGIS access state connected to the auction entry routes', () => {
    const engine = read('apps/web/lib/platform-v7/farmerFgisAccessEngine.ts');
    expect(engine).toContain('/platform-v7/auction/import');
    expect(engine).toContain('/platform-v7/auction/admission');
    expect(engine).toContain('/platform-v7/auction');
    expect(engine).toContain('ownerInn');
    expect(engine).toContain('lotNumber');
    expect(engine).toContain('sdizNumber');
  });

  it('routes every auction phase through one PostgreSQL-proof workspace', () => {
    for (const route of auctionRoutes) {
      const source = read(route);
      expect(source).toContain('AuctionPostgresAuthorityWorkspace');
      expect(source).toContain('lotId');
      expect(source).not.toContain('FGIS_AUCTION_STATE');
      expect(source).not.toContain('AUCTION_DEAL_BRIDGE');
      expect(source).not.toContain('AUCTION_DEAL_BASIS');
      expect(source).not.toContain('winner =');
    }
  });

  it('preserves import, admission, bids and Deal-basis stages without local authority', () => {
    const workspace = read(workspacePath);
    expect(workspace).toContain("'overview' | 'import' | 'admission' | 'bids' | 'deal-basis'");
    expect(workspace).toContain('getAccessibleAuctionLotsCanonical');
    expect(workspace).toContain('getAuctionWorkspaceCanonical');
    expect(workspace).toContain('sameAuthority');
    expect(workspace).toContain('dealCreated=true');
    expect(workspace).not.toContain('BID-001');
    expect(workspace).not.toContain('DL-2607-014');
    expect(workspace).not.toContain('FGIS-LOT-2607-014');
  });

  it('keeps FGIS and SDIZ external until their identifiers are confirmed', () => {
    const workspace = read(workspacePath);
    expect(workspace).toContain('Текущий workspace не содержит подтверждённых реквизитов ФГИС/СДИЗ');
    expect(workspace).toContain('does not include confirmed registry/certificate identifiers');
    expect(workspace).toContain('不包含已确认的登记/凭证标识');
  });
});
