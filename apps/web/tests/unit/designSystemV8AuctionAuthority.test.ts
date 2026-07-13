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

const routes = [
  'apps/web/app/platform-v7/auction/page.tsx',
  'apps/web/app/platform-v7/auction/import/page.tsx',
  'apps/web/app/platform-v7/auction/admission/page.tsx',
  'apps/web/app/platform-v7/auction/bids/page.tsx',
  'apps/web/app/platform-v7/auction/deal-basis/page.tsx',
];

describe('Design System v8 auction server authority', () => {
  it('registers every auction phase as a governed route', () => {
    const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
    for (const route of routes) expect(governance.migratedFiles).toContain(route);
  });

  it('uses one governed workspace without route-local visual or business authority', () => {
    for (const route of routes) {
      const source = read(route);
      expect(source).toContain('AuctionServerAuthorityWorkspace');
      expect(source).not.toMatch(/style=\{\{/);
      expect(source).not.toContain('dangerouslySetInnerHTML');
      expect(source).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(source).not.toContain('FGIS_AUCTION_STATE');
      expect(source).not.toContain('AUCTION_DEAL_BRIDGE');
    }
  });

  it('reads only organization-scoped lots and a validated server workspace', () => {
    const boundary = read('apps/web/lib/auction-server.ts');
    expect(boundary).toContain("serverApiUrl('/lots/my')");
    expect(boundary).toContain('/auctions/lots/${safeLotId}/workspace');
    expect(boundary).toContain("cache: 'no-store'");
    expect(boundary).toContain('serverAuthHeaders()');
    expect(boundary).toContain('parseAccessibleLot');
    expect(boundary).toContain('parseAuctionWorkspace');
    expect(boundary).toContain('if (dealCreated && !dealId) return null');
    expect(boundary).not.toContain('fallback');
  });

  it('keeps bid, award and Deal creation read-only in the UI', () => {
    const workspace = read('apps/web/components/transaction-ux/AuctionServerAuthorityWorkspace.tsx');
    expect(workspace).toContain('The UI is read-only');
    expect(workspace).toContain('UI работает только на чтение');
    expect(workspace).toContain('界面仅供读取');
    expect(workspace).toContain('executionBridge.dealCreated');
    expect(workspace).toContain('executionBridge.dealId');
    expect(workspace).not.toMatch(/fetch\(/);
    expect(workspace).not.toMatch(/method:\s*['"](?:POST|PATCH|PUT|DELETE)/);
    expect(workspace).not.toContain('BID-001');
    expect(workspace).not.toContain('DL-2607-014');
  });

  it('removes the synthetic auction bridge and hard-coded FGIS state', () => {
    expect(fs.existsSync(path.join(root, 'apps/web/lib/platform-v7/auctionDealBridge.ts'))).toBe(false);
    const engine = read('apps/web/lib/platform-v7/fgisAuctionEngine.ts');
    expect(engine).not.toContain('FGIS_AUCTION_STATE');
    expect(engine).not.toContain('FGIS-LOT-2607-014');
    expect(engine).not.toContain('SDIZ-2607-5512');
    expect(engine).not.toContain('Покупатель Б');
    expect(engine).toContain('export type FgisLotSnapshot');
    expect(engine).toContain('export function canOpenAuction');
  });
});
