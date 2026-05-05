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
  it('renders separate warning and notification triggers in the header', () => {
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

  it('opens the read-only notification panel from the warning trigger', () => {
    const model = platformV7ShellNotificationCenterModel();
    render(<PlatformV7NotificationCenter model={model} />);

    const trigger = screen.getByRole('button', { name: /Предупреждения/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Центр уведомлений' })).toBeInTheDocument();
    expect(screen.getByText('Главный блокер')).toBeInTheDocument();
    expect(screen.getAllByText(model.primary!.title).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`${model.summary.critical}.*критич`, 'i'))).toBeInTheDocument();
  });

  it('opens the same panel from the notification trigger', () => {
    const model = platformV7ShellNotificationCenterModel();
    render(<PlatformV7NotificationCenter model={model} />);

    const trigger = screen.getByRole('button', { name: /Уведомления/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Центр уведомлений' })).toBeInTheDocument();
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

  it('closes with Escape and returns aria-expanded to false', () => {
    const model = platformV7ShellNotificationCenterModel();
    render(<PlatformV7NotificationCenter model={model} />);

    const trigger = screen.getByRole('button', { name: /Уведомления/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
