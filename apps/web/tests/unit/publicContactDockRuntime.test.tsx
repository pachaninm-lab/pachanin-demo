import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PublicContactDock } from '../../components/platform-v7/PublicContactDock';
import { PublicPlatformAssistant } from '../../components/platform-v7/PublicPlatformAssistant';

vi.mock('@/lib/analytics/track', () => ({ trackEvent: vi.fn() }));

function nativeButton(className: string, onClick = vi.fn()): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.addEventListener('click', onClick);
  document.body.append(button);
  return button;
}

describe('PublicContactDock runtime', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru';
    window.sessionStorage.clear();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0),
    });
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps public pages API-isolated until Gekta is explicitly opened', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        knowledgeVersion: 'test-v1',
        dataMode: 'public_knowledge',
        actionAllowed: false,
        title: 'Test catalog',
        description: 'Test catalog',
        starterPrompts: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PublicPlatformAssistant />);
    const launcher = screen.getByRole('button', {
      name: 'Спросить Гекту Аграрный интеллект',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(launcher);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public-platform-assistant?locale=ru',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(screen.getByRole('dialog', { name: 'Гекта' })).toBeVisible();
  });

  it('migrates a validated legacy transcript into the Gekta storage key', async () => {
    const legacyMessage = {
      id: 'legacy-user-1',
      role: 'user',
      text: 'Сохрани мой старый вопрос о картофеле',
      createdAt: '2026-08-10T10:00:00.000Z',
    };
    window.sessionStorage.setItem('pc-public-assistant-v2:ru', JSON.stringify([legacyMessage]));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        knowledgeVersion: 'test-v1',
        dataMode: 'public_knowledge',
        actionAllowed: false,
        title: 'Test catalog',
        description: 'Test catalog',
        starterPrompts: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PublicPlatformAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Спросить Гекту Аграрный интеллект' }));

    expect(await screen.findByText(legacyMessage.text)).toBeVisible();
    await waitFor(() => {
      expect(window.sessionStorage.getItem('pc-public-assistant-v2:ru')).toBeNull();
      const migrated = JSON.parse(window.sessionStorage.getItem('pc-gekta-assistant-v1:ru') || '[]') as Array<{ text: string }>;
      expect(migrated.some((message) => message.text === legacyMessage.text)).toBe(true);
    });
  });

  it('delegates the Gekta and support actions to their internal workflows', () => {
    const assistantClick = vi.fn();
    const supportClick = vi.fn();
    const assistant = nativeButton('pc-public-assistant-shortcut', assistantClick);
    const support = nativeButton('p7-support-chat-button', supportClick);

    render(<PublicContactDock />);

    fireEvent.click(screen.getByRole('button', { name: 'Открыть Гекту' }));
    fireEvent.click(screen.getByRole('button', { name: 'Открыть поддержку' }));

    expect(assistantClick).toHaveBeenCalledOnce();
    expect(supportClick).toHaveBeenCalledOnce();
    expect(assistant).toHaveAttribute('aria-hidden', 'true');
    expect(support).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('link', { name: 'Позвонить по номеру 8 916 277-89-89' }))
      .toHaveAttribute('href', 'tel:+79162778989');
  });

  it('keeps the Gekta action visible and enabled at the top of a mobile homepage', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      media: '(max-width: 767px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    nativeButton('pc-public-assistant-shortcut');
    nativeButton('p7-support-chat-button');

    render(<PublicContactDock />);

    const dock = screen.getByRole('navigation', { name: 'Связь и помощь' });
    const assistant = screen.getByRole('button', { name: 'Открыть Гекту' });
    expect(dock).toHaveAttribute('data-scroll-hidden', 'false');
    expect(assistant).toBeEnabled();
    expect(assistant).toHaveAttribute('tabindex', '0');
  });

  it('delegates the private Gekta action and stays above the cabinet navigation', () => {
    const assistantClick = vi.fn();
    nativeButton('p7-ai-trigger', assistantClick);
    nativeButton('p7-support-chat-button');

    render(<PublicContactDock assistantContext='private' />);
    const dock = screen.getByRole('navigation', { name: 'Связь и помощь' });

    fireEvent.click(screen.getByRole('button', { name: 'Открыть Гекту' }));

    expect(assistantClick).toHaveBeenCalledOnce();
    expect(dock).toHaveAttribute('data-assistant-context', 'private');
  });

  it('focuses the existing full-page Gekta workspace instead of mounting a second one', async () => {
    nativeButton('p7-support-chat-button');
    const workspace = document.createElement('section');
    workspace.id = 'p7-private-ai-assistant-workspace';
    workspace.tabIndex = -1;
    const scrollIntoView = vi.fn();
    workspace.scrollIntoView = scrollIntoView;
    document.body.append(workspace);

    render(<PublicContactDock assistantContext='workspace' />);
    fireEvent.click(screen.getByRole('button', { name: 'Открыть Гекту' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    await waitFor(() => expect(document.activeElement).toBe(workspace));
  });

  it('gets out of the way while any aria-modal dialog is open', async () => {
    nativeButton('p7-ai-trigger');
    nativeButton('p7-support-chat-button');
    render(<PublicContactDock assistantContext='private' />);
    const dock = screen.getByRole('navigation', { name: 'Связь и помощь' });

    const dialog = document.createElement('section');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);

    await waitFor(() => expect(dock).toHaveAttribute('data-dialog-open', 'true'));
    expect(dock).toHaveAttribute('aria-hidden', 'true');

    dialog.remove();
    await waitFor(() => expect(dock).toHaveAttribute('data-dialog-open', 'false'));
  });
});
