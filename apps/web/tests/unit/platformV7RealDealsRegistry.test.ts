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

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;

describe('platform-v7 real deals registry', () => {
  const page = read('apps/web/app/platform-v7/deals/page.tsx');
  const pageStyles = read('apps/web/app/platform-v7/deals/deals.module.css');
  const registry = read('apps/web/components/platform-v7/CanonicalDealsList.tsx');
  const registryStyles = read('apps/web/components/platform-v7/CanonicalDealsList.module.css');
  const designSystemStyles = read('packages/design-system-v8/src/components.module.css');
  const governance = JSON.parse(read('design-governance-v8.json')) as { governedRoots: string[] };

  it('removes synthetic scenarios, money and internal simulation from the working registry', () => {
    expect(page).toContain('<CanonicalDealsList />');
    expect(page).not.toContain('DEAL360_SCENARIOS');
    expect(page).not.toContain('E2EDealSimulationPanel');
    expect(page).not.toContain('SmartSectionSummary');
    expect(page).not.toContain('ExcelExportButton');
    expect(page).not.toContain('15,89 млн');
    expect(page).not.toContain('DL-9106');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('appends participant-scoped server pages by signed cursor instead of reloading the first N rows', () => {
    expect(registry).toContain('const PAGE_LIMIT = 20');
    expect(registry).toContain("params.set('cursor', cursor)");
    expect(registry).toContain("void load('more', nextCursor)");
    expect(registry).toContain('appendUniqueDeals(current.items, page.items)');
    expect(registry).toContain('hasMore && Boolean(nextCursor)');
    expect(registry).toContain('Список формирует сервер с учётом участия и полномочий');
    expect(registry).toContain('Реестр не был заменён локальными данными');
    expect(registry).not.toContain('MAX_LIMIT');
    expect(registry).not.toContain('LIMIT_STEP');
    expect(registry).not.toContain('Math.min(limit +');
    expect(registry).not.toContain('Показаны первые 100 сделок');
    expect(registry).not.toContain('DL-9102');
    expect(registry).not.toContain('LOT-2401');
    expect(registry).not.toContain("new Date('2024-");
  });

  it('validates and displays server priority, deadline and exact money impact', () => {
    expect(registry).toContain('moneyImpactKopecks: string | null');
    expect(registry).toContain('deadlineAt: string | null');
    expect(registry).toContain('priorityReason: string');
    expect(registry).toContain('priorityRank: number');
    expect(registry).toContain('myAccessLevel: string');
    expect(registry).toContain("DISPUTE_CONTROL: 'Спор требует контроля'");
    expect(registry).toContain("MONEY_CONTROL: 'Деньги требуют контроля'");
    expect(registry).toContain("OVERDUE_ACTION: 'Срок нарушен'");
    expect(registry).toContain('formatMoney(deal.moneyImpactKopecks, deal.totalKopecks, deal.currency, locale, copy.amountMissing)');
    expect(registry).toContain('priorityTone(deal.priorityReason)');
    expect(registry).toContain('deal.deadlineAt ? `${copy.deadline}:');
  });

  it('keeps loaded rows visible when the next cursor page fails', () => {
    expect(registry).toContain("if (mode === 'more') setLoadMoreError(message)");
    expect(registry).toContain("current.kind === 'ready'");
    expect(registry).toContain('loadMoreError ? (');
    expect(registry).toContain('Повторить загрузку');
    expect(registry).not.toContain("setState({ kind: 'error', message, limit:");
  });

  it('exports exactly the currently loaded real rows with priority and deadline', () => {
    expect(registry).toContain('async function exportVisibleDeals(items: AccessibleDeal[], copy: RegistryCopy, locale: Locale)');
    expect(registry).toContain("workbook.creator = 'Прозрачная Цена'");
    expect(registry).toContain('for (const deal of items)');
    expect(registry).toContain("priority: 'Причина приоритета'");
    expect(registry).toContain("deadline: 'Срок'");
    expect(registry).toContain('exportMoney(deal.moneyImpactKopecks, deal.totalKopecks)');
    expect(registry).toContain('Скачать показанные сделки');
    expect(registry).toContain("filePrefix: 'прозрачная-цена-сделки'");
    expect(registry).not.toContain('fgColor');
  });

  it('ships explicit RU EN ZH copy without DOM translation', () => {
    expect(page).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(page).toContain("getLocale");
    expect(page).toContain('Реестр исполнения');
    expect(page).toContain('Execution registry');
    expect(page).toContain('执行登记');
    expect(registry).toContain("useLocale");
    expect(registry).toContain('Загружаем ваши сделки');
    expect(registry).toContain('Loading your deals');
    expect(registry).toContain('正在加载你的交易');
  });

  it('uses v8 primitives and token-only responsive styles', () => {
    for (const primitive of ['Button', 'InlineNotice', 'StatusChip', 'Surface']) expect(registry).toContain(primitive);
    expect(registry).not.toMatch(forbiddenPresentation);
    expect(registryStyles).not.toMatch(forbiddenPresentation);
    expect(pageStyles).not.toMatch(forbiddenPresentation);
    expect(registryStyles).toContain('var(--ds-color');
    expect(designSystemStyles).toContain('min-height: var(--ds-control-height)');
    expect(registryStyles).toContain('@media (max-width: 520px)');
    expect(registryStyles).toContain('@media (forced-colors: active)');
    expect(registryStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(pageStyles).toContain('@media (max-width: 520px)');
  });

  it('keeps the page and registry inside the enforced governance boundary', () => {
    for (const file of [
      'apps/web/app/platform-v7/deals/page.tsx',
      'apps/web/app/platform-v7/deals/deals.module.css',
      'apps/web/components/platform-v7/CanonicalDealsList.tsx',
      'apps/web/components/platform-v7/CanonicalDealsList.module.css',
    ]) expect(governance.governedRoots).toContain(file);
  });
});
