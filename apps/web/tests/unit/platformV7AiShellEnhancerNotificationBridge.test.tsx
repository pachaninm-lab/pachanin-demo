import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiShellEnhancer } from '@/components/v7r/AiShellEnhancer';
import { platformV7ShellNotificationCenterModel } from '@/lib/platform-v7/shellNotificationCenter';

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, onClick, ...rest }, children),
}));

const forbiddenClaims = [
  'production ready',
  'fully live',
  'live integration completed',
  'guaranteed payment',
  'no risk',
  'all integrations completed',
];

describe('AiShellEnhancer notification center bridge', () => {
  it('renders the platform v7 notification center bridge', () => {
    render(<AiShellEnhancer />);

    expect(screen.getByLabelText('Центр уведомлений platform-v7 shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Уведомления/i })).toBeInTheDocument();
  });

  it('renders unread and critical signal through the bridged trigger', () => {
    const model = platformV7ShellNotificationCenterModel();
    render(<AiShellEnhancer />);

    const trigger = screen.getByRole('button', { name: /Уведомления/i });

    expect(trigger.getAttribute('aria-label')).toContain(String(model.summary.unread));
    expect(trigger.getAttribute('aria-label')).toContain(String(model.summary.critical));
    expect(screen.getByText(model.badgeLabel)).toBeInTheDocument();
  });

  it('opens the bridged notification center and keeps primary blocker visible', () => {
    render(<AiShellEnhancer />);

    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));

    expect(screen.getByRole('dialog', { name: 'Центр уведомлений' })).toBeInTheDocument();
    expect(screen.getByText('Главный блокер')).toBeInTheDocument();
  });

  it('closes the bridged notification center on Escape', () => {
    render(<AiShellEnhancer />);

    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));
    expect(screen.getByRole('dialog', { name: 'Центр уведомлений' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Центр уведомлений' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Уведомления/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps every bridged notification action inside platform v7', () => {
    render(<AiShellEnhancer />);

    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));

    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('/platform-v7')).toBe(true);
      expect(href.includes('/platform-v4')).toBe(false);
      expect(href.includes('/platform-v9')).toBe(false);
    }
  });

  it('does not render forbidden maturity claims in the opened notification panel', () => {
    render(<AiShellEnhancer />);

    fireEvent.click(screen.getByRole('button', { name: /Уведомления/i }));

    const copy = screen.getByRole('dialog', { name: 'Центр уведомлений' }).textContent?.toLowerCase() ?? '';
    for (const claim of forbiddenClaims) {
      expect(copy.includes(claim)).toBe(false);
    }
  });
});
