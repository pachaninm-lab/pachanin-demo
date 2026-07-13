import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const auctionPages = [
  'apps/web/app/platform-v7/fgis-access/page.tsx',
  'apps/web/app/platform-v7/auction/page.tsx',
  'apps/web/app/platform-v7/auction/import/page.tsx',
  'apps/web/app/platform-v7/auction/admission/page.tsx',
  'apps/web/app/platform-v7/auction/bids/page.tsx',
  'apps/web/app/platform-v7/auction/deal-basis/page.tsx',
];

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;

describe('Design System v8 auction authority routes', () => {
  const pages = auctionPages.map(read);
  const template = read('apps/web/components/transaction-ux/AuctionAuthorityRoute.tsx');
  const copy = read('apps/web/lib/platform-v7/auctionAuthorityCopy.ts');
  const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
  const workflow = read('.github/workflows/design-system-v8.yml');

  it('removes local lot, buyer, bid, winner and Deal authority', () => {
    const joined = pages.join('\n');
    for (const token of [
      'FGIS_AUCTION_STATE', 'FARMER_FGIS_ACCESS_STATE', 'AUCTION_DEAL_BRIDGE', 'AUCTION_DEAL_BASIS',
      'FGIS-LOT-2607-014', 'SDIZ-2607-5512', 'BID-001', 'DL-2607-014', 'isWinner: true',
      'Покупатель А', 'Покупатель Б', 'ООО «АгроПоставка»',
    ]) expect(joined).not.toContain(token);
  });

  it('uses one governed template and full RU EN ZH copy', () => {
    for (const page of pages) {
      expect(page).toContain('AuctionAuthorityRoute');
      expect(page).toContain('getLocale');
      expect(page).not.toMatch(forbiddenPresentation);
    }
    expect(template).toContain('@pc/design-system-v8');
    expect(template).toContain('OperationalDecisionCockpit');
    expect(copy).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(copy).toContain('The auction is part of Deal execution');
    expect(copy).toContain('竞价属于交易执行流程');
  });

  it('keeps admission and bid rules fail-closed on the server', () => {
    expect(copy).toContain('URL, cookie и localStorage не являются authority');
    expect(copy).toContain('Endpoint ставок обязан повторно проверить admission');
    expect(copy).toContain('append-only event');
    expect(copy).toContain('optimistic concurrency');
    expect(copy).toContain('stale version отклоняется');
    expect(copy).toContain('Победитель фиксируется атомарно');
  });

  it('transitions the locked winner into exactly one canonical Deal', () => {
    expect(copy).toContain('winner lock → canonical Deal');
    expect(copy).toContain('Каноническая Сделка создаётся идемпотентно одной транзакцией');
    expect(copy).toContain('повтор не создаёт вторую Сделку');
    expect(copy).toContain('audit/outbox evidence');
    expect(copy).toContain('/deals/{dealId}/execution');
    expect(copy).toContain('только по server-issued Deal ID');
  });

  it('does not open logistics or money before the server Deal receipt', () => {
    expect(copy).toContain('логистика, документы и деньги не запускаются');
    expect(copy).toContain('Без receipt логистика и деньги остаются закрыты');
    expect(copy).toContain('Победитель не создаёт деньги');
    expect(copy).not.toContain("href: '/platform-v7/deal-logistics'");
  });

  it('removes obsolete fixture engines and the unused client adapter', () => {
    for (const relativePath of [
      'apps/web/lib/platform-v7/fgisAuctionEngine.ts',
      'apps/web/lib/platform-v7/fgisAuctionAdapter.ts',
      'apps/web/lib/platform-v7/auctionDealBridge.ts',
      'apps/web/lib/platform-v7/farmerFgisAccessEngine.ts',
    ]) expect(fs.existsSync(path.join(root, relativePath))).toBe(false);
  });

  it('is enforced by governance and exact v8 CI', () => {
    for (const file of auctionPages) expect(governance.migratedFiles).toContain(file);
    expect(workflow).toContain('tests/unit/designSystemV8AuctionRoutes.test.ts');
    expect(workflow).toContain('tests/unit/platformV7FgisAccessFlow.test.ts');
    expect(workflow).toContain('tests/unit/platformV7DealExecutionChain.test.ts');
  });
});
