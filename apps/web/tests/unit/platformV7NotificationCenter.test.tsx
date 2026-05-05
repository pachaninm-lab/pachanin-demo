import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlatformV7NotificationCenter } from '@/components/v7r/PlatformV7NotificationCenter';
import { platformV7ShellNotificationCenterModel } from '@/lib/platform-v7/shellNotificationCenter';

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, onClick, ...rest }, children),
}));

describe('PlatformV7NotificationCenter', () => {
  it('renders separate warning and notification triggers before the first read', () => {
    const model = platformV7ShellNotificationCenterModel();
    render(<PlatformV7NotificationCenter model={model} />);

    const warningTrigger = screen.getByRole('button', { name: /Предупреждения/i });
    const notificationTrigger = screen.getByRole('button', { name: /Уведомления/i });

    expect(warningTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(notificationTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(warningTrigger.getAttribute('aria-label')).toContain(String(model.summary.critical));
    expect(notificationTrigger.getAttribute('aria-label')).toContain(String(model.summary.unread));
    expect(screen.getByText(model.badgeLabel)).toBeInTheDocument();
  });

  it('collapses to one read notification trigger after opening the panel', () => {
    const model = platformV7ShellNotificationCenterModel();
    render(<PlatformV7NotificationCenter model={model} />);

    fireEvent.click(screen.getByRole('button', { name: /Предупреждения/i }));
    fireEvent.click(screen.getByRole('button', { name: /Закрыть центр уведомлений/i }));

    expect(screen.queryByRole('button', { name: /Предупреждения/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Уведомления: последние просмотренные/i })).toBeInTheDocument();
    expect(screen.queryByText(model.badgeLabel)).not.toBeInTheDocument();
  });

  it('opens the panel with read-state wording after acknowledgement', () => {
    const model = platformV7ShellNotificationCenterModel();
    render(<PlatformV7NotificationCenter model={model} />);

    fireEvent.click(screen.getByRole('button', { name: /Предупреждения/i }));
    fireEvent.click(screen.getByRole('button', { name: /Закрыть центр уведомлений/i }));
    fireEvent.click(screen.getByRole('button', { name: /Уведомления: последние просмотренные/i }));

    expect(screen.getByRole('dialog', { name: 'Центр уведомлений' })).toBeInTheDocument();
    expect(screen.getByText('Последние уведомления')).toBeInTheDocument();
    expect(screen.getByText('новых нет')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Прочитанные.*${model.items.length}`, 'i'))).toBeInTheDocument();
  });

  it('keeps every rendered action inside platform v7 with accessible link names', () => {
    const model = platformV7ShellNotificationCenterModel();
    render(<PlatformV7NotificationCenter model={model} />);

    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));

    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';
      const label = link.getAttribute('aria-label') ?? link.textContent ?? '';

      expect(href.startsWith('/platform-v7')).toBe(true);
      expect(href.includes('/platform-v4')).toBe(false);
      expect(href.includes('/platform-v9')).toBe(false);
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('closes with Escape and keeps the single read trigger after acknowledgement', () => {
    const model = platformV7ShellNotificationCenterModel();
    render(<PlatformV7NotificationCenter model={model} />);

    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Предупреждения/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Уведомления: последние просмотренные/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
