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

const workspacePath = 'apps/web/components/transaction-ux/AuctionPostgresAuthorityWorkspace.tsx';

describe('Design System v8 auction PostgreSQL-proof authority', () => {
  it('registers every auction phase as a governed route', () => {
    const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
    for (const route of routes) expect(governance.migratedFiles).toContain(route);
  });

  it('routes every phase through one governed workspace without route-local authority', () => {
    for (const route of routes) {
      const source = read(route);
      expect(source).toContain('AuctionPostgresAuthorityWorkspace');
      expect(source).toContain('lotId');
      expect(source).not.toMatch(/style=\{\{/);
      expect(source).not.toContain('dangerouslySetInnerHTML');
      expect(source).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(source).not.toContain('FGIS_AUCTION_STATE');
      expect(source).not.toContain('AUCTION_DEAL_BRIDGE');
      expect(source).not.toContain('winner =');
    }
    expect(fs.existsSync(path.join(root, 'apps/web/components/transaction-ux/AuctionServerAuthorityWorkspace.tsx'))).toBe(false);
  });

  it('requires organization-scoped reads and an explicit PostgreSQL authority envelope', () => {
    const boundary = read('apps/web/lib/auction-server.ts');
    expect(boundary).toContain("source: 'POSTGRESQL'");
    expect(boundary).toContain("scope: 'AUCTION'");
    expect(boundary).toContain('tenantId');
    expect(boundary).toContain('actorId');
    expect(boundary).toContain('observedAt');
    expect(boundary).toContain('version');
    expect(boundary).toContain("serverApiUrl('/lots/my')");
    expect(boundary).toContain('/auctions/lots/${safeLotId}/workspace');
    expect(boundary).toContain("cache: 'no-store'");
    expect(boundary).toContain('serverAuthHeaders()');
    expect(boundary).toContain('parseAuthorityProof');
    expect(boundary).toContain('auction lots missing PostgreSQL authority proof');
    expect(boundary).toContain('auction workspace missing PostgreSQL authority proof');
    expect(boundary).not.toContain('fallback');
  });

  it('rejects contradictory auction envelopes and Deal bridges', () => {
    const boundary = read('apps/web/lib/auction-server.ts');
    expect(boundary).toContain('(readyForLive && blockers.length > 0)');
    expect(boundary).toContain('dealCreated !== Boolean(dealId)');
    expect(boundary).toContain('(bidCount === 0) !== (bestBid === null)');
    expect(boundary).toContain('bestBid.amount !== readinessBestBid');

    const workspace = read(workspacePath);
    expect(workspace).toContain('sameAuthority(lotsResult.authority, workspaceResult.authority)');
    expect(workspace).toContain('workspaceResult.data.lotId === selectedLot.id');
    expect(workspace).toContain('authorityConflict');
  });

  it('keeps bid, award and Deal creation read-only in the UI', () => {
    const workspace = read(workspacePath);
    expect(workspace).toContain('UI работает только на чтение');
    expect(workspace).toContain('The UI is read-only');
    expect(workspace).toContain('界面仅供读取');
    expect(workspace).toContain('executionBridge.dealCreated');
    expect(workspace).toContain('executionBridge.dealId');
    expect(workspace).not.toMatch(/fetch\(/);
    expect(workspace).not.toMatch(/method:\s*['"](?:POST|PATCH|PUT|DELETE)/);
    expect(workspace).not.toContain('BID-001');
    expect(workspace).not.toContain('DL-2607-014');
  });

  it('keeps the legacy bridge as types only and removes hard-coded FGIS state', () => {
    const bridge = read('apps/web/lib/platform-v7/auctionDealBridge.ts');
    expect(bridge).toContain('Type-only compatibility contract');
    expect(bridge).toContain('export type AuctionStage');
    expect(bridge).toContain('export type AuctionDealBasisGuard');
    expect(bridge).not.toContain('FGIS_AUCTION_STATE');
    expect(bridge).not.toContain('AUCTION_DEAL_BRIDGE');
    expect(bridge).not.toContain('AUCTION_DEAL_BASIS');
    expect(bridge).not.toMatch(/export\s+(?:const|function|class)\s+/);

    const engine = read('apps/web/lib/platform-v7/fgisAuctionEngine.ts');
    expect(engine).not.toContain('FGIS_AUCTION_STATE');
    expect(engine).not.toContain('FGIS-LOT-2607-014');
    expect(engine).not.toContain('SDIZ-2607-5512');
    expect(engine).not.toContain('Покупатель Б');
    expect(engine).toContain('export type FgisLotSnapshot');
    expect(engine).toContain('export function canOpenAuction');
  });
});
