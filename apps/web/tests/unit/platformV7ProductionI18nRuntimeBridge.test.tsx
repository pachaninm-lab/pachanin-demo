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

  it('is mounted through the shared public and protected hydration runtime', () => {
    const source = read('apps/web/components/platform-v7/HydrationSafeChatSupport.tsx');
    expect(source).toContain("import { PlatformV7TranslationRuntimeBridge }");
    expect(source).toContain('<PlatformV7TranslationRuntimeBridge />');
  });
});
