import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const storyCopy = read('i18n/platform-v7-home-story-product.ts');
const floatingEntry = read('components/gekta/GektaFloatingEntry.tsx');
const assistant = read('components/platform-v7/PublicPlatformAssistant.tsx');
const contextualPrompts = read('components/platform-v7/PublicContextualAssistantPrompts.tsx');

describe('Gekta platform scenario and standalone Gekta product are separate entry points', () => {
  it('keeps the in-Deal Gekta explanation on the platform route, not on the standalone product route', () => {
    expect(home).toContain('const taiHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(normalizedLocale)}`;');
    expect(home).not.toContain('const taiHref = `/gekta');
    expect(home).toContain("eventName='tai_detail_open'");
    expect(storyCopy).toContain('Гекта');
  });

  it('keeps the standalone Gekta product block with its own canonical route and CTA', () => {
    expect(home).toContain('const gektaProductHref = GEKTA_PATHS[normalizedLocale];');
    expect(home).toContain("data-gekta-product-entry='true'");
    expect(home).toContain('{story.gektaProduct.title}');
    expect(home).toContain('{story.gektaProduct.cta}');
    expect(home).toContain("eventName='gekta_product_open'");
    expect(storyCopy).toContain("title: 'Гекта — самостоятельный аграрный ИИ'");
    expect(storyCopy).toContain("cta: 'Открыть Гекту'");
    expect(storyCopy).toContain("title: 'Gekta — a standalone agricultural AI'");
    expect(storyCopy).toContain("title: 'Gekta — 独立的农业人工智能'");
  });

  it('publishes the standalone product as a navigation destination without making it a Deal phase', () => {
    expect(home).toContain("<a href={gektaProductHref} data-nav-product='gekta'>{story.gektaProduct.navLabel}</a>");
    expect(storyCopy).toContain("navLabel: 'Гекта'");
    expect(storyCopy).toContain("navLabel: 'Gekta'");
    expect(storyCopy).toContain("processTitle: 'Семь шагов обычной агросделки'");
    expect(storyCopy).not.toContain("title: 'Анализ Гекты'");
  });

  it('renders an icon-only floating product entry that yields to an open dialog', () => {
    expect(home).toContain('<GektaFloatingEntry locale=');
    expect(floatingEntry).not.toContain("'use client'");
    expect(floatingEntry).toContain('aria-label={LABEL[locale]}');
    expect(floatingEntry).toContain('?chat=new');
    expect(floatingEntry).toContain('env(safe-area-inset-bottom');
    expect(floatingEntry).toContain(':focus-visible');
    expect(floatingEntry).toContain("body:has([role='dialog'][aria-modal='true']) .pc-gekta-floating");
    expect(floatingEntry).toContain("<span aria-hidden='true' className='pc-gekta-floating-mark'>G</span>");
  });

  it('reaches the canonical home through a transparent alias wrapper without hidden tree surgery', () => {
    const international = read('components/platform-v7/PlatformV7StrategicHomeInternational.tsx');
    expect(international).toContain("import { PlatformV7StrategicHome as BasePlatformV7StrategicHome } from './PlatformV7StrategicHome';");
    expect(international).toContain('return BasePlatformV7StrategicHome();');
    expect(international).not.toContain('cloneElement');
    expect(international).not.toContain('return null;');
    expect(international).not.toContain("props.id === 'deal-path'");
    expect(international).not.toContain("normalizedKey(element.key) === '08'");
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
