import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 infrastructure hero message', () => {
  const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const copy = read('i18n/platform-v7-hero-message.ts');
  const css = read('styles/platform-v7-hero-infrastructure-message.css');
  const page = read('app/platform-v7/page.tsx');

  it('uses the approved RU message as the public first-screen hierarchy', () => {
    expect(copy).toContain("brand: '«Прозрачная Цена»'");
    expect(copy).toContain("title: '— единая цифровая инфраструктура исполнения агросделки.'");
    expect(copy).toContain('Платформа связывает цену, участников, логистику, качество, документы, расчёты и доказательства в одном управляемом контуре.');
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

  it('loads the responsive layer after the strategic homepage base styles', () => {
    const baseIndex = page.indexOf("platform-v7-strategic-home-v3.css");
    const heroIndex = page.indexOf("platform-v7-hero-infrastructure-message.css");
    expect(baseIndex).toBeGreaterThanOrEqual(0);
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
