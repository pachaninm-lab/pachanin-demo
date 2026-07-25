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
  const finalCss = read('components/platform-v7/PlatformV7HomeFinalPolish.css');

  it('uses the final Deal-first RU message as the first-screen hierarchy', () => {
    expect(copy).toContain("kicker: 'Цифровая инфраструктура исполнения агросделки'");
    expect(copy).toContain("brand: 'Одна Сделка'");
    expect(copy).toContain("title: 'связывает товар, исполнение и деньги'");
    expect(copy).toContain('Торги, логистика, качество, документы и расчёт');
    expect(copy).toContain('видимым статусом, основанием и следующим шагом');
    expect(component).toContain("className='pc-v6-hero-brand'");
    expect(component).toContain("className='pc-v6-hero-title-line'");
    expect(component).toContain("className='pc-v6-hero-lead'");
    expect(component).toContain("className='pc-v6-control-tower'");
    expect(component.indexOf("className='pc-v6-control-tower'")).toBeLessThan(component.indexOf("className='pc-v6-hero-proofs'"));
  });

  it('keeps RU EN ZH hero copy explicit without locale inheritance', () => {
    expect(copy).toContain("const messages: Record<'ru' | 'en' | 'zh'");
    expect(copy).toContain("locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru");
    expect(copy).toContain("brand: 'One Deal'");
    expect(copy).toContain("brand: '一笔交易'");
    expect(copy).not.toContain('...messages.ru');
  });

  it('defines TAI as a distinct product embedded in the Deal instead of a detached chat landing', () => {
    expect(component).toContain('copy.tower.taiTitle');
    expect(component).toContain("eventName='open_tai'");
    expect(component).toContain('Отдельный AI-продукт для агробизнеса');
    expect(component).toContain('Собственный операционный интеллект для агробизнеса');
    expect(component).toContain('<TaiImpact locale={locale} />');
    expect(component).toContain('<TaiWorkflow locale={locale} />');
    expect(component).toContain('остаётся под контролем человека');
    expect(enhancementCopy).toContain('TAI — Transparent Agro Intelligence');
    expect(enhancementCopy).toContain('не отдельный чат и не декоративный помощник');
    expect(enhancements).not.toContain('PlatformV7HomeHeroAcceptance.css');
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

  it('defines deliberate first-paint typography for phone and desktop widths', () => {
    expect(page).toContain('@media (max-width: 767px)');
    expect(page).toContain('@media (max-width: 359px)');
    expect(page).toContain('@media (min-width: 768px)');
    expect(page).toContain('text-wrap: balance');
    expect(page).toContain('.pc-v6-hero-brand::after { display: none; }');
    expect(page).toContain('.pc-v6-hero-title-line { display: block; }');
    expect(page).toContain(':lang(zh) .pc-v6-hero h1.pc-v6-hero-title');
    expect(page).toContain("--entry-public-header-base: 48px");
    expect(finalCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(finalCss).toContain('content-visibility: auto');
  });
});
