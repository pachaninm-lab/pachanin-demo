import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 infrastructure hero message', () => {
  const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const enhancements = read('components/platform-v7/PlatformV7HomeEnhancements.tsx');
  const enhancementCopy = read('i18n/platform-v7-home-enhancements.ts');
  const copy = read('i18n/platform-v7-hero-message.ts');
  const page = read('app/platform-v7/page.tsx');

  it('uses the approved product-led RU message as the first-screen hierarchy', () => {
    expect(copy).toContain("kicker: 'Единая цифровая инфраструктура исполнения агросделки'");
    expect(copy).toContain("brand: 'Прозрачная Цена'");
    expect(copy).toContain("title: 'связывает товар, исполнение и деньги в одной Сделке'");
    expect(copy).toContain('От условий и аукциона до логистики, качества, документов, расчёта, спора и доказательств.');
    expect(copy).toContain('На каждом этапе видны статус, блокер, ответственный, основание и следующий шаг.');
    expect(component).toContain("className='pc-v6-hero-brand'");
    expect(component).toContain("className='pc-v6-hero-title-line'");
    expect(component).toContain("className='pc-v6-hero-lead'");
    expect(component).toContain("className='pc-v6-control-tower'");
  });

  it('keeps RU EN ZH hero copy explicit without locale inheritance', () => {
    expect(copy).toContain("const messages: Record<'ru' | 'en' | 'zh'");
    expect(copy).toContain("locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru");
    expect(copy).toContain("brand: 'Transparent Price'");
    expect(copy).toContain("brand: '透明价格'");
    expect(copy).not.toContain('...messages.ru');
  });

  it('defines TAI as operational intelligence inside the product rather than a detached AI landing', () => {
    expect(component).toContain('copy.tower.taiTitle');
    expect(component).toContain("eventName='open_tai'");
    expect(component).toContain('<HeroTaiEntry locale={locale} taiHref={taiHref} />');
    expect(component).toContain('<TaiDefinition locale={locale} />');
    expect(component).toContain('<TaiWorkflow locale={locale} />');
    expect(enhancements).toContain("eventName='hero_tai_explainer_open'");
    expect(enhancementCopy).toContain('TAI — Transparent Agro Intelligence');
    expect(enhancementCopy).toContain('Операционный интеллект «Прозрачной Цены»');
    expect(enhancementCopy).toContain('не отдельный чат и не декоративный помощник');
  });

  it('inlines the critical shell, hero and CJK rules and loads one route stylesheet', () => {
    expect(page).toContain('CRITICAL_HOME_CSS');
    expect(page).toContain('--entry-public-header-offset');
    expect(page).toContain("html[data-p7-language='zh']");
    expect(page).toContain("import '@/styles/platform-v7-strategic-home-v3.css';");
    expect(page).not.toContain('platform-v7-public-header.css');
    expect(page).not.toContain('platform-v7-public-mobile-safe-area.css');
    expect(page).not.toContain('platform-v7-public-typography.css');
    expect(page).not.toContain('platform-v7-i18n-cjk.css');
    expect(page).not.toContain('platform-v7-hero-infrastructure-message.css');
  });

  it('defines deliberate typography for phone, tablet and desktop widths', () => {
    expect(page).toContain('@media (max-width: 374px)');
    expect(page).toContain('@media (min-width: 375px) and (max-width: 767px)');
    expect(page).toContain('@media (min-width: 768px) and (max-width: 1023px)');
    expect(page).toContain('@media (min-width: 1024px)');
    expect(page).toContain('@media (min-width: 1280px)');
    expect(page).toContain('text-wrap: balance');
    expect(page).toContain('.pc-v6-hero-brand::after');
    expect(page).toContain('.pc-v6-hero-title-line { display: inline; }');
    expect(page).toContain(':lang(zh) .pc-v6-hero h1.pc-v6-hero-title');
    expect(page).toContain('min-height: min(760px, calc(100dvh - 64px))');
    expect(page).toContain('content-visibility: auto');
  });
});
