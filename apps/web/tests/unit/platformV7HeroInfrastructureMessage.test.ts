import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 infrastructure hero message', () => {
  const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const enhancementCopy = read('i18n/platform-v7-home-enhancements.ts');
  const copy = read('i18n/platform-v7-hero-message.ts');
  const page = read('app/platform-v7/page.tsx');
  const unifiedCss = read('components/platform-v7/PlatformV7UnifiedHome.module.css');

  it('uses one unified platform-plus-TAI value proposition on the first screen', () => {
    expect(copy).toContain("kicker: 'Цифровая инфраструктура исполнения агросделки'");
    expect(copy).toContain("title: 'Вся агросделка'");
    expect(copy).toContain("accent: 'с TAI внутри'");
    expect(copy).toContain('Прозрачная Цена связывает торги, логистику, качество, документы и деньги');
    expect(copy).toContain('TAI видит блокеры, объясняет основания и готовит следующий шаг');
    expect(component).toContain('heroMessage.title');
    expect(component).toContain('heroMessage.accent');
    expect(component).toContain("className={`pc-v6-hero-title ${styles.heroTitle}`}");
    expect(component).toContain("className={`pc-v6-control-tower ${styles.tower}`}");
    expect(component).not.toContain("className='pc-v6-hero-proofs'");
  });

  it('keeps RU EN ZH hero copy explicit without locale inheritance', () => {
    expect(copy).toContain("const messages: Record<'ru' | 'en' | 'zh'");
    expect(copy).toContain("locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru");
    expect(copy).toContain("accent: 'with TAI inside'");
    expect(copy).toContain("accent: '由 TAI 贯穿'");
    expect(copy).not.toContain('...messages.ru');
  });

  it('embeds TAI in Deal execution and links to the dedicated product page without a standalone home section', () => {
    expect(component).toContain("const taiHref = `/platform-v7/ai-in-action");
    expect(component).toContain("id='tai'");
    expect(component).toContain("className={`pc-v6-tai-strip ${styles.towerIntelligence}`}");
    expect(component).toContain('TAI работает внутри всего контура Сделки');
    expect(component).toContain("params={{ source: 'deal_path_unified' }}");
    expect(component).not.toContain("<section id='tai' className='pc-v6-section pc-v6-tai'>");
    expect(component).not.toContain('<TaiImpact locale={locale} />');
    expect(component).not.toContain('<TaiWorkflow locale={locale} />');
    expect(enhancementCopy).toContain('TAI — Transparent Agro Intelligence');
  });

  it('keeps the product cockpit before secondary explanation', () => {
    const heroStart = component.indexOf("className={`pc-v6-hero ${styles.hero}`}");
    const cockpit = component.indexOf("className={`pc-v6-control-tower ${styles.tower}`}");
    const scenario = component.indexOf("id='participants'");
    expect(heroStart).toBeGreaterThan(-1);
    expect(cockpit).toBeGreaterThan(heroStart);
    expect(scenario).toBeGreaterThan(cockpit);
  });

  it('inlines critical shell rules and adds a responsive unified-home authority', () => {
    expect(page).toContain('CRITICAL_HOME_CSS');
    expect(page).toContain('--entry-public-header-offset');
    expect(page).toContain("html[data-p7-language='zh']");
    expect(page).toContain("import '@/styles/platform-v7-strategic-home-v3.css';");
    expect(unifiedCss).toContain('.heroTitleAccent');
    expect(unifiedCss).toContain('.towerIntelligence');
    expect(unifiedCss).toContain('.lifecycleIntelligence');
    expect(unifiedCss).toContain('@media (max-width: 767px)');
    expect(unifiedCss).toContain('@media (max-width: 359px)');
    expect(unifiedCss).toContain('min-height: 44px');
  });
});
