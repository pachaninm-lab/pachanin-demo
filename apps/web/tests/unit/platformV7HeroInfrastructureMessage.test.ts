import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 infrastructure hero message', () => {
  const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const enhancementCopy = read('i18n/platform-v7-home-enhancements.ts');
  const copy = read('i18n/platform-v7-hero-message.ts');
  const page = read('app/platform-v7/page.tsx');
  const unifiedCss = read('components/platform-v7/PlatformV7UnifiedHome.css');

  it('uses one unified platform-plus-TAI value proposition on the first screen', () => {
    expect(copy).toContain("kicker: 'Цифровая инфраструктура исполнения агросделки'");
    expect(copy).toContain("title: 'Одна Сделка.'");
    expect(copy).toContain("accent: 'TAI помогает довести её до расчёта.'");
    expect(copy).toContain('Торги, логистика, качество, документы и деньги — в одном контуре');
    expect(copy).toContain('TAI показывает блокеры и следующий шаг');
    expect(component).toContain('heroMessage.title');
    expect(component).toContain('heroMessage.accent');
    expect(component).toContain("className='pc-v6-hero-title pc-v6-hero-title-unified'");
    expect(component).toContain("className='pc-v6-control-tower pc-v6-control-tower-unified'");
    expect(component).not.toContain("className='pc-v6-hero-proofs'");
    expect(component).not.toContain("PlatformV7UnifiedHome.module.css");
  });

  it('keeps RU EN ZH hero copy explicit without locale inheritance', () => {
    expect(copy).toContain("const messages: Record<'ru' | 'en' | 'zh'");
    expect(copy).toContain("locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru");
    expect(copy).toContain("accent: 'TAI helps carry it through settlement.'");
    expect(copy).toContain("accent: 'TAI 协助推进至结算。'");
    expect(copy).not.toContain('...messages.ru');
  });

  it('embeds TAI in Deal execution and links to the dedicated product page without a standalone home section', () => {
    expect(component).toContain("const taiHref = `/platform-v7/ai-in-action");
    expect(component).toContain("id='tai'");
    expect(component).toContain("className='pc-v6-tai-strip pc-v6-tower-intelligence'");
    expect(component).toContain("className='pc-v6-tower-intelligence-link'");
    expect(component).toContain("params={{ source: 'hero_cockpit_unified' }}");
    expect(component).not.toContain("<section id='tai' className='pc-v6-section pc-v6-tai'>");
    expect(component).not.toContain('<TaiImpact locale={locale} />');
    expect(component).not.toContain('<TaiWorkflow locale={locale} />');
    expect(enhancementCopy).toContain('TAI — Transparent Agro Intelligence');
  });

  it('keeps the product cockpit before secondary explanation', () => {
    const heroStart = component.indexOf("className='pc-v6-hero pc-v6-hero-unified'");
    const cockpit = component.indexOf("className='pc-v6-control-tower pc-v6-control-tower-unified'");
    const scenario = component.indexOf("id='participants'");
    expect(heroStart).toBeGreaterThan(-1);
    expect(cockpit).toBeGreaterThan(heroStart);
    expect(scenario).toBeGreaterThan(cockpit);
  });

  it('inlines critical shell rules and consolidates the responsive unified-home authority', () => {
    expect(page).toContain('CRITICAL_HOME_CSS');
    expect(page).toContain('--entry-public-header-offset');
    expect(page).toContain("html[data-p7-language='zh']");
    expect(page).toContain("import '@/styles/platform-v7-strategic-home-v3.css';");
    expect(unifiedCss).toContain('.pc-v6-hero-title-accent');
    expect(unifiedCss).toContain('.pc-v6-tower-intelligence');
    expect(unifiedCss).toContain('.pc-v6-tower-intelligence-link');
    expect(unifiedCss).toContain('.pc-v6-trust-after-lifecycle');
    expect(unifiedCss).toContain('@media (max-width: 767px)');
    expect(unifiedCss).toContain('@media (max-width: 359px)');
    expect(unifiedCss).toContain('width: 44px');
    expect(unifiedCss).toContain('height: 44px');
  });
});
