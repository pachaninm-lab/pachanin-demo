// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BROWSER_SECURITY_REFUSAL,
  BrowserSecurityUnsupportedError,
  isBrowserSecurityUnsupported,
  missingBrowserSecurityFeatures,
  secureRandomId,
} from '../../lib/browser-security-capabilities';

/**
 * ASVS V3.7.5. Web Crypto is [SecureContext], so over plain HTTP randomUUID and
 * subtle are absent. What matters is that the absence produces one documented
 * outcome and never a weaker identifier.
 */

const browser = (over: Record<string, unknown> = {}) => ({
  isSecureContext: true,
  crypto: { randomUUID: () => '11111111-2222-3333-4444-555555555555', subtle: {} },
  ...over,
});

describe('detecting what the browser is missing', () => {
  it('finds nothing missing in a secure context with Web Crypto', () => {
    expect(missingBrowserSecurityFeatures(browser(), ['secureContext', 'randomUUID', 'subtleCrypto'])).toEqual([]);
  });

  it('names an insecure context', () => {
    expect(missingBrowserSecurityFeatures(browser({ isSecureContext: false }), ['secureContext'])).toEqual(['secureContext']);
    // Absent, not merely false - an older browser has no such property.
    expect(missingBrowserSecurityFeatures({ crypto: {} } as never, ['secureContext'])).toEqual(['secureContext']);
  });

  it('names the missing crypto primitives separately', () => {
    expect(missingBrowserSecurityFeatures(browser({ crypto: { subtle: {} } }), ['randomUUID', 'subtleCrypto'])).toEqual(['randomUUID']);
    expect(missingBrowserSecurityFeatures(browser({ crypto: { randomUUID: () => 'x' } }), ['randomUUID', 'subtleCrypto'])).toEqual(['subtleCrypto']);
    expect(missingBrowserSecurityFeatures(browser({ crypto: undefined }), ['randomUUID', 'subtleCrypto'])).toEqual(['randomUUID', 'subtleCrypto']);
  });

  it('answers "nothing missing" where there is no browser to ask', () => {
    // Server-side and first-paint: the check runs after mount, and rendering a
    // refusal during the server pass would be a hydration mismatch, not a control.
    expect(missingBrowserSecurityFeatures(undefined, ['secureContext', 'randomUUID'])).toEqual([]);
  });
});

describe('secureRandomId', () => {
  it('returns the browser value, with the prefix spelled as the call site spelled it', () => {
    expect(secureRandomId('reg', browser())).toBe('reg-11111111-2222-3333-4444-555555555555');
    expect(secureRandomId('', browser())).toBe('11111111-2222-3333-4444-555555555555');
    // A prefix that already ends in a separator is used as written.
    expect(secureRandomId('public-org-connect:', browser())).toBe('public-org-connect:11111111-2222-3333-4444-555555555555');
  });

  it('refuses rather than returning a weaker identifier', () => {
    for (const scope of [browser({ crypto: {} }), browser({ crypto: undefined })]) {
      expect(() => secureRandomId('reg', scope)).toThrow(BrowserSecurityUnsupportedError);
    }
  });

  it('never returns anything derived from the clock or Math.random', () => {
    let thrown: unknown = null;
    try {
      secureRandomId('reg', browser({ crypto: {} }));
    } catch (cause) {
      thrown = cause;
    }
    expect(isBrowserSecurityUnsupported(thrown)).toBe(true);
    expect((thrown as BrowserSecurityUnsupportedError).missing).toEqual(['randomUUID']);
  });

  it('is recognizable to a caller that has other failures to tell apart', () => {
    expect(isBrowserSecurityUnsupported(new Error('network'))).toBe(false);
    expect(isBrowserSecurityUnsupported(null)).toBe(false);
    expect(isBrowserSecurityUnsupported(new BrowserSecurityUnsupportedError(['randomUUID']))).toBe(true);
  });

  it('has a refusal message that names the remedy', () => {
    expect(BROWSER_SECURITY_REFUSAL).toContain('HTTPS');
  });
});
