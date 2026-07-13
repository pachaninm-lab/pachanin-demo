import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 real deals registry', () => {
  const page = read('apps/web/app/platform-v7/deals/page.tsx');
  const pageStyles = read('apps/web/app/platform-v7/deals/deals.module.css');
  const registry = read('apps/web/components/platform-v7/CanonicalDealsList.tsx');
  const registryStyles = read('apps/web/components/platform-v7/CanonicalDealsList.module.css');

  it('removes synthetic scenarios, money and internal simulation from the working registry', () => {
    expect(page).toContain('<CanonicalDealsList />');
    expect(page).not.toContain('DEAL360_SCENARIOS');
    expect(page).not.toContain('E2EDealSimulationPanel');
    expect(page).not.toContain('SmartSectionSummary');
    expect(page).not.toContain('ExcelExportButton');
    expect(page).not.toContain('15,89 млн');
    expect(page).not.toContain('DL-9106');
    expect(page).not.toContain('style={{');
    expect(page).not.toContain('dangerouslySetInnerHTML');
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
    expect(registry).toContain('formatMoney(deal.moneyImpactKopecks, deal.totalKopecks, deal.currency)');
    expect(registry).toContain('deal.deadlineAt ? `Срок:');
    expect(registryStyles).toContain(".priorityBadge[data-priority='DISPUTE_CONTROL']");
    expect(registryStyles).toContain(".priorityBadge[data-priority='MONEY_CONTROL']");
  });

  it('keeps loaded rows visible when the next cursor page fails', () => {
    expect(registry).toContain("if (mode === 'more') setLoadMoreError(message)");
    expect(registry).toContain("current.kind === 'ready'");
    expect(registry).toContain('loadMoreError ? (');
    expect(registry).toContain('Повторить загрузку');
    expect(registry).not.toContain("setState({ kind: 'error', message, limit:");
  });

  it('exports exactly the currently loaded real rows with priority and deadline', () => {
    expect(registry).toContain('async function exportVisibleDeals(items: AccessibleDeal[])');
    expect(registry).toContain("workbook.creator = 'Прозрачная Цена'");
    expect(registry).toContain('for (const deal of items)');
    expect(registry).toContain("header: 'Причина приоритета'");
    expect(registry).toContain("header: 'Срок'");
    expect(registry).toContain('exportMoney(deal.moneyImpactKopecks, deal.totalKopecks)');
    expect(registry).toContain('Скачать показанные сделки');
    expect(registry).toContain('прозрачная-цена-сделки-');
  });

  it('keeps the registry usable on mobile and accessible without inline style patches', () => {
    expect(registry).toContain("import styles from './CanonicalDealsList.module.css'");
    expect(registry).not.toContain('style={{');
    expect(registry).not.toContain('<style jsx>');
    expect(registryStyles).toContain('min-height: 48px');
    expect(registryStyles).toContain('@media (max-width: 520px)');
    expect(registryStyles).toContain('@media (forced-colors: active)');
    expect(registryStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(pageStyles).toContain('@media (max-width: 520px)');
  });
});
