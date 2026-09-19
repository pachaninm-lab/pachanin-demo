import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicAnalytics } from '../../components/analytics/PublicAnalytics';
import {
  PUBLIC_ANALYTICS_PATHS,
  SESSION_REPLAY_ENABLED,
  analyticsAllowedForPath,
  isEphemeralPublicAnalyticsId,
  normalizeAnalyticsPath,
  posthogPublicAnalyticsAllowedForPath,
  sanitizePublicProductAnalyticsDetail,
} from '../../lib/analytics/analytics-boundary';

const WEB_ROOT = join(__dirname, '..', '..');
const read = (relative: string) => readFileSync(join(WEB_ROOT, relative), 'utf8');

vi.mock('next/navigation', () => ({
  usePathname: () => '/platform-v7',
}));

afterEach(() => cleanup());

/**
 * Каждое семейство приватных или чувствительных путей перечислено явно.
 * Список специально длиннее, чем нужно для покрытия кода: он документирует,
 * какие поверхности обязаны остаться без исторической Yandex-аналитики.
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

const POSTHOG_MUST_BE_DENIED = [
  '/platform-v7/cabinet',
  '/platform-v7/register',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/platform-v7/how-it-works',
  '/platform-v7/ai-in-action',
  '/platform-v7/contact',
  '/platform-v7/staff',
  '/platform-v7/deals/deal-1',
  '/pc-public-entry/platform-v7',
  '/gekta',
  '/assistant',
  '/api/platform-v7/cabinet-session',
];

describe('public analytics boundary', () => {
  it('permits only the paths on the historical allowlist', () => {
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

describe('PostHog public product analytics boundary', () => {
  it('adds only exact /platform-v7 to the existing public analytics surface', () => {
    expect(posthogPublicAnalyticsAllowedForPath('/platform-v7')).toBe(true);
    expect(posthogPublicAnalyticsAllowedForPath('/platform-v7/')).toBe(true);
    expect(posthogPublicAnalyticsAllowedForPath('/ru/platform-v7')).toBe(true);
    expect(posthogPublicAnalyticsAllowedForPath('/en/platform-v7/')).toBe(true);
    expect(posthogPublicAnalyticsAllowedForPath('/legal')).toBe(true);
    expect(posthogPublicAnalyticsAllowedForPath('/trust/status')).toBe(true);
  });

  it('does not turn exact /platform-v7 into a prefix permission', () => {
    for (const path of POSTHOG_MUST_BE_DENIED) {
      expect({ path, allowed: posthogPublicAnalyticsAllowedForPath(path) }).toEqual({ path, allowed: false });
    }
  });

  it('fails closed for malformed and unknown PostHog routes', () => {
    for (const path of ['', 'platform-v7', '/unknown-section', null, undefined]) {
      expect(posthogPublicAnalyticsAllowedForPath(path as string)).toBe(false);
    }
  });

  it('keeps only allowlisted event names and flat bounded properties', () => {
    expect(sanitizePublicProductAnalyticsDetail({
      name: 'registration_open',
      locale: 'ru',
      viewport_group: 'mobile',
      role: 'buyer',
      source: 'home_v5_hero',
      step: 2,
      replay: false,
      email: 'person@example.com',
      phone: '+79990000000',
      href: 'https://example.com/private?q=1',
      note: 'free text from a user',
      nested: { tenant: 'secret' },
    })).toEqual({
      name: 'registration_open',
      properties: {
        locale: 'ru',
        viewport_group: 'mobile',
        role: 'buyer',
        source: 'home_v5_hero',
        step: 2,
        replay: false,
      },
    });
  });

  it('binds state-like properties to canonical enums rather than token shape', () => {
    expect(sanitizePublicProductAnalyticsDetail({
      name: 'stage_selected',
      perspective: 'customer-123',
      role: 'unknown-role',
      lens: 'private',
      stage: 'DL-9102',
      scenario: 'custom',
      risk: '79990000000',
      entry_variant: 'custom-entry',
      source_event: 'arbitrary_event',
      mode: 'free_form',
      source: 'public_v5_quick_journey',
      option: 'buyer',
    })).toEqual({
      name: 'stage_selected',
      properties: {
        source: 'public_v5_quick_journey',
      },
    });
  });

  it('accepts finite intent options and rejects role-shaped or arbitrary options', () => {
    for (const option of ['sell', 'buy', 'execute', 'control', 'progress', 'evidence', 'payment', 'deviation']) {
      expect(sanitizePublicProductAnalyticsDetail({ name: 'stage_selected', option }))
        .toEqual({ name: 'stage_selected', properties: { option } });
    }
    for (const option of ['buyer', 'seller', 'customer_7700123456', 'https://example.com', 'free text']) {
      expect(sanitizePublicProductAnalyticsDetail({ name: 'stage_selected', option }))
        .toEqual({ name: 'stage_selected', properties: {} });
    }
  });

  it('keeps useful producer metadata only through bounded values', () => {
    expect(sanitizePublicProductAnalyticsDetail({
      name: 'home_role_entry_open',
      role_entry: 'finance',
      stage: 'settlement',
      lens: 'money',
    })).toEqual({
      name: 'home_role_entry_open',
      properties: { role_entry: 'finance', stage: 'settlement', lens: 'money' },
    });
    expect(sanitizePublicProductAnalyticsDetail({
      name: 'document_open',
      document_index: '2',
      source: 'how_it_works',
    })).toEqual({
      name: 'document_open',
      properties: { document_index: 2, source: 'how_it_works' },
    });
    expect(sanitizePublicProductAnalyticsDetail({
      name: 'connect_cta_click',
      source: 'public_v5_complete',
    })).toEqual({
      name: 'connect_cta_click',
      properties: { source: 'public_v5_complete' },
    });
  });

  it('has no generic token-shaped property escape hatch', () => {
    expect(sanitizePublicProductAnalyticsDetail({
      name: 'stage_selected',
      source: 'customer_7700123456',
      option: 'person_79990000000',
      role_entry: 'organization_7700123456',
      document_index: '99',
      variant: 'anything',
      journey_mode: 'anything',
      intent: 'anything',
    })).toEqual({ name: 'stage_selected', properties: {} });
  });

  it('drops invalid values rather than broadening the schema', () => {
    expect(sanitizePublicProductAnalyticsDetail({
      name: 'stage_selected',
      locale: 'de',
      viewport_group: 'watch',
      stage: 'contains spaces',
      source: 'safe_source',
      step: 999,
      replay: 'false',
    })).toEqual({
      name: 'stage_selected',
      properties: {},
    });
    expect(sanitizePublicProductAnalyticsDetail({ name: 'arbitrary_event', locale: 'ru' })).toBeNull();
    expect(sanitizePublicProductAnalyticsDetail('registration_open')).toBeNull();
  });

  it('accepts only ephemeral tab-scoped identifiers', () => {
    expect(isEphemeralPublicAnalyticsId('tab-mfj8zr2-1a2b')).toBe(true);
    expect(isEphemeralPublicAnalyticsId('customer-123')).toBe(false);
    expect(isEphemeralPublicAnalyticsId('tab-short-x')).toBe(false);
    expect(isEphemeralPublicAnalyticsId('tab-mfj8zr2-user@example.com')).toBe(false);
  });
});

describe('analytics markup is no longer inherited by every page', () => {
  it('leaves no Yandex analytics snippet in the root layout', () => {
    const layout = read('app/layout.tsx');
    expect(layout).not.toContain('mc.yandex.ru');
    expect(layout).not.toContain('webvisor');
    expect(layout).toContain('<PublicAnalytics');
  });

  it('renders the Yandex tracking pixel only from the boundary component', () => {
    // The pixel is an image, so CSP does not stop it. While it lived in the
    // root layout a JavaScript-disabled client reported cabinet page URLs to
    // a third party.
    const component = read('components/analytics/PublicAnalytics.tsx');
    expect(component).toContain('mc.yandex.ru/watch/');
    expect(component).toContain('analyticsAllowedForPath');
  });

  it('enables no session replay anywhere in the analytics bridge', () => {
    const component = read('components/analytics/PublicAnalytics.tsx');
    expect(component).not.toContain('webvisor:true');
    expect(component).toContain('webvisor:${SESSION_REPLAY_ENABLED}');
    expect(component).not.toContain('session recording');
  });

  it('keeps PostHog third-party details out of browser code', () => {
    const component = read('components/analytics/PublicAnalytics.tsx');
    expect(component).toContain('sessionStorage');
    expect(component).toContain('public_page_view');
    expect(component).toContain('PUBLIC_PRODUCT_ANALYTICS_DOM_EVENTS');
    expect(component).toContain('capturePublicProductAnalytics');
    expect(component).not.toContain('localStorage');
    expect(component).not.toContain('posthog.com');
    expect(component).not.toContain('api_key');
    expect(component).not.toContain('POSTHOG_PROJECT_REFERENCE');
    expect(component).not.toContain('crypto.randomUUID');
    expect(component).not.toContain('Math.random');
  });

  it('keeps PostHog capture server-side, anonymous and on a fixed host allowlist', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toContain("us: 'https://us.i.posthog.com'");
    expect(layout).toContain("eu: 'https://eu.i.posthog.com'");
    expect(layout).toContain('/i/v0/e/');
    expect(layout).toContain('POSTHOG_PROJECT_REFERENCE');
    expect(layout).toContain('POSTHOG_INGEST_REGION');
    expect(layout).toContain("requestHeaders.get('x-pc-pathname')");
    expect(layout).toContain("requestHeaders.get('sec-fetch-site')");
    expect(layout).toContain("if (fetchSite !== 'same-origin') return;");
    expect(layout).not.toContain("if (fetchSite && fetchSite !== 'same-origin') return;");
    expect(layout).toContain("'$process_person_profile': false");
    expect(layout).toContain("'$geoip_disable': true");
    expect(layout).toContain('AbortSignal.timeout(2000)');
    expect(layout).not.toContain('NEXT_PUBLIC_POSTHOG');
    expect(layout).not.toContain('Math.random');
    expect(layout).not.toContain('randomUUID');
  });

  it('stops the framework config from disagreeing with the served CSP', () => {
    // The middleware CSP is the one actually served and it does not allow the
    // analytics host. While next.config.js also named it, the repository
    // stated two intentions and the safe one won only by ordering.
    expect(read('next.config.js')).not.toContain('mc.yandex.ru');
  });
});

describe('PostHog public analytics capture lifecycle', () => {
  it('emits one page view across action-reference rerenders and same-route remounts', async () => {
    const firstAction = vi.fn(async () => undefined);
    const rendered = render(React.createElement(PublicAnalytics, {
      locale: 'ru',
      capturePublicProductAnalyticsAction: firstAction,
    }));

    await waitFor(() => expect(firstAction).toHaveBeenCalledTimes(1));
    expect(firstAction.mock.calls[0]?.[0]).toMatchObject({
      name: 'public_page_view',
      properties: { locale: 'ru', source: 'public_analytics_bridge' },
    });

    const replacementAction = vi.fn(async () => undefined);
    rendered.rerender(React.createElement(PublicAnalytics, {
      locale: 'ru',
      capturePublicProductAnalyticsAction: replacementAction,
    }));

    await act(async () => Promise.resolve());
    expect(firstAction).toHaveBeenCalledTimes(1);
    expect(replacementAction).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
        detail: { name: 'deal_demo_open', source: 'home_preview' },
      }));
    });
    await waitFor(() => expect(replacementAction).toHaveBeenCalledTimes(1));
    expect(replacementAction.mock.calls[0]?.[0]).toMatchObject({ name: 'deal_demo_open' });

    rendered.unmount();
    const remountedAction = vi.fn(async () => undefined);
    render(React.createElement(PublicAnalytics, {
      locale: 'ru',
      capturePublicProductAnalyticsAction: remountedAction,
    }));
    await act(async () => Promise.resolve());
    expect(remountedAction).not.toHaveBeenCalled();
  });
});
