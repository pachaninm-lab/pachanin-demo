import { describe, expect, it } from 'vitest';
import { displayHost, outboundDestination } from '../../lib/gekta/outbound-destination';

/**
 * ASVS V3.7.3. A citation is a destination the assistant chose. Leaving for it
 * must be something the person decides, after being told where they are going.
 */

const PAGE = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';

describe('outbound destination', () => {
  it('marks a different origin as outbound and names its host', () => {
    const destination = outboundDestination('https://rosstat.gov.ru/report/7', PAGE);
    expect(destination).not.toBeNull();
    expect(destination?.outbound).toBe(true);
    expect(destination?.host).toBe('rosstat.gov.ru');
    expect(destination?.href).toBe('https://rosstat.gov.ru/report/7');
  });

  it('does not warn about a link that stays on this origin', () => {
    expect(outboundDestination(`${PAGE}/platform-v7/market`, PAGE)?.outbound).toBe(false);
    expect(outboundDestination('/platform-v7/market', PAGE)?.outbound).toBe(false);
  });

  it('treats a different port or scheme on the same host as outbound', () => {
    // Same-origin is origin, not hostname - the browser draws it that way too.
    expect(outboundDestination('http://xn----8sbjf4befbjgs9b.xn--p1ai/x', PAGE)?.outbound).toBe(true);
    expect(outboundDestination('https://xn----8sbjf4befbjgs9b.xn--p1ai:8443/x', PAGE)?.outbound).toBe(true);
  });

  it('refuses a scheme that is not a web destination', () => {
    for (const uri of ['javascript:alert(1)', 'data:text/html,x', 'blob:https://a/b', 'file:///etc/passwd', 'mailto:a@b.c']) {
      expect(outboundDestination(uri, PAGE)).toBeNull();
    }
  });

  it('refuses anything that is not a resolvable URI', () => {
    for (const uri of ['', '   ', 'http://', null, undefined, 42, {}]) {
      expect(outboundDestination(uri, PAGE)).toBeNull();
    }
  });

  it('shows the host the browser resolved, punycode and all', () => {
    // A decoded homograph reads like the site it imitates; the ASCII form
    // cannot. The person is told something true rather than something friendly.
    const destination = outboundDestination('https://xn--80ak6aa92e.com/login', PAGE);
    expect(destination?.host).toBe('xn--80ak6aa92e.com');
    expect(destination?.outbound).toBe(true);
    expect(displayHost(new URL('https://xn--80ak6aa92e.com'))).toBe('xn--80ak6aa92e.com');
  });

  it('does not let credentials in the URI disguise the host', () => {
    const destination = outboundDestination('https://xn----8sbjf4befbjgs9b.xn--p1ai@evil.example/x', PAGE);
    expect(destination?.host).toBe('evil.example');
    expect(destination?.outbound).toBe(true);
  });
});
