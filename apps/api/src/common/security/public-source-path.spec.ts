import { publicPlatformSourcePath, isPublicPlatformSource } from './public-source-path';

/**
 * ASVS V1.5.3. The value below is judged here and resolved later by the
 * browser's URL parser. Everything asserted is about those two agreeing.
 */

const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);

/** What the browser will actually do with the href, for comparison. */
const asBrowserWouldResolve = (href: string) => new URL(href, 'https://app.example').pathname;

describe('public platform source path', () => {
  it('keeps an ordinary public path, canonicalized', () => {
    expect(publicPlatformSourcePath('/platform-v7')).toBe('/platform-v7');
    expect(publicPlatformSourcePath('/platform-v7/market/wheat')).toBe('/platform-v7/market/wheat');
    expect(publicPlatformSourcePath('  /platform-v7/market  ')).toBe('/platform-v7/market');
    expect(publicPlatformSourcePath('/platform-v7/market?a=1#b')).toBe('/platform-v7/market?a=1#b');
  });

  it('refuses a path outside the public contour', () => {
    expect(publicPlatformSourcePath('/staff')).toBeNull();
    expect(publicPlatformSourcePath('/platform-v7x/market')).toBeNull();
    expect(publicPlatformSourcePath('/')).toBeNull();
  });

  it('refuses the private areas inside the platform path', () => {
    for (const area of ['deals', 'staff', 'admin', 'operator', 'bank', 'compliance']) {
      expect(publicPlatformSourcePath(`/platform-v7/${area}`)).toBeNull();
      expect(publicPlatformSourcePath(`/platform-v7/${area}/42`)).toBeNull();
    }
    // A longer segment that merely starts with a private word stays public.
    expect(publicPlatformSourcePath('/platform-v7/deals-guide')).toBe('/platform-v7/deals-guide');
  });

  it('refuses anything that leaves this origin', () => {
    expect(publicPlatformSourcePath('https://evil.example/platform-v7')).toBeNull();
    expect(publicPlatformSourcePath('//evil.example/platform-v7')).toBeNull();
    expect(publicPlatformSourcePath('javascript:alert(1)')).toBeNull();
    expect(publicPlatformSourcePath('data:text/html,x')).toBeNull();
  });

  it('closes the divergence the string test had', () => {
    // The WHATWG URL parser strips tab, LF and CR before parsing, so each of
    // these carries no literal '..' for a string test and exactly '..' for the
    // parser. Every one of them was accepted before, and resolves outside.
    const bypasses = [
      `/platform-v7/.${TAB}./staff`,
      `/platform-v7/.${LF}./staff`,
      `/platform-v7/.${CR}./staff`,
      `/platform-v7/.${TAB}./admin/users`,
      `/platform-v7/a/.${TAB}./.${TAB}./staff`,
    ];
    for (const href of bypasses) {
      // The old string test: an anchored prefix, no '..', no '://', not private.
      const passedTheOldTest = /^\/platform-v7(?:\/|$)/u.test(href)
        && !href.includes('..')
        && !href.includes('://')
        && !/^\/platform-v7\/(?:deals|staff|admin)(?:\/|$)/u.test(href);
      expect(passedTheOldTest).toBe(true);
      // And the browser takes it straight out of the contour.
      expect(asBrowserWouldResolve(href).startsWith('/platform-v7')).toBe(false);
      // The parser-based check refuses it.
      expect(publicPlatformSourcePath(href)).toBeNull();
    }
  });

  it('agrees with the browser on every accepted value', () => {
    const accepted = [
      '/platform-v7',
      '/platform-v7/market/wheat',
      '/platform-v7/market?a=1',
      `/platform-v7/market${TAB}/wheat`,
      '/platform-v7/a/../market',
    ];
    for (const href of accepted) {
      const decided = publicPlatformSourcePath(href);
      if (decided === null) continue;
      // What we store is what the browser resolves - no second interpretation.
      expect(asBrowserWouldResolve(decided)).toBe(decided.split('?')[0].split('#')[0]);
      expect(decided.startsWith('/platform-v7')).toBe(true);
    }
  });

  it('normalizes traversal that stays inside the contour rather than echoing it', () => {
    expect(publicPlatformSourcePath('/platform-v7/a/../market')).toBe('/platform-v7/market');
    // Traversal that leaves the contour is refused, not normalized into it.
    expect(publicPlatformSourcePath('/platform-v7/../staff')).toBeNull();
  });

  it('is not a type assumption', () => {
    for (const value of [null, undefined, 42, {}, [], '']) {
      expect(publicPlatformSourcePath(value)).toBeNull();
      expect(isPublicPlatformSource(value)).toBe(false);
    }
  });
});
