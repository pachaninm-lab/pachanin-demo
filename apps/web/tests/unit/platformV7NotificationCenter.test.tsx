import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformV7NotificationCenter } from '@/components/v7r/PlatformV7NotificationCenter';
import {
  platformV7PrimaryShellNotification,
  platformV7ShellNotificationSummary,
  platformV7ShellNotifications,
} from '@/lib/platform-v7/shellNotifications';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
} from '@/lib/platform-v7/routes';

// Render next/link as a plain <a> so tests don't need a Next.js router
vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, onClick, ...rest }, children),
}));

const FORBIDDEN_CLAIMS = [
  'production ready',
  'fully live',
  'live integration completed',
  'guaranteed payment',
  'no risk',
  'all integrations completed',
];

function isAllowedHref(href: string): boolean {
  return (
    href.startsWith('/platform-v7') ||
    href.startsWith(`${PLATFORM_V7_DEALS_ROUTE}/`) ||
    href.startsWith(`${PLATFORM_V7_DISPUTES_ROUTE}/`) ||
    href.startsWith(`${PLATFORM_V7_BANK_ROUTE}/`) ||
    href.startsWith(`${PLATFORM_V7_LOGISTICS_ROUTE}/`)
  );
}

describe('PlatformV7NotificationCenter — view model', () => {
  it('summary has unread > 0', () => {
    const summary = platformV7ShellNotificationSummary();
    expect(summary.unread).toBeGreaterThan(0);
  });

  it('summary has critical > 0', () => {
    const summary = platformV7ShellNotificationSummary();
    expect(summary.critical).toBeGreaterThan(0);
  });

  it('primary notification is defined and is unread', () => {
    const primary = platformV7PrimaryShellNotification();
    expect(primary).toBeDefined();
    expect(primary?.read).toBe(false);
  });

  it('primary notification has the highest severity among unread', () => {
    const primary = platformV7PrimaryShellNotification();
    expect(primary?.severity).toBe('critical');
  });

  it('primary notification href stays inside /platform-v7', () => {
    const primary = platformV7PrimaryShellNotification();
    expect(primary).toBeDefined();
    expect(isAllowedHref(primary!.href)).toBe(true);
  });

  it('all notification hrefs stay inside /platform-v7 route classes', () => {
    for (const n of platformV7ShellNotifications()) {
      expect(isAllowedHref(n.href), `${n.id} href ${n.href}`).toBe(true);
    }
  });

  it('no forbidden maturity claims appear in notification copy', () => {
    for (const n of platformV7ShellNotifications()) {
      const text = `${n.title} ${n.description}`.toLowerCase();
      for (const claim of FORBIDDEN_CLAIMS) {
        expect(text.includes(claim), `${n.id} contains forbidden: "${claim}"`).toBe(false);
      }
    }
  });
});

describe('PlatformV7NotificationCenter — render', () => {
  it('renders bell/alert button with aria-label', () => {
    render(<PlatformV7NotificationCenter />);
    const button = screen.getByRole('button', { name: /Уведомления/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label');
  });

  it('aria-label includes unread count', () => {
    render(<PlatformV7NotificationCenter />);
    const button = screen.getByRole('button', { name: /Уведомления/i });
    const summary = platformV7ShellNotificationSummary();
    expect(button.getAttribute('aria-label')).toContain(String(summary.unread));
  });

  it('aria-label mentions critical count when critical > 0', () => {
    render(<PlatformV7NotificationCenter />);
    const button = screen.getByRole('button', { name: /Уведомления/i });
    const summary = platformV7ShellNotificationSummary();
    if (summary.critical > 0) {
      expect(button.getAttribute('aria-label')).toContain('критических');
    }
  });

  it('shows unread count badge', () => {
    render(<PlatformV7NotificationCenter />);
    const summary = platformV7ShellNotificationSummary();
    // Badge is aria-hidden but text is in the DOM
    expect(screen.getByText(String(summary.unread))).toBeInTheDocument();
  });

  it('button has aria-expanded=false initially', () => {
    render(<PlatformV7NotificationCenter />);
    const button = screen.getByRole('button', { name: /Уведомления/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens dialog on button click', () => {
    render(<PlatformV7NotificationCenter />);
    const button = screen.getByRole('button', { name: /Уведомления/i });
    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Центр уведомлений' })).toBeInTheDocument();
  });

  it('button has aria-expanded=true after click', () => {
    render(<PlatformV7NotificationCenter />);
    const button = screen.getByRole('button', { name: /Уведомления/i });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows primary notification title in open panel', () => {
    render(<PlatformV7NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));
    const primary = platformV7PrimaryShellNotification();
    expect(primary).toBeDefined();
    // Title appears in both the primary blocker section and the full list
    expect(screen.getAllByText(primary!.title).length).toBeGreaterThan(0);
  });

  it('shows "Главный блокер" section label', () => {
    render(<PlatformV7NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));
    expect(screen.getByText(/Главный блокер/i)).toBeInTheDocument();
  });

  it('shows critical count badge in panel header when critical > 0', () => {
    render(<PlatformV7NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));
    const summary = platformV7ShellNotificationSummary();
    if (summary.critical > 0) {
      expect(screen.getByText(new RegExp(`${summary.critical}.*критич`, 'i'))).toBeInTheDocument();
    }
  });

  it('all links in open panel point inside /platform-v7', () => {
    render(<PlatformV7NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(isAllowedHref(href), `href="${href}" must stay in /platform-v7`).toBe(true);
    }
  });

  it('all links have an accessible name', () => {
    render(<PlatformV7NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const name = link.getAttribute('aria-label') ?? link.textContent ?? '';
      expect(name.trim().length, `link without accessible name`).toBeGreaterThan(0);
    }
  });

  it('close button is accessible and closes the dialog', () => {
    render(<PlatformV7NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));
    const closeBtn = screen.getByRole('button', { name: /Закрыть центр уведомлений/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no forbidden maturity claims appear in rendered panel copy', () => {
    render(<PlatformV7NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));
    const panelText = (screen.getByRole('dialog').textContent ?? '').toLowerCase();
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(panelText.includes(claim), `rendered panel contains forbidden: "${claim}"`).toBe(false);
    }
  });
});
