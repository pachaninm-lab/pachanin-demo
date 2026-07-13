import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!repoRoot) throw new Error(`Cannot resolve repository root from ${cwd}`);

const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(repoRoot, relativePath));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;
const mutationPath = /fetch\s*\(|method\s*:\s*['"](?:POST|PATCH|PUT|DELETE)['"]|placeBid\s*\(|awardWinner\s*\(|createDeal\s*\(/i;

const routes = [
  'apps/web/app/platform-v7/auction/page.tsx',
  'apps/web/app/platform-v7/auction/import/page.tsx',
  'apps/web/app/platform-v7/auction/admission/page.tsx',
  'apps/web/app/platform-v7/auction/bids/page.tsx',
  'apps/web/app/platform-v7/auction/deal-basis/page.tsx',
];
const routeSources = routes.map(read);
const workspace = read('apps/web/components/transaction-ux/AuctionPostgresAuthorityWorkspace.tsx');
const serverBoundary = read('apps/web/lib/auction-server.ts');
const engine = read('apps/web/lib/platform-v7/fgisAuctionEngine.ts');
const adapter = read('apps/web/lib/platform-v7/fgisAuctionAdapter.ts');
const bridge = read('apps/web/lib/platform-v7/auctionDealBridge.ts');
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
const workflow = read('.github/workflows/design-system-v8.yml');

describe('Design System v8 canonical auction PostgreSQL read authority', () => {
  it('routes all five stages through one governed server-authority workspace', () => {
    for (const source of routeSources) {
      expect(source).toContain('AuctionPostgresAuthorityWorkspace');
      expect(source).toContain('lotId={firstParam(searchParams?.lotId)}');
      expect(source).not.toContain('FGIS_AUCTION_STATE');
      expect(source).not.toContain('AUCTION_DEAL_BRIDGE');
      expect(source).not.toMatch(forbiddenPresentation);
    }
    expect(workspace).toContain('OperationalDecisionCockpit');
    expect(workspace).not.toMatch(forbiddenPresentation);
  });

  it('accepts only validated tenant-scoped PostgreSQL authority envelopes', () => {
    expect(serverBoundary).toContain("serverApiUrl('/lots/my')");
    expect(serverBoundary).toContain('serverApiUrl(`/auctions/lots/${safeLotId}/workspace`)');
    expect(serverBoundary).toContain("cache: 'no-store'");
    expect(serverBoundary).toContain('serverAuthHeaders()');
    expect(serverBoundary).toContain("source !== 'POSTGRESQL'");
    expect(serverBoundary).toContain("scope !== 'AUCTION'");
    expect(serverBoundary).toContain('parseAuthorityProof');
    expect(serverBoundary).toContain('parseAccessibleLot');
    expect(serverBoundary).toContain('parseAuctionWorkspace');
    expect(serverBoundary).toContain('dealCreated !== Boolean(dealId)');
    expect(serverBoundary).toContain("return unavailable('unavailable.auction.lots', error)");
    expect(serverBoundary).toContain("return unavailable('unavailable.auction.workspace', error)");
    expect(serverBoundary).not.toContain('fallback');
  });

  it('cross-checks tenant actor and lot identity before showing workspace facts', () => {
    expect(workspace).toContain('left.tenantId === right.tenantId');
    expect(workspace).toContain('left.actorId === right.actorId');
    expect(workspace).toContain('workspaceResult.data.lotId === selectedLot.id');
    expect(workspace).toContain('const workspace = authorityConsistent');
    expect(workspace).toContain('const authorityConflict');
    expect(workspace).toContain('Authority proof лота и workspace не совпадает');
    expect(workspace).toContain('Lot and workspace authority proofs differ');
    expect(workspace).toContain('批次与工作区权威证明');
  });

  it('keeps bid award and Deal creation read-only and fail-closed', () => {
    expect(workspace).toContain('UI работает только на чтение');
    expect(workspace).toContain('The UI is read-only');
    expect(workspace).toContain('界面仅供读取');
    expect(workspace).toContain('executionBridge.dealCreated');
    expect(workspace).toContain('executionBridge.dealId');
    expect(workspace).toContain('dealCreated && workspace?.executionBridge.dealId');
    expect(workspace).not.toMatch(mutationPath);
    expect(workspace).not.toContain('BID-001');
    expect(workspace).not.toContain('DL-2607-014');
    expect(workspace).not.toContain('FGIS-LOT-2607-014');
    expect(workspace).not.toContain('SDIZ-2607-5512');
  });

  it('keeps every historical auction helper as a type-only compatibility contract', () => {
    for (const contract of [engine, adapter, bridge]) {
      expect(contract).toContain('Type-only compatibility contract');
      expect(contract).not.toMatch(/export\s+(?:const|let|var|function|class)\b/);
      expect(contract).not.toContain('FGIS_AUCTION_STATE');
      expect(contract).not.toContain('AUCTION_DEAL_BRIDGE');
      expect(contract).not.toContain('AUCTION_DEAL_BASIS');
      expect(contract).not.toContain('FGIS-LOT-2607-014');
      expect(contract).not.toContain('SDIZ-2607-5512');
    }
    expect(engine).not.toContain('canOpenAuction');
    expect(engine).not.toContain('kgToTons');
    expect(adapter).not.toContain('buildFgisAuctionImportChecks');
    expect(adapter).not.toContain('explainFgisAuctionImport');
    expect(exists('apps/web/components/transaction-ux/AuctionExecutionCockpit.tsx')).toBe(false);
    expect(exists('apps/web/components/transaction-ux/AuctionExecutionCockpit.module.css')).toBe(false);
    expect(exists('apps/web/components/transaction-ux/auctionExecutionCopy.ts')).toBe(false);
  });

  it('registers and runs all canonical routes in exact v8 governance', () => {
    expect(governance.migratedFiles).toEqual(expect.arrayContaining(routes));
    expect(workflow).toContain("'apps/web/app/platform-v7/auction/**'");
    expect(workflow).toContain("'apps/web/lib/platform-v7/fgisAuctionAdapter.ts'");
    expect(workflow).toContain('tests/unit/designSystemV8AuctionRoutes.test.ts');
  });
});
