import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 FINAL PUBLIC EXPERIENCE v1 entry', () => {
  const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const page = read('app/platform-v7/page.tsx');
  const homeCss = read('styles/platform-v7-strategic-home-v3.css');

  it('keeps crop positioning and makes seller/buyer tasks the primary conversion without an unconsumed authority hint', () => {
    expect(heroCopy).toContain("kicker: 'Платформа управления агросделками в растениеводстве'");
    expect(heroCopy).toContain("title: 'От лота и цены'");
    expect(heroCopy).toContain("accent: 'до поставки, качества и расчёта'");
    expect(component).toContain("function registerHref(locale: Locale)");
    expect(component).toContain("href={registerHref(locale)}");
    expect(component).not.toContain("query.set('intent'");
    expect(component).toContain("eventName='registration_open'");
    expect(component).toContain("source: 'home_v1_sell'");
    expect(component).toContain("source: 'home_v1_buy'");
    expect(component).not.toContain("href='/downloads/prozrachnaya-tsena-presentation.pdf'");
  });

  it('owns complete RU EN ZH semantic hero copy in source', () => {
    expect(heroCopy).toContain("const messages: Record<'ru' | 'en' | 'zh'");
    expect(heroCopy).toContain("title: 'From lot and price'");
    expect(heroCopy).toContain("title: '从批次和价格'");
    expect(component).toContain("nav: { market: 'Рынок'");
    expect(component).toContain("nav: { market: 'Market'");
    expect(component).toContain("nav: { market: '市场'");
    expect(page).not.toContain('.pc-v6-kicker::before');
    expect(page).not.toContain('font-size: 0');
  });

  it('orders the public story exactly around market, Deal, participants, execution, trust, Gekta, capabilities and conversion', () => {
    const hero = component.indexOf("className='pc-final-hero'");
    const market = component.indexOf('<PublicMarketTeaser locale={locale} />');
    const path = component.indexOf("id='how-it-works'");
    const roles = component.indexOf("id='participants'");
    const execution = component.indexOf("aria-labelledby='execution-title'");
    const trust = component.indexOf("id='trust'");
    const gekta = component.indexOf("id='gekta'");
    const capabilities = component.indexOf("aria-labelledby='capabilities-title'");
    const final = component.indexOf("aria-labelledby='final-title'");
    const connect = component.indexOf('<OrganizationConnectForm locale={locale} />');
    const ordered = [hero, market, path, roles, execution, trust, gekta, capabilities, final, connect];
    for (const index of ordered) expect(index).toBeGreaterThan(-1);
    for (let i = 1; i < ordered.length; i += 1) expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
    for (const retired of ["id='difference'", "id='faq'", "id='maturity'"]) expect(component).not.toContain(retired);
  });

  it('presents normal execution first and keeps deviation/dispute explicit', () => {
    expect(component).toContain("name='public-final-deal-state'");
    expect(component).toContain('defaultChecked={index === 0}');
    expect(component).toContain("tab: 'Норма'");
    expect(component).toContain("tab: 'Отклонение'");
    expect(component).toContain("tab: 'Спор'");
    expect(component).toContain("money: 'Основание подтверждено.'");
    expect(component).toContain("money: 'Требуется решение.'");
    expect(component).toContain('Финансовое действие остановлено до появления достаточного основания.');
  });

  it('uses a restrained crop visual instead of a dashboard hero', () => {
    expect(component).toContain("className='pc-final-hero-visual'");
    expect(component).toContain("const HERO_IMAGE_DATA = 'data:image/svg+xml;base64,");
    expect(component).toContain("src={HERO_IMAGE_DATA}");
    expect(component).toContain("visualStage: 'Приёмка и качество'");
    expect(component).toContain("visualStatus: 'Исполнение в работе'");
    expect(component).not.toContain('pc-v6-control-tower');
    expect(component).not.toContain("data-testid='platform-v7-deal-card'");
  });

  it('retains structured data, semantic landmarks, keyboard focus and responsive/reduced-motion contracts', () => {
    expect(page).toContain('CRITICAL_HOME_CSS');
    expect(page).toContain('--entry-public-header-offset');
    expect(component).toContain("type='application/ld+json'");
    expect(component).toContain("<main id='main-content' tabIndex={-1}>");
    expect(homeCss).toContain('@media(max-width:767px)');
    expect(homeCss).toContain('@media(prefers-reduced-motion:reduce)');
    expect(homeCss).toContain('@media(forced-colors:active)');
    expect(homeCss).toContain(':focus-visible');
    expect(homeCss).toContain('min-height:44px');
    expect(homeCss).not.toContain('overflow-x:clip');
  });
});
