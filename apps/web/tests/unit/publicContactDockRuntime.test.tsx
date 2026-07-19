import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PublicContactDock } from '../../components/platform-v7/PublicContactDock';

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
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0),
    });
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('delegates the public AI and support actions to their internal workflows', () => {
    const assistantClick = vi.fn();
    const supportClick = vi.fn();
    const assistant = nativeButton('pc-public-assistant-shortcut', assistantClick);
    const support = nativeButton('p7-support-chat-button', supportClick);

    render(<PublicContactDock />);

    fireEvent.click(screen.getByRole('button', { name: 'Открыть ИИ-помощника по платформе' }));
    fireEvent.click(screen.getByRole('button', { name: 'Открыть поддержку' }));

    expect(assistantClick).toHaveBeenCalledOnce();
    expect(supportClick).toHaveBeenCalledOnce();
    expect(assistant).toHaveAttribute('aria-hidden', 'true');
    expect(support).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('link', { name: 'Позвонить по номеру 8 916 277-89-89' }))
      .toHaveAttribute('href', 'tel:+79162778989');
  });

  it('delegates the private AI action and stays above the cabinet navigation', () => {
    const assistantClick = vi.fn();
    nativeButton('p7-ai-trigger', assistantClick);
    nativeButton('p7-support-chat-button');

    render(<PublicContactDock assistantContext='private' />);
    const dock = screen.getByRole('navigation', { name: 'Связь и помощь' });

    fireEvent.click(screen.getByRole('button', { name: 'Открыть ИИ-помощника по платформе' }));

    expect(assistantClick).toHaveBeenCalledOnce();
    expect(dock).toHaveAttribute('data-assistant-context', 'private');
  });

  it('focuses the existing full-page assistant instead of mounting a second one', async () => {
    nativeButton('p7-support-chat-button');
    const workspace = document.createElement('section');
    workspace.id = 'p7-private-ai-assistant-workspace';
    workspace.tabIndex = -1;
    const scrollIntoView = vi.fn();
    workspace.scrollIntoView = scrollIntoView;
    document.body.append(workspace);

    render(<PublicContactDock assistantContext='workspace' />);
    fireEvent.click(screen.getByRole('button', { name: 'Открыть ИИ-помощника по платформе' }));

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
