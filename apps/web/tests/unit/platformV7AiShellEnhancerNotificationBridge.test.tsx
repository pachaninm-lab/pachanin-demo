import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiShellEnhancer } from '@/components/v7r/AiShellEnhancer';

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, onClick, ...rest }, children),
}));

describe('AiShellEnhancer notification center bridge', () => {
  it('renders the platform v7 notification center bridge', () => {
    render(<AiShellEnhancer />);

    expect(screen.getByLabelText('Центр уведомлений platform-v7 shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Уведомления/i })).toBeInTheDocument();
  });

  it('does not render forbidden maturity claims', () => {
    render(<AiShellEnhancer />);

    const copy = document.body.textContent?.toLowerCase() ?? '';
    expect(copy.includes('production ready')).toBe(false);
    expect(copy.includes('fully live')).toBe(false);
    expect(copy.includes('guaranteed payment')).toBe(false);
    expect(copy.includes('all integrations completed')).toBe(false);
  });
});
