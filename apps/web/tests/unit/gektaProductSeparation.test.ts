import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CANONICAL_DEAL_STAGES, CanonicalGektaStrip, CanonicalPublicHeader } from '@/components/platform-v7/PublicCanonicalPrimitives';
import { GektaFloatingEntry } from '@/components/gekta/GektaFloatingEntry';
import { generateMetadata as dealMetadata } from '@/app/platform-v7/ai-in-action/page';
import { GEKTA_PATHS } from '@/lib/gekta/content';

vi.mock('next-intl/server', () => ({ getLocale: async () => 'ru' }));

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const floatingEntry = read('components/gekta/GektaFloatingEntry.tsx');
const assistant = read('components/platform-v7/PublicPlatformAssistant.tsx');
const contextualPrompts = read('components/platform-v7/PublicContextualAssistantPrompts.tsx');

describe('Gekta platform scenario and standalone Gekta product are separate entry points', () => {
  it('keeps the explanation of the Deal on its own localized platform route', async () => {
    const metadata = await dealMetadata();
    expect(metadata.alternates?.canonical).toBe('/platform-v7/ai-in-action');
    for (const lang of ['ru', 'en', 'zh']) {
      expect(metadata.alternates?.languages?.[lang]).toBe('/platform-v7/ai-in-action?lang=' + lang);
    }
    expect(metadata.title).toContain('Гекта');
  });

  it('renders a direct localized product link next to the distinct in-page Deal assistant', () => {
    expect(home).toContain('<CanonicalGektaStrip locale={locale}');
    for (const [locale, open] of [['ru', 'Открыть Гекту'], ['en', 'Open Gekta'], ['zh', '打开 Gekta']] as const) {
      const dom = new DOMParser().parseFromString(renderToStaticMarkup(createElement(CanonicalGektaStrip, { locale })), 'text/html');
      const link = dom.querySelector('a');
      expect(link?.getAttribute('href')).toBe(GEKTA_PATHS[locale]);
      expect(link?.textContent).toBe(open);
      expect(dom.querySelector('button[aria-haspopup="dialog"]')?.getAttribute('aria-controls')).toBe('pc-public-assistant-panel');
    }
  });

  it('keeps the product overview in navigation and the seven actual stages in the Deal', () => {
    for (const locale of ['ru', 'en', 'zh'] as const) {
      const html = renderToStaticMarkup(createElement(CanonicalPublicHeader, { locale, localeControl: createElement('span') }));
      const dom = new DOMParser().parseFromString(html, 'text/html');
      const link = dom.querySelector('header nav a[href="/platform-v7/gekta?lang=' + locale + '"]');
      expect(link?.textContent).toBe(locale === 'ru' ? 'Гекта' : 'Gekta');
      expect(CANONICAL_DEAL_STAGES[locale]).toHaveLength(7);
      expect(CANONICAL_DEAL_STAGES[locale].join(' ')).not.toMatch(/Гекта|Gekta/i);
    }
  });

  it('yields the floating shortcut to the common dock and open dialogs', () => {
    const layout = read('app/platform-v7/layout.tsx');
    expect(home).not.toContain('<GektaFloatingEntry');
    expect(layout).toContain("<PublicContactDock assistantContext='public' publicMode='gekta'");
    const html = renderToStaticMarkup(createElement(GektaFloatingEntry, { locale: 'ru' }));
    const dom = new DOMParser().parseFromString(html, 'text/html');
    const link = dom.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/gekta?chat=new');
    expect(link?.getAttribute('aria-label')).toBe('Открыть Гекту — новый диалог');
    expect(link?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(link?.textContent?.trim()).toBe('');
    expect(floatingEntry).toContain('env(safe-area-inset-bottom');
    expect(floatingEntry).toContain(':focus-visible');
    expect(floatingEntry).toContain('body:has(.pc-public-contact-dock) .pc-gekta-floating');
    expect(floatingEntry).toContain("body:has([role='dialog'][aria-modal='true']) .pc-gekta-floating");
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
