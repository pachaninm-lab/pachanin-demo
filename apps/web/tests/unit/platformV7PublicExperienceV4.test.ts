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
    expect(header).toContain('PUBLIC_SITE_HEADER_STYLES');
    expect(header).toContain('pc-site-mobile-nav');
  });

  it('keeps illustrative data explicit and removes internal maturity shorthand', () => {
    expect(copy).toContain("demoLabel: 'Вымышленный пример Сделки'");
    expect(copy).toContain('не содержит реальных сделок, организаций или денежных операций');
    expect(copy).toContain("demoLabel: 'Fictional Deal example'");
    expect(copy).toContain("demoLabel: '虚构交易示例'");
    expect(copy.toLowerCase()).not.toContain('controlled pilot');
    expect(copy.toLowerCase()).not.toContain('pre-integration');
    expect(copy).not.toContain('OTC grain');
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

  it('keeps the banking and external-integration boundary explicit', () => {
    expect(journey).toContain('не выполняет банковские операции');
    expect(journey).toContain('не выдаёт неподключённые внешние системы за работающие');
    expect(journey).toContain('no real banking operation is performed in the public example');
    expect(journey).toContain('公开页面不执行真实银行操作');
    expect(copy).toContain('Неподтверждённая внешняя интеграция не показывается как работающая');
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
