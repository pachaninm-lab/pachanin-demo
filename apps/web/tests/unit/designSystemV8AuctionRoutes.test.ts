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
const cockpit = read('apps/web/components/transaction-ux/AuctionExecutionCockpit.tsx');
const cockpitCss = read('apps/web/components/transaction-ux/AuctionExecutionCockpit.module.css');
const copy = read('apps/web/components/transaction-ux/auctionExecutionCopy.ts');
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };

const routeSources = [overview, importPage, admission, bids, basis];

describe('Design System v8 canonical auction execution', () => {
  it('uses one governed auction cockpit on all canonical stages', () => {
    expect(cockpit).toContain("data-auction-execution-cockpit='v8'");
    for (const source of routeSources) {
      expect(source).toContain('AuctionExecutionCockpit');
      expect(source).not.toMatch(forbiddenPresentation);
    }
    expect(cockpitCss).not.toMatch(forbiddenPresentation);
  });

  it('preserves engine and Deal-basis authority', () => {
    expect(overview).toContain('FGIS_AUCTION_STATE');
    expect(overview).toContain('AUCTION_DEAL_BRIDGE');
    expect(importPage).toContain('FGIS_AUCTION_STATE');
    expect(admission).toContain('canOpenAuction');
    expect(bids).toContain('AUCTION_DEAL_BRIDGE.lot.bids');
    expect(basis).toContain('guardAuctionDealBasisReady');
    expect(basis).toContain('isAuctionDealBasisReady');
    expect(basis).toContain('admissionReady && basisGuardReady');
  });

  it('fails closed when current admission is incomplete', () => {
    expect(admission).toContain("href='/platform-v7/auction/bids'");
    expect(admission).toContain("href='#checks'");
    expect(bids).toContain('descriptionBlocked');
    expect(bids).toContain("href='/platform-v7/auction/admission'");
    expect(basis).toContain("href={basis ? '/platform-v7/auction/admission' : '/platform-v7/auction/bids'}");
    expect(basis).toContain("action.href === '/platform-v7/deal-logistics' && !ready");
  });

  it('preserves immutable bid, volume and winner-to-Deal rules', () => {
    expect(copy).toContain("'journal-fixed'");
    expect(copy).toContain("'volume-lock'");
    expect(copy).toContain("'admitted-buyer-only'");
    expect(copy).toContain("'winner-to-deal'");
    expect(copy).toContain('the interface cannot cancel a recorded bid');
    expect(copy).toContain('界面不能取消已记录报价');
  });

  it('does not claim live FGIS or bank release', () => {
    expect(copy).toContain('не подтверждает live-подключение ФГИС');
    expect(copy).toContain('does not prove a live public-registry connection');
    expect(copy).toContain('不能证明政府登记系统已实时连接');
    expect(copy).toContain('Экран не подтверждает live banking и не выпускает деньги');
    expect(copy).toContain('cannot release money');
    expect(copy).toContain('不能释放资金');
  });

  it('provides RU EN ZH copy and accessible mobile modes', () => {
    expect(copy).toContain('Цена появляется только после допуска');
    expect(copy).toContain('Price appears only after admission');
    expect(copy).toContain('只有完成准入后才形成价格');
    expect(cockpitCss).toContain('min-height: var(--ds-control-height)');
    expect(cockpitCss).toContain(':focus-visible');
    expect(cockpitCss).toContain('@media (max-width: 640px)');
    expect(cockpitCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cockpitCss).toContain('@media (forced-colors: active)');
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
