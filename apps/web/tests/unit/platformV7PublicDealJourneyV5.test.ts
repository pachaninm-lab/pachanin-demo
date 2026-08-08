import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const component = read('apps/web/components/platform-v7/PublicDealExplorerV4.tsx');
const copy = read('apps/web/i18n/public-deal-journey-v5.ts');
const page = read('apps/web/app/platform-v7/how-it-works/page.tsx');
const css = read('apps/web/styles/platform-v7-public-deal-journey-v5.css');

describe('Public Deal Journey v5', () => {
  it('keeps the Deal as the primary public object and preserves the detailed industrial layer', () => {
    expect(component).toContain("data-testid='public-deal-journey-context'");
    expect(component).toContain("data-testid='public-deal-quick-stage'");
    expect(component).toContain("data-testid='public-deal-detailed-mode'");
    expect(component).toContain('<PublicDealExplorer key={historyRevision}');
    expect(component).toContain("const publicBusinessAreas = new Set<TourLens>(['execution', 'documents', 'money', 'risk'])");
  });

  it('preserves URL authority and analytics rather than introducing client-only hidden state', () => {
    expect(component).toContain('writeTourStateToSearchParams');
    expect(component).toContain("window.history[historyMode === 'push' ? 'pushState' : 'replaceState']");
    expect(component).toContain("window.addEventListener('popstate'");
    expect(component).toContain("return 'deal_preview_opened'");
    expect(component).toContain("return 'organization_connect_started'");
  });

  it('marks the public banking and external-integration boundary explicitly', () => {
    expect(copy).toContain('не выполняются реальные банковские операции');
    expect(copy).toContain('не подтверждаются неподключённые внешние интеграции');
    expect(copy).toContain('реальная банковская операция в публичном режиме не выполняется');
    expect(copy).toContain('no real banking operation is performed in public mode');
    expect(copy).toContain('公开模式不执行真实银行操作');
    expect(component).not.toContain('fetch(');
  });

  it('has complete RU EN ZH entry, intent, scenario and TAI copy', () => {
    expect(copy).toContain('ru: {');
    expect(copy).toContain('en: {');
    expect(copy).toContain('zh: {');
    expect(copy.match(/taiPrompts:/g)?.length).toBe(3);
    expect(copy.match(/moneyByStage:/g)?.length).toBe(3);
    expect(copy.match(/documentsByStage:/g)?.length).toBe(3);
    expect(copy.match(/control: \{ label:/g)?.length).toBe(3);
  });

  it('uses the new public journey copy on the actual how-it-works route', () => {
    expect(page).toContain("import '@/styles/platform-v7-public-deal-journey-v5.css'");
    expect(page).toContain('getPublicDealJourneyV5Copy');
    expect(page).toContain('journeyUi.intro.title');
    expect(page).toContain('journeyUi.intro.demoNotice');
  });

  it('is mobile-first, accessible and progressive rather than dashboard-dense', () => {
    expect(css).toContain('.pc-ppe-v5-intent-grid');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('@media (min-width: 680px)');
    expect(css).toContain('@media (max-width: 360px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(component).toContain("aria-current={stageKey === historyState.stage ? 'step' : undefined}");
  });
});
