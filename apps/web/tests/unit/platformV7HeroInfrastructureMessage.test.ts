import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 infrastructure hero message', () => {
  const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const copy = read('i18n/platform-v7-hero-message.ts');
  const css = read('styles/platform-v7-hero-infrastructure-message.css');
  const page = read('app/platform-v7/page.tsx');

  it('uses the approved plain-language RU message as the first-screen hierarchy', () => {
    expect(copy).toContain("kicker: 'Цифровая инфраструктура исполнения сделок в растениеводстве'");
    expect(copy).toContain("brand: '«Прозрачная Цена»'");
    expect(copy).toContain("title: 'ведёт агросделку от цены до закрытия.'");
    expect(copy).toContain('Условия, участники, торги, логистика, приёмка, качество, документы, расчёты и доказательства связаны вокруг одной Сделки.');
    expect(component).toContain("className='pc-v6-hero-brand'");
    expect(component).toContain("className='pc-v6-hero-title-line'");
    expect(component).toContain("className='pc-v6-hero-lead'");
  });

  it('keeps RU EN ZH hero copy explicit without locale inheritance', () => {
    expect(copy).toContain("const messages: Record<'ru' | 'en' | 'zh'");
    expect(copy).toContain("locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru");
    expect(copy).toContain("brand: 'Transparent Price'");
    expect(copy).toContain("brand: '透明价格'");
  });

  it('keeps TAI naming concise and user-facing', () => {
    expect(component).toContain("<strong>TAI</strong><span>{copy.tai.mode}</span>");
    expect(component).not.toContain('getTaiName');
    expect(component).not.toContain('прозрачный агроинтеллект');
  });

  it('loads public typography before the page-specific responsive layers', () => {
    const publicTypeIndex = page.indexOf('platform-v7-public-typography.css');
    const baseIndex = page.indexOf('platform-v7-strategic-home-v3.css');
    const heroIndex = page.indexOf('platform-v7-hero-infrastructure-message.css');
    expect(publicTypeIndex).toBeGreaterThanOrEqual(0);
    expect(baseIndex).toBeGreaterThan(publicTypeIndex);
    expect(heroIndex).toBeGreaterThan(baseIndex);
  });

  it('defines deliberate typography for phone, tablet and desktop widths', () => {
    expect(css).toContain('@media (max-width: 374px)');
    expect(css).toContain('@media (min-width: 375px) and (max-width: 767px)');
    expect(css).toContain('@media (min-width: 768px) and (max-width: 1023px)');
    expect(css).toContain('@media (min-width: 1024px)');
    expect(css).toContain('@media (min-width: 1280px)');
    expect(css).toContain('text-wrap: balance');
    expect(css).toContain(':lang(zh) .pc-v6-hero h1.pc-v6-hero-title');
  });
});
