import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!repoRoot) throw new Error(`Cannot resolve repository root from ${cwd}`);

const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;

const overview = read('apps/web/app/platform-v7/auction/page.tsx');
const importPage = read('apps/web/app/platform-v7/auction/import/page.tsx');
const admission = read('apps/web/app/platform-v7/auction/admission/page.tsx');
const bids = read('apps/web/app/platform-v7/auction/bids/page.tsx');
const basis = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');
const serverWorkspace = read('apps/web/components/transaction-ux/AuctionServerAuthorityWorkspace.tsx');
const visualCockpit = read('apps/web/components/transaction-ux/AuctionExecutionCockpit.tsx');
const cockpitCss = read('apps/web/components/transaction-ux/AuctionExecutionCockpit.module.css');
const copy = read('apps/web/components/transaction-ux/auctionExecutionCopy.ts');
const serverBoundary = read('apps/web/lib/auction-server.ts');
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };

const routeSources = [overview, importPage, admission, bids, basis];

describe('Design System v8 canonical auction execution', () => {
  it('uses one governed server-authority workspace on all canonical stages', () => {
    for (const source of routeSources) {
      expect(source).toContain('AuctionServerAuthorityWorkspace');
      expect(source).not.toMatch(forbiddenPresentation);
      expect(source).not.toContain('FGIS_AUCTION_STATE');
      expect(source).not.toContain('AUCTION_DEAL_BRIDGE');
    }
    expect(serverWorkspace).toContain("data-operational-decision-cockpit='v8'");
  });

  it('keeps the reusable auction visual contract accessible and token governed', () => {
    expect(visualCockpit).toContain("data-auction-execution-cockpit='v8'");
    expect(cockpitCss).not.toMatch(forbiddenPresentation);
    expect(cockpitCss).toContain('min-height: var(--ds-control-height)');
    expect(cockpitCss).toContain(':focus-visible');
    expect(cockpitCss).toContain('@media (max-width: 640px)');
    expect(cockpitCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cockpitCss).toContain('@media (forced-colors: active)');
  });

  it('preserves server-owned lot and Deal-basis authority', () => {
    expect(serverBoundary).toContain("serverApiUrl('/lots/my')");
    expect(serverBoundary).toContain('/auctions/lots/${safeLotId}/workspace');
    expect(serverBoundary).toContain('parseAuctionWorkspace');
    expect(serverBoundary).toContain('if (dealCreated && !dealId) return null');
    expect(serverWorkspace).toContain('executionBridge.dealCreated');
    expect(serverWorkspace).toContain('executionBridge.dealId');
    expect(serverWorkspace).toContain('/execution');
  });

  it('fails closed when lot access or the auction workspace is unavailable', () => {
    expect(serverWorkspace).toContain('accessDenied');
    expect(serverWorkspace).toContain('workspaceUnavailable');
    expect(serverWorkspace).toContain('Локальные демонстрационные лоты не подставлены');
    expect(serverWorkspace).toContain('No local demonstration lots were substituted');
    expect(serverWorkspace).toContain('没有替换为本地演示批次');
    expect(serverWorkspace).not.toContain('BID-001');
    expect(serverWorkspace).not.toContain('DL-2607-014');
  });

  it('keeps bid, award and winner-to-Deal rules read-only', () => {
    expect(serverWorkspace).toContain('Полный неизменяемый журнал ставок не входит');
    expect(serverWorkspace).toContain('The immutable full bid journal is not part');
    expect(serverWorkspace).toContain('当前工作区响应不包含完整且不可变的报价日志');
    expect(serverWorkspace).toContain('dealCreated=true');
    expect(serverWorkspace).not.toMatch(/method:\s*['"](?:POST|PATCH|PUT|DELETE)/);
  });

  it('does not claim live FGIS, PostgreSQL auction authority or bank release', () => {
    expect(serverWorkspace).toContain('не доказывает PostgreSQL-authoritative auction backend');
    expect(serverWorkspace).toContain('does not prove a PostgreSQL-authoritative auction backend');
    expect(serverWorkspace).toContain('不证明 PostgreSQL 权威竞价后端');
    expect(copy).toContain('не подтверждает live-подключение ФГИС');
    expect(copy).toContain('cannot release money');
    expect(copy).toContain('不能释放资金');
  });

  it('registers every canonical auction route in governance', () => {
    expect(governance.migratedFiles).toEqual(expect.arrayContaining([
      'apps/web/app/platform-v7/auction/page.tsx',
      'apps/web/app/platform-v7/auction/import/page.tsx',
      'apps/web/app/platform-v7/auction/admission/page.tsx',
      'apps/web/app/platform-v7/auction/bids/page.tsx',
      'apps/web/app/platform-v7/auction/deal-basis/page.tsx',
    ]));
  });
});
