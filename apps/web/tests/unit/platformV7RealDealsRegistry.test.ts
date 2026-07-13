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

  it('loads only participant-scoped server data with bounded growth', () => {
    expect(registry).toContain("const INITIAL_LIMIT = 20");
    expect(registry).toContain("const MAX_LIMIT = 100");
    expect(registry).toContain('/api/proxy/deals/accessible?limit=${boundedLimit}');
    expect(registry).toContain('Math.min(limit + LIMIT_STEP, MAX_LIMIT)');
    expect(registry).toContain('Список формирует сервер с учётом участия и полномочий');
    expect(registry).toContain('Реестр не был заменён локальными данными');
    expect(registry).not.toContain('DL-9102');
    expect(registry).not.toContain('LOT-2401');
    expect(registry).not.toContain("new Date('2024-");
  });

  it('exports exactly the currently loaded real rows instead of fixture data', () => {
    expect(registry).toContain('async function exportVisibleDeals(items: AccessibleDeal[])');
    expect(registry).toContain("workbook.creator = 'Прозрачная Цена'");
    expect(registry).toContain('for (const deal of items)');
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
