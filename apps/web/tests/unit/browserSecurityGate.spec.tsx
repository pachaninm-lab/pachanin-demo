import { describe, expect, it, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BrowserSecurityGate } from '../../components/common/BrowserSecurityGate';

/**
 * ASVS V3.7.5 at the behaviour: a surface that needs a feature the browser does
 * not have says so instead of rendering controls that cannot work.
 */

describe('the browser security gate', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('renders the surface when the browser has what it needs', () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('crypto', { randomUUID: () => 'x', subtle: {} });
    render(<BrowserSecurityGate><p>controls</p></BrowserSecurityGate>);
    expect(screen.getByText('controls')).toBeTruthy();
    expect(screen.queryByTestId('browser-security-gate')).toBeNull();
  });

  it('refuses, and says which requirement is unmet, when it does not', () => {
    vi.stubGlobal('isSecureContext', false);
    vi.stubGlobal('crypto', {});
    render(<BrowserSecurityGate><p>controls</p></BrowserSecurityGate>);
    const notice = screen.getByTestId('browser-security-gate');
    expect(notice.getAttribute('role')).toBe('alert');
    expect(notice.textContent).toContain('HTTPS');
    // The controls are not rendered at all, not merely disabled.
    expect(screen.queryByText('controls')).toBeNull();
  });

  it('checks only what the surface asked for', () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('crypto', { randomUUID: () => 'x' }); // no subtle
    render(<BrowserSecurityGate features={['randomUUID']}><p>controls</p></BrowserSecurityGate>);
    expect(screen.getByText('controls')).toBeTruthy();

    cleanup();
    render(<BrowserSecurityGate features={['subtleCrypto']}><p>controls</p></BrowserSecurityGate>);
    expect(screen.getByTestId('browser-security-gate')).toBeTruthy();
    expect(screen.queryByText('controls')).toBeNull();
  });
});
