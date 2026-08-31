import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ANALYTICS_PATHS,
  SESSION_REPLAY_ENABLED,
  analyticsAllowedForPath,
  normalizeAnalyticsPath,
} from '../../lib/analytics/analytics-boundary';

const WEB_ROOT = join(__dirname, '..', '..');
const read = (relative: string) => readFileSync(join(WEB_ROOT, relative), 'utf8');

/**
 * Каждое семейство приватных или чувствительных путей перечислено явно.
 * Список специально длиннее, чем нужно для покрытия кода: он документирует,
 * какие поверхности обязаны остаться без аналитики.
 */
const MUST_BE_DENIED = [
  '/platform-v7', '/platform-v7/cabinet', '/platform-v7/deals/deal-1',
  '/platform-v7/documents', '/platform-v7/payments', '/platform-v7/settlement',
  '/platform-v7/admin', '/platform-v7/staff', '/platform-v7/operator-cockpit',
  '/platform-v7/login', '/platform-v7/forgot-password',
  '/platform-v7r', '/platform-v7r/deals',
  '/pc-public-entry/platform-v7', '/pc-public-entry/platform-v7/login',
  '/login', '/auth/register', '/auth/reset-password', '/auth/mfa-recovery',
  '/gekta', '/gekta/chat', '/assistant', '/lots', '/staff',
  '/api/auth/login', '/api/platform-v7/cabinet-session',
];

describe('public analytics boundary', () => {
  it('permits only the paths on the allowlist', () => {
    for (const allowed of PUBLIC_ANALYTICS_PATHS) {
      expect(analyticsAllowedForPath(allowed)).toBe(true);
    }
  });

  it('denies every private or credential-bearing surface', () => {
    for (const path of MUST_BE_DENIED) {
      expect({ path, allowed: analyticsAllowedForPath(path) }).toEqual({ path, allowed: false });
    }
  });

  it('fails closed on anything it cannot place', () => {
    for (const path of ['', '/unknown-section', 'platform-v7', null, undefined]) {
      expect(analyticsAllowedForPath(path as string)).toBe(false);
    }
  });

  it('is not fooled by a trailing slash or a locale prefix', () => {
    expect(analyticsAllowedForPath('/legal/')).toBe(true);
    expect(analyticsAllowedForPath('/ru/legal')).toBe(true);
    expect(analyticsAllowedForPath('/en/')).toBe(true);
    expect(analyticsAllowedForPath('/ru/platform-v7')).toBe(false);
    expect(normalizeAnalyticsPath('/ru/legal/')).toBe('/legal');
  });

  it('does not let a private path masquerade as an allowlisted prefix', () => {
    expect(analyticsAllowedForPath('/legal-internal')).toBe(false);
    expect(analyticsAllowedForPath('/trustee')).toBe(false);
    expect(analyticsAllowedForPath('/rolesX')).toBe(false);
  });

  it('keeps session replay off', () => {
    expect(SESSION_REPLAY_ENABLED).toBe(false);
  });
});

describe('analytics markup is no longer inherited by every page', () => {
  it('leaves no analytics snippet in the root layout', () => {
    const layout = read('app/layout.tsx');
    expect(layout).not.toContain('mc.yandex.ru');
    expect(layout).not.toContain('webvisor');
    expect(layout).toContain('<PublicAnalytics');
  });

  it('renders the tracking pixel only from the boundary component', () => {
    // The pixel is an image, so CSP does not stop it. While it lived in the
    // root layout a JavaScript-disabled client reported cabinet page URLs to
    // a third party.
    const component = read('components/analytics/PublicAnalytics.tsx');
    expect(component).toContain('mc.yandex.ru/watch/');
    expect(component).toContain('analyticsAllowedForPath');
  });

  it('enables no session replay anywhere in the web application', () => {
    const component = read('components/analytics/PublicAnalytics.tsx');
    expect(component).not.toContain('webvisor:true');
    expect(component).toContain('webvisor:${SESSION_REPLAY_ENABLED}');
  });

  it('stops the framework config from disagreeing with the served CSP', () => {
    // The middleware CSP is the one actually served and it does not allow the
    // analytics host. While next.config.js also named it, the repository
    // stated two intentions and the safe one won only by ordering.
    expect(read('next.config.js')).not.toContain('mc.yandex.ru');
  });
});
