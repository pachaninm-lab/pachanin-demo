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
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };

describe('Design System v8 canonical auction execution', () => {
  it('routes all canonical stages through one governed PostgreSQL authority workspace', () => {
    for (const source of routeSources) {
      expect(source).toContain('AuctionPostgresAuthorityWorkspace');
      expect(source).toContain('getAuctionAuthorityMetadata');
      expect(source).toContain('lotId');
      expect(source).not.toMatch(forbiddenPresentation);
      expect(source).not.toContain('FGIS_AUCTION_STATE');
      expect(source).not.toContain('AUCTION_DEAL_BRIDGE');
      expect(source).not.toContain('AUCTION_DEAL_BASIS');
    }
    expect(workspace).not.toMatch(forbiddenPresentation);
  });

  it('requires explicit PostgreSQL auction authority proof instead of trusting any 200 response', () => {
    expect(serverBoundary).toContain("source: 'POSTGRESQL'");
    expect(serverBoundary).toContain("scope: 'AUCTION'");
    expect(serverBoundary).toContain('parseAuthorityProof');
    expect(serverBoundary).toContain('auction lots missing PostgreSQL authority proof');
    expect(serverBoundary).toContain('auction workspace missing PostgreSQL authority proof');
    expect(serverBoundary).toContain('envelope.authority');
    expect(serverBoundary).toContain('envelope.items');
    expect(serverBoundary).toContain('envelope.workspace');
    expect(serverBoundary).not.toContain('fallback');
  });

  it('fails closed on tenant, actor, lot and Deal bridge inconsistencies', () => {
    expect(workspace).toContain('sameAuthority');
    expect(workspace).toContain('left.tenantId === right.tenantId');
    expect(workspace).toContain('left.actorId === right.actorId');
    expect(workspace).toContain('workspaceResult.data.lotId === selectedLot.id');
    expect(serverBoundary).toContain('dealCreated !== Boolean(dealId)');
    expect(serverBoundary).toContain('(bidCount === 0) !== (bestBid === null)');
    expect(serverBoundary).toContain('readyForLive && blockers.length > 0');
  });

  it('keeps bid, award and Deal creation read-only in the UI', () => {
    expect(workspace).toContain('The UI is read-only');
    expect(workspace).toContain('UI работает только на чтение');
    expect(workspace).toContain('界面仅供读取');
    expect(workspace).toContain('executionBridge.dealCreated');
    expect(workspace).toContain('executionBridge.dealId');
    expect(workspace).not.toMatch(/fetch\s*\(/);
    expect(workspace).not.toMatch(/method\s*:\s*['"](?:POST|PATCH|PUT|DELETE)/);
    for (const value of ['BID-001', 'DL-2607-014', 'FGIS-LOT-2607-014', 'SDIZ-2607-5512']) {
      expect(workspace).not.toContain(value);
    }
  });

  it('removes obsolete local auction authority files', () => {
    for (const file of [
      'apps/web/lib/platform-v7/auctionDealBridge.ts',
      'apps/web/lib/platform-v7/fgisAuctionEngine.ts',
      'apps/web/components/transaction-ux/auctionExecutionCopy.ts',
      'apps/web/components/transaction-ux/AuctionExecutionCockpit.tsx',
      'apps/web/components/transaction-ux/AuctionExecutionCockpit.module.css',
      'apps/web/components/transaction-ux/AuctionServerAuthorityWorkspace.tsx',
    ]) expect(exists(file)).toBe(false);
  });

  it('provides RU EN ZH copy and registers all auction routes', () => {
    expect(workspace).toContain('Аукцион начинается только с подтверждённого сервером лота');
    expect(workspace).toContain('An auction starts only from a server-confirmed lot');
    expect(workspace).toContain('竞价只能从服务器确认的批次开始');
    expect(governance.migratedFiles).toEqual(expect.arrayContaining(routes));
  });
});
