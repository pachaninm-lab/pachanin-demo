import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const routerRefresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routerRefresh }) }));

import { PlatformTranslator } from '@/components/platform-v7/PlatformTranslator';
import { LANGUAGE_STORAGE_KEY } from '@/lib/platform-v7/i18n/translation-runtime';

function mountLanding() {
  const landing = document.createElement('div');
  landing.innerHTML = `
    <div class="entry-header-actions"></div>
    <h1 id="hero">Главный риск сделки</h1>
    <a id="cta" href="/platform-v7/register">Зарегистрироваться</a>`;
  document.body.appendChild(landing);
  return landing;
}

describe('PlatformTranslator', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = '';
    document.documentElement.lang = 'ru';
    // Обновление словаря с сервера в тесте не нужно: остаётся встроенный словарь.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the translator button into the header target', async () => {
    mountLanding();
    render(<PlatformTranslator />);
    await waitFor(() => {
      expect(document.querySelector('.entry-header-actions .p7-translator-button')).toBeTruthy();
    });
  });

  it('opens the panel, switches to English, translates the page and persists the choice', async () => {
    mountLanding();
    render(<PlatformTranslator />);
    const button = await screen.findByRole('button', { name: 'Переводчик' });
    fireEvent.click(button);

    const english = await screen.findByRole('button', { name: /English/ });
    fireEvent.click(english);

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.cookie).toContain('pc-v7-locale=en');
    expect(routerRefresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(document.querySelector('#hero')?.textContent).toBe('The main transaction risk');
      expect(document.querySelector('#cta')?.textContent).toBe('Register');
      expect(document.documentElement.lang).toBe('en');
    });

    // Панель закрылась, кнопка показывает EN и англоязычную подпись.
    expect(screen.queryByRole('dialog')).toBeNull();
    await screen.findByRole('button', { name: 'Translator' });
  });

  it('switches back to Russian and restores the original copy', async () => {
    mountLanding();
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    render(<PlatformTranslator />);
    await waitFor(() => {
      expect(document.querySelector('#hero')?.textContent).toBe('The main transaction risk');
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Translator' }));
    fireEvent.click(await screen.findByRole('button', { name: /Русский/ }));

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ru');
    await waitFor(() => {
      expect(document.querySelector('#hero')?.textContent).toBe('Главный риск сделки');
      expect(document.documentElement.lang).toBe('ru');
    });
  });

  it('closes the panel on Escape', async () => {
    mountLanding();
    render(<PlatformTranslator />);
    fireEvent.click(await screen.findByRole('button', { name: 'Переводчик' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('picks up a language change made by another platform widget (same tab)', async () => {
    mountLanding();
    render(<PlatformTranslator />);
    await screen.findByRole('button', { name: 'Переводчик' });

    const { writeStoredLanguage } = await import('@/lib/platform-v7/i18n/translation-runtime');
    writeStoredLanguage('zh');

    await waitFor(() => {
      expect(document.querySelector('#cta')?.textContent).toBe('注册');
      expect(document.documentElement.lang).toBe('zh-CN');
    });
  });

  it('does not translate its own UI', async () => {
    mountLanding();
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    render(<PlatformTranslator />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translator' }));
    const dialog = await screen.findByRole('dialog');
    // Внутри панели остаются нативные названия языков, а не переводы через словарь.
    expect(dialog.textContent).toContain('Русский');
    expect(dialog.textContent).toContain('中文');
  });
});
