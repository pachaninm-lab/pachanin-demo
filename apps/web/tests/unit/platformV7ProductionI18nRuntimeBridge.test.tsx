import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { PlatformV7TranslationRuntimeBridge } from '@/components/platform-v7/PlatformV7TranslationRuntimeBridge';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Platform V7 production i18n runtime bridge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.lang = 'en';
    window.localStorage.clear();
    window.history.replaceState({}, '', '/platform-v7?lang=en');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('translates the exact residual public chrome proven by production acceptance', async () => {
    document.body.innerHTML = `
      <nav aria-label="Связь и помощь">
        <a aria-label="Прозрачная Цена — на главную">Прозрачная Цена</a>
        <button aria-label="Открыть Гекту">Гекта</button>
        <button aria-label="Поддержка">Поддержка</button>
        <a aria-label="Позвонить по номеру 8 916 277-89-89">Позвонить</a>
      </nav>`;

    render(<PlatformV7TranslationRuntimeBridge />);

    await waitFor(() => {
      expect(document.querySelector('nav')?.getAttribute('aria-label')).toBe('Help and contact');
      expect(document.querySelector('a')?.getAttribute('aria-label')).toBe('Transparent Price — home');
      expect(document.querySelector('button')?.getAttribute('aria-label')).toBe('Open Gekta');
      expect(document.body.textContent).toContain('Gekta');
      expect(document.body.textContent).toContain('Support');
      expect(document.body.textContent).toContain('Call');
    });
  });

  it('translates dynamic public DOM inserted after hydration', async () => {
    render(<PlatformV7TranslationRuntimeBridge />);

    const dynamic = document.createElement('button');
    dynamic.textContent = 'Назад';
    dynamic.setAttribute('aria-label', 'Справка');
    document.body.appendChild(dynamic);

    await waitFor(() => {
      expect(dynamic.textContent).toBe('Back');
      expect(dynamic.getAttribute('aria-label')).toBe('Help');
    });
  });

  it('renders the register brand home accessible name from locale-native chrome copy', () => {
    const source = read('apps/web/app/platform-v7/register/RegisterCleanClient.tsx');
    expect(source).toContain("const chrome = useTranslations('publicEntry.chrome')");
    expect(source).toContain("brandHomeLabel={chrome('brandHomeLabel')}");
  });

  it('keeps the bridge available only for legacy public routes that still need DOM translation', () => {
    const source = read('apps/web/components/platform-v7/HydrationSafeChatSupport.tsx');
    const boundary = source.slice(
      source.indexOf('function needsLegacyTranslationBridge'),
      source.indexOf('/**', source.indexOf('function needsLegacyTranslationBridge')),
    );

    expect(source).not.toContain("import { PlatformV7TranslationRuntimeBridge }");
    expect(source).toContain('const PlatformV7TranslationRuntimeBridge = dynamic(');
    expect(source).toContain("() => import('@/components/platform-v7/PlatformV7TranslationRuntimeBridge').then((module) => module.PlatformV7TranslationRuntimeBridge)");
    expect(source).toContain('{loadTranslationBridge ? <PlatformV7TranslationRuntimeBridge /> : null}');
    expect(source).toContain('<PlatformV7TranslationRuntimeBridge />');
    expect(boundary).toContain("clean === '/platform-v7/deal-flow'");
    expect(boundary).toContain("clean === '/platform-v7/demo'");
    expect(boundary).not.toContain("clean === '/platform-v7/contact'");
    expect(boundary).not.toContain("clean === '/platform-v7/docs'");
    expect(boundary).not.toContain("clean === '/platform-v7'");
    expect(boundary).not.toContain("clean === '/pc-public-entry/platform-v7'");
  });
});


describe('Platform V7 docs source chain', () => {
  it('keeps docs as a locale-native direct public page rather than a legacy rewrite/translator surface', () => {
    const docs = read('apps/web/app/platform-v7/docs/page.tsx');
    const middleware = read('apps/web/middleware.ts');
    const seo = read('apps/web/lib/platform-v7/public-seo-routes.json');
    const layout = read('apps/web/app/platform-v7/layout.tsx');

    expect(docs).toContain("data-testid='platform-v7-public-docs-page'");
    expect(docs).toContain("title: 'Документы связывают условия, исполнение и расчёт'");
    expect(docs).toContain("title: 'Documents connect terms, execution and settlement'");
    expect(docs).toContain("title: '文件连接约定条件、履约和结算'");
    expect(seo).toContain('"path": "/platform-v7/docs"');
    expect(layout).toContain("'/platform-v7/docs'");
    expect(middleware).toContain('...PLATFORM_V7_INDEXABLE_EXACT');
    expect(middleware).toContain('if (isPlatformV7PublicPath(p) || isPlatformV7StaffPath(p))');
    expect(middleware).not.toContain("target.pathname = '/pc-public-entry/platform-v7/docs'");
  });
});
