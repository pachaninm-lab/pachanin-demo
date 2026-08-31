import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const storyCopy = read('i18n/platform-v7-home-story-operating.ts');
const floatingEntry = read('components/gekta/GektaFloatingEntry.tsx');
const assistant = read('components/platform-v7/PublicPlatformAssistant.tsx');
const contextualPrompts = read('components/platform-v7/PublicContextualAssistantPrompts.tsx');

describe('Gekta platform scenario and Gekta product are separate entry points', () => {
  it('keeps "Посмотреть Гекту в работе" on the platform scenario, not on the product route', () => {
    expect(home).toContain('const taiHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;');
    expect(home).not.toContain('const taiHref = `/gekta');
    expect(storyCopy).toContain("cta: 'Посмотреть Гекту в работе'");
  });

  it('adds a standalone Gekta product block with its own CTA into the canonical product route', () => {
    expect(home).toContain('const gektaProductHref = GEKTA_PATHS[');
    expect(home).toContain("data-gekta-product-entry='true'");
    expect(home).toContain('{story.gektaProduct.title}');
    expect(home).toContain('{story.gektaProduct.cta}');
    expect(home).toContain("eventName='gekta_product_open'");
    expect(storyCopy).toContain("title: 'Гекта — самостоятельный аграрный ИИ'");
    expect(storyCopy).toContain("cta: 'Открыть Гекту'");
    expect(storyCopy).toContain("title: 'Gekta — a standalone agricultural AI'");
    expect(storyCopy).toContain("title: 'Gekta — 独立的农业人工智能'");
  });

  it('publishes the product as its own navigation destination, shared by desktop nav and the hamburger', () => {
    expect(home).toContain("<a href={gektaProductHref} data-nav-product='gekta'>{story.gektaProduct.navLabel}</a>");
    expect(storyCopy).toContain("navLabel: 'Гекта'");
    expect(storyCopy).toContain("navLabel: 'Gekta'");
  });

  it('renders an icon-only floating product entry that yields to an open dialog', () => {
    expect(home).toContain('<GektaFloatingEntry locale=');
    expect(floatingEntry).not.toContain("'use client'");
    expect(floatingEntry).toContain('aria-label={LABEL[locale]}');
    expect(floatingEntry).toContain('?chat=new');
    expect(floatingEntry).toContain('env(safe-area-inset-bottom');
    expect(floatingEntry).toContain(':focus-visible');
    expect(floatingEntry).toContain("body:has([role='dialog'][aria-modal='true']) .pc-gekta-floating");
    // No text plate: only the brand mark is rendered inside the control.
    expect(floatingEntry).toContain("<span aria-hidden='true' className='pc-gekta-floating-mark'>G</span>");
  });

  it('reaches the rendered home, not just the base component file', () => {
    // `/platform-v7` рендерит международную обёртку, а не базовый компонент
    // напрямую: alias `@/components/platform-v7/PlatformV7StrategicHome`
    // указывает на неё. Обёртка обходит дерево базового компонента и
    // вырезает узлы — если она начнёт вырезать что-то ещё, блок продукта и
    // плавающая кнопка молча исчезнут с живой страницы.
    const international = read('components/platform-v7/PlatformV7StrategicHomeInternational.tsx');
    expect(international).toContain("import { PlatformV7StrategicHome as BasePlatformV7StrategicHome } from './PlatformV7StrategicHome';");
    expect(international).toContain('const base = await BasePlatformV7StrategicHome();');

    const dropped = international.match(/return null;/gu) ?? [];
    expect(dropped).toHaveLength(2);
    expect(international).toContain("if (props.id === 'deal-path') return null;");
    expect(international).toContain("if (element.type === 'article' && normalizedKey(element.key) === '08') return null;");
  });

  it('keeps the platform dialog focused on platform value', () => {
    expect(assistant).toContain("emptyTitle: 'Чем я могу вам помочь?'");
    expect(assistant).toContain("subtitle: 'ИИ для сельского хозяйства и агробизнеса от «Прозрачной Цены»'");
    expect(contextualPrompts).toContain('Что может платформа «Прозрачная Цена»?');
    expect(contextualPrompts).toContain('Для кого создана платформа?');
    expect(contextualPrompts).toContain('Какие задачи можно решать через платформу?');
    expect(contextualPrompts).toContain('Как защищаются данные?');
  });
});
