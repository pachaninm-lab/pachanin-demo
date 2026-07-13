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
const postgresWorkspace = read('apps/web/components/transaction-ux/AuctionPostgresAuthorityWorkspace.tsx');
const operationalCockpit = read('apps/web/components/transaction-ux/OperationalDecisionCockpit.tsx');
const visualCockpit = read('apps/web/components/transaction-ux/AuctionExecutionCockpit.tsx');
const cockpitCss = read('apps/web/components/transaction-ux/AuctionExecutionCockpit.module.css');
const copy = read('apps/web/components/transaction-ux/auctionExecutionCopy.ts');
const serverBoundary = read('apps/web/lib/auction-server.ts');
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };

const routeSources = [overview, importPage, admission, bids, basis];

describe('Design System v8 canonical auction execution', () => {
  it('uses one governed PostgreSQL-proof workspace on all canonical stages', () => {
    for (const source of routeSources) {
      expect(source).toContain('AuctionPostgresAuthorityWorkspace');
      expect(source).toContain('getAuctionAuthorityMetadata');
      expect(source).not.toMatch(forbiddenPresentation);
      expect(source).not.toContain('FGIS_AUCTION_STATE');
      expect(source).not.toContain('AUCTION_DEAL_BRIDGE');
    }
    expect(postgresWorkspace).toContain('OperationalDecisionCockpit');
    expect(operationalCockpit).toContain("data-operational-decision-cockpit='v8'");
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

  it('preserves tenant and actor authority across lot and workspace reads', () => {
    expect(serverBoundary).toContain("source: 'POSTGRESQL'");
    expect(serverBoundary).toContain("scope: 'AUCTION'");
    expect(serverBoundary).toContain("serverApiUrl('/lots/my')");
    expect(serverBoundary).toContain('/auctions/lots/${safeLotId}/workspace');
    expect(postgresWorkspace).toContain('sameAuthority(lotsResult.authority, workspaceResult.authority)');
    expect(postgresWorkspace).toContain('workspaceResult.data.lotId === selectedLot.id');
    expect(postgresWorkspace).toContain('authorityConflict');
  });

  it('fails closed when lot access, proof or the workspace is unavailable', () => {
    expect(postgresWorkspace).toContain('accessDenied');
    expect(postgresWorkspace).toContain('authorityConsistent');
    expect(postgresWorkspace).toContain('Ответ без PostgreSQL authority proof отклонён');
    expect(postgresWorkspace).toContain('A response without PostgreSQL authority proof was rejected');
    expect(postgresWorkspace).toContain('缺少 PostgreSQL 权威证明的响应已被拒绝');
    expect(postgresWorkspace).not.toContain('BID-001');
    expect(postgresWorkspace).not.toContain('DL-2607-014');
  });

  it('keeps bid, award and winner-to-Deal rules read-only', () => {
    expect(postgresWorkspace).toContain('Полный неизменяемый журнал ставок не входит');
    expect(postgresWorkspace).toContain('The full immutable bid journal is not part');
    expect(postgresWorkspace).toContain('当前读取信封不含完整且不可变的报价日志');
    expect(postgresWorkspace).toContain('dealCreated=true');
    expect(postgresWorkspace).not.toMatch(/method:\s*['"](?:POST|PATCH|PUT|DELETE)/);
  });

  it('does not claim live FGIS or executable bank release', () => {
    expect(postgresWorkspace).toContain('Текущий workspace не содержит подтверждённых реквизитов ФГИС/СДИЗ');
    expect(postgresWorkspace).toContain('does not include confirmed registry/certificate identifiers');
    expect(postgresWorkspace).toContain('不包含已确认的登记/凭证标识');
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
