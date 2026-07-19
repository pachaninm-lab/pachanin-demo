import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CabinetContactDock } from '../../components/platform-v7/CabinetContactDock';

vi.mock('next/navigation', () => ({ usePathname: () => '/platform-v7/bank/payment-basis' }));
vi.mock('@/lib/analytics/track', () => ({ trackEvent: vi.fn() }));

function nativeButton(className: string, onClick = vi.fn()): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.addEventListener('click', onClick);
  document.body.append(button);
  return button;
}

describe('CabinetContactDock runtime', () => {
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

  it('renders the verified bank context and delegates every action', () => {
    const assistantClick = vi.fn();
    const supportClick = vi.fn();
    nativeButton('p7-ai-trigger', assistantClick);
    nativeButton('p7-support-chat-button', supportClick);

    render(<CabinetContactDock role='bank' />);

    const dock = screen.getByRole('navigation', { name: 'Связь и помощь — кабинет «Банк»' });
    expect(dock).toHaveAttribute('data-cabinet-role', 'bank');
    expect(dock).toHaveAttribute('data-role-tone', 'review');
    expect(dock).toHaveAttribute('data-shell-family', 'role-scoped');
    expect(dock).toHaveAttribute('data-support-topic', 'payments');
    expect(screen.getByText('Банк')).toBeVisible();
    expect(screen.getByText('Платежи')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Открыть ИИ-помощника кабинета «Банк»/ }));
    fireEvent.click(screen.getByRole('button', { name: /Открыть поддержку кабинета «Банк»/ }));

    expect(assistantClick).toHaveBeenCalledOnce();
    expect(supportClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: /Позвонить в поддержку кабинета «Банк»/ }))
      .toHaveAttribute('href', 'tel:+79162778989');
  });

  it('uses field ergonomics for physical-execution cabinets', () => {
    nativeButton('p7-ai-trigger');
    nativeButton('p7-support-chat-button');
    render(<CabinetContactDock role='driver' />);

    const dock = screen.getByRole('navigation', { name: 'Связь и помощь — кабинет «Водитель»' });
    expect(dock).toHaveAttribute('data-role-tone', 'field');
    expect(dock).toHaveAttribute('data-shell-family', 'field');
    expect(dock).toHaveAttribute('data-support-topic', 'logistics');
    expect(screen.getByText('Рейс')).toBeVisible();
  });

  it('hides internal launchers even when they mount after the dock', async () => {
    render(<CabinetContactDock role='buyer' />);
    const assistant = nativeButton('p7-ai-trigger');
    const support = nativeButton('p7-support-chat-button');

    await waitFor(() => expect(assistant).toHaveAttribute('aria-hidden', 'true'));
    expect(assistant).toHaveAttribute('tabindex', '-1');
    expect(support).toHaveAttribute('aria-hidden', 'true');
    expect(support).toHaveAttribute('tabindex', '-1');
  });

  it('focuses the existing workspace assistant without creating another panel', async () => {
    nativeButton('p7-support-chat-button');
    const workspace = document.createElement('section');
    workspace.id = 'p7-private-ai-assistant-workspace';
    workspace.tabIndex = -1;
    workspace.scrollIntoView = vi.fn();
    document.body.append(workspace);

    render(<CabinetContactDock role='arbitrator' assistantContext='workspace' />);
    fireEvent.click(screen.getByRole('button', { name: /Открыть ИИ-помощника кабинета «Арбитр»/ }));

    expect(workspace.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    await waitFor(() => expect(document.activeElement).toBe(workspace));
  });
});
