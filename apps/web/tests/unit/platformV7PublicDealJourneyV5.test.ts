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

  it('marks public banking and external-system boundaries without live or connection-status claims', () => {
    expect(copy).toContain('не выполняет банковские операции');
    expect(copy).toContain('не имитирует ответы внешних систем');
    expect(copy).toContain('реальная банковская операция в публичном примере не выполняется');
    expect(copy).toContain('does not simulate responses from external systems');
    expect(copy).toContain('公开页面不执行真实银行操作');
    expect(copy).toContain('不模拟外部系统的响应');
    expect(copy).not.toContain('не выдаёт неподключённые внешние системы за работающие');
    expect(copy).not.toContain('unconnected external system as live');
    expect(copy).not.toContain('尚未接入的外部系统显示为在线能力');
    expect(component).not.toContain('fetch(');
  });

  it('has complete RU EN ZH task, scenario and Gekta copy with one public employee control perspective', () => {
    expect(copy).toContain('ru: {');
    expect(copy).toContain('en: {');
    expect(copy).toContain('zh: {');
    expect(copy.match(/taiPrompts:/g)?.length).toBe(3);
    expect(copy.match(/moneyByStage:/g)?.length).toBe(3);
    expect(copy.match(/documentsByStage:/g)?.length).toBe(3);
    expect(copy.match(/control: \{ label:/g)?.length).toBe(3);
    expect(copy.match(/perspective: 'operator'/g)?.length).toBe(3);
    expect(copy).not.toContain("perspective: 'executive'");
  });

  it('uses grounds and next-action language instead of readiness or public status language', () => {
    expect(copy).toContain("settle: { label: 'Проверить основания расчёта'");
    expect(copy).toContain("settle: { label: 'Review settlement grounds'");
    expect(copy).toContain("settle: { label: '检查结算依据'");
    expect(copy).toContain('Гекта объясняет факты, риск и следующий шаг');
    expect(copy).toContain('Gekta explains facts, risk and the next action');
    expect(copy).toContain('Gekta 解释事实、风险和下一步');
    expect(copy).not.toContain('Проверить готовность расчёта');
    expect(copy).not.toContain('Check settlement readiness');
    expect(copy).not.toContain('检查结算准备');
    expect(copy).not.toContain('Гекта объясняет текущий статус');
    expect(copy).not.toContain('Gekta explains current status');
    expect(copy).not.toContain('Gekta 解释当前状态');
  });

  it('uses ordinary-journey-first language and registration on the actual how-it-works route', () => {
    expect(copy).toContain("kicker: 'Как работает Сделка'");
    expect(copy).toContain("connect: 'Зарегистрироваться'");
    expect(copy).toContain('Сначала платформа показывает нормальное исполнение');
    expect(page).toContain("import '@/styles/platform-v7-public-deal-journey-v5.css'");
    expect(page).toContain("heading: 'От условий до закрытия — один понятный путь'");
    expect(page).toContain('Ниже используется вымышленный пример.');
    expect(page).toContain('const registerHref = localizedHref');
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
