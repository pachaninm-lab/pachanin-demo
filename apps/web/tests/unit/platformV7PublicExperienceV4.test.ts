import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = readFileSync('components/platform-v7/PlatformV7StrategicHome.tsx', 'utf8');
const explorerPage = readFileSync('app/platform-v7/how-it-works/page.tsx', 'utf8');
const entryGate = readFileSync('components/platform-v7/PublicDealEntryGate.tsx', 'utf8');
const adapter = readFileSync('components/platform-v7/PublicDealExplorerV4.tsx', 'utf8');
const explorer = readFileSync('components/platform-v7/PublicDealExplorer.tsx', 'utf8');
const support = readFileSync('components/platform-v7/ChatSupportWidget.tsx', 'utf8');
const header = readFileSync('components/platform-v7/PublicSiteHeader.tsx', 'utf8');
const css = readFileSync('styles/platform-v7-public-product-experience-v5.css', 'utf8');
const copy = readFileSync('i18n/public-product-experience-v4.ts', 'utf8');
const detailedCopy = readFileSync('i18n/public-product-experience-v3.ts', 'utf8');
const journey = readFileSync('i18n/public-deal-journey-v5.ts', 'utf8');
const acceptanceE2e = readFileSync('tests/e2e/platform-v7-public-experience-v4.spec.ts', 'utf8');

describe('Public Product Experience V4/V5 compatibility under the canonical homepage', () => {
  it('keeps the public entry registration-first and ordinary-journey oriented', () => {
    expect(root).toContain('const registerHref = `/platform-v7/register?lang=');
    expect(root).toContain("eventName='registration_open'");
    expect(root).toContain("href='#live'");
    expect(root).toContain("href='/downloads/prozrachnaya-tsena-presentation.pdf'");
    expect(copy).toContain("secondary: 'Зарегистрироваться'");
    expect(copy).toContain("primary: 'Посмотреть, как работает Сделка'");
    expect(copy).toContain("kicker: 'Агросделка в растениеводстве'");
  });

  it('uses service navigation and a verifiable trust layer on the current routes', () => {
    expect(root).toContain('nav={nav}');
    expect(root).toContain('showMobileMenu');
    expect(root).toContain("id='trust'");
    expect(root).toContain('href={trustHref}');
    expect(root).toContain('href={contactHref}');
    expect(explorerPage).toContain('nav={nav}');
    expect(explorerPage).toContain('showMobileMenu');
    expect(explorerPage).toContain("href={localizedHref('/platform-v7/trust')}");
    expect(explorerPage).not.toContain("href={localizedHref('/platform-v7/status')}");
    expect(header).toContain('PUBLIC_SITE_HEADER_STYLES');
    expect(header).toContain('pc-site-mobile-nav');
  });

  it('preserves the active locale through linked public pages and registration', () => {
    expect(explorerPage).toContain('const localizedHref = (path: string) => `${path}?lang=${encodeURIComponent(normalizedLocale)}`');
    expect(explorerPage).toContain("href={localizedHref('/platform-v7/about')}");
    expect(explorerPage).toContain("href={localizedHref('/platform-v7/contact')}");
    expect(explorerPage).toContain("const registerHref = localizedHref('/platform-v7/register')");
    expect(explorer).toContain('const registerHref = `/platform-v7/register?lang=${encodeURIComponent(localizedLocale)}`');
    expect(explorer).toContain('href={registerHref}');
  });

  it('keeps illustrative data explicit and removes internal maturity shorthand', () => {
    expect(copy).toContain("demoLabel: 'Вымышленный пример Сделки'");
    expect(copy).toContain('без реальных сделок, организаций или денежных операций');
    expect(copy).toContain("demoLabel: 'Fictional Deal example'");
    expect(copy).toContain("demoLabel: '虚构交易示例'");
    expect(copy.toLowerCase()).not.toContain('controlled pilot');
    expect(copy.toLowerCase()).not.toContain('pre-integration');
    expect(copy).not.toContain('OTC grain');
  });

  it('keeps the detailed explorer inside the same crop Deal model instead of reviving grain-only or twelve-role copy', () => {
    expect(detailedCopy).toContain("metaDescription: 'Публичный разбор вымышленной агросделки в растениеводстве");
    expect(detailedCopy).toContain('Обычный путь из 7 шагов здесь раскрыт в 10 операционных этапов');
    expect(detailedCopy).toContain("stage: 'Операционный этап'");
    expect(detailedCopy).toContain("operator: { label: 'Сотрудник платформы'");
    expect(detailedCopy).toContain("bank: { label: 'Банк / финансы'");
    expect(detailedCopy).toContain("elevator: { label: 'Элеватор / хранение'");
    expect(detailedCopy).toContain("id: 'Вымышленная Сделка'");
    expect(detailedCopy).not.toContain('зерновой сделки');
    expect(detailedCopy).not.toContain('grain deal');
    expect(detailedCopy).not.toContain('粮食交易');
    expect(detailedCopy).not.toContain('двенадцать перспектив');
    expect(detailedCopy).not.toContain('twelve perspectives');
    expect(detailedCopy).not.toContain('十二种角色');
    expect(detailedCopy).not.toContain('DEAL-2408');
    expect(detailedCopy).not.toContain('B-2408');
    expect(detailedCopy).not.toContain('R-318');
  });

  it('removes visitor-facing status and readiness language without changing state authority', () => {
    expect(explorerPage).toContain('HOW_IT_WORKS_PUBLIC_CSS');
    expect(explorerPage).toContain(".pc-ppe-deal-state > div[data-tone='action']");
    expect(explorerPage).toContain('.pc-ppe-v5-stage-main > p');
    expect(explorerPage).toContain('.pc-ppe-document-card summary small');
    expect(adapter).toContain('statusLabel: presentation.contextLabel');
    expect(adapter).toContain('status: presentation.context');
    expect(copy).toContain("nextStage: 'Далее: документы и основания расчёта'");
    expect(copy).toContain("nextStage: 'Next: documents and settlement grounds'");
    expect(copy).toContain("nextStage: '下一步：文件与结算依据'");
    expect(copy).not.toContain('готовность расчёта');
    expect(copy).not.toContain('settlement readiness');
    expect(copy).not.toContain('结算准备');
    expect(copy).not.toContain('Only verifiable statuses');
    expect(copy).not.toContain('只展示可核验状态');
    expect(copy).not.toContain("href: '/platform-v7/status'");

    expect(detailedCopy).toContain("statusLabel: 'Контекст этапа'");
    expect(detailedCopy).toContain("statusLabel: 'Stage context'");
    expect(detailedCopy).toContain("statusLabel: '阶段上下文'");
    expect(detailedCopy).toContain("status: 'Факты · основания · следующий шаг'");
    expect(detailedCopy).toContain("status: 'Facts · grounds · next action'");
    expect(detailedCopy).toContain("status: '事实 · 依据 · 下一步'");
    expect(detailedCopy).not.toContain("statusLabel: 'Статус'");
    expect(detailedCopy).not.toContain("statusLabel: 'Status'");
    expect(detailedCopy).not.toContain("statusLabel: '状态'");
    expect(detailedCopy).not.toContain('готовность расчёта');
    expect(detailedCopy).not.toContain('settlement readiness');
    expect(detailedCopy).not.toContain('结算准备');
    expect(detailedCopy).not.toContain("status: 'Не готово'");
    expect(detailedCopy).not.toContain("status: 'Not ready'");
    expect(detailedCopy).not.toContain("status: '未就绪'");
    expect(detailedCopy).toContain("status: 'Основание расчёта'");
    expect(detailedCopy).toContain("status: 'Settlement ground'");
    expect(detailedCopy).toContain("status: '结算依据'");

    expect(adapter).toContain('writeTourStateToSearchParams');
    expect(explorer).toContain('reduceTourState');
  });

  it('keeps nine public participant choices while preserving internal URL compatibility', () => {
    expect(explorer).toContain("const PUBLIC_PERSPECTIVES: readonly TourPerspective[] = ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator']");
    expect(adapter).toContain("const PUBLIC_PERSPECTIVES: readonly TourPerspective[] = ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator']");
    expect(adapter).toContain("const STAFF_PERSPECTIVES = new Set<TourPerspective>(['operator', 'compliance', 'arbitrator', 'executive'])");
    expect(adapter).toContain('publicPerspectiveKey');
    expect(entryGate).toContain('не влияет на права доступа');
    expect(explorer).not.toContain('TOUR_PERSPECTIVES.map');
  });

  it('preserves URL/history authority and analytics in the detailed explorer', () => {
    expect(adapter).toContain('writeTourStateToSearchParams');
    expect(adapter).toContain("window.history[historyMode === 'push' ? 'pushState' : 'replaceState']");
    expect(adapter).toContain("window.addEventListener('popstate'");
    expect(adapter).toContain("return 'deal_preview_opened'");
    expect(adapter).toContain("return 'organization_connect_started'");
    expect(adapter).toContain("name: 'stage_selected'");
  });

  it('keeps the banking and external-system boundary explicit without connection-state marketing', () => {
    expect(journey).toContain('не выполняет банковские операции');
    expect(journey).toContain('не имитирует ответы внешних систем');
    expect(journey).toContain('no real banking operation is performed in the public example');
    expect(journey).toContain('公开页面不执行真实银行操作');
    expect(copy).toContain('Интерфейс не приписывает внешней системе действие без соответствующего источника');
    expect(copy).toContain('The interface does not attribute an action to an external system without a corresponding source');
    expect(copy).not.toContain('Неподтверждённая внешняя интеграция не показывается как работающая');
    expect(copy).not.toContain('unconfirmed external integration');
    expect(adapter).not.toContain('fetch(');
  });

  it('implements support as an accessible modal bottom sheet', () => {
    expect(support).toContain("role='dialog'");
    expect(support).toContain("aria-modal='true'");
    expect(support).toContain("event.key === 'Escape'");
    expect(support).toContain("event.key !== 'Tab'");
    expect(support).toContain("body.style.position = 'fixed'");
    expect(support).toContain('triggerRef.current?.focus()');
    expect(support).toContain("className='p7-support-chat-backdrop'");
    expect(css).toContain('right: max(14px');
    expect(css).not.toContain('right: -5px');
  });

  it('enforces mobile reflow, reduced motion and forced-colour resilience', () => {
    expect(css).toContain('@media (max-width: 380px)');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) !important');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('max-height: calc(100dvh');
  });

  it('pins the declared responsive acceptance widths in browser coverage', () => {
    expect(acceptanceE2e).toContain('for (const width of [320, 375, 390, 430, 768, 1280, 1440])');
    expect(acceptanceE2e).toContain('expect(metrics.overflow).toBeLessThanOrEqual(1)');
    expect(acceptanceE2e).toContain('expect(metrics.primaryHeight).toBeGreaterThanOrEqual(44)');
  });
});
