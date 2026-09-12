import { describe, expect, it } from 'vitest';

import { safeRedirectDestination, sameOriginDestination } from '@/lib/safe-redirect';

/**
 * ASVS 5.0 V3.7.2.
 *
 * Three demo-login routes guarded their redirect with `to.startsWith('/')` and
 * then built `new URL(to, request.url)`. Seven of the thirteen vectors below
 * defeat that guard and resolve to another origin. The routes are gated by
 * demoLoginAllowed(), which is false whenever NODE_ENV is production, so this was
 * never reachable there - but the guard was wrong, and a fourth copy of it sat in
 * a page that is not gated at all.
 */

const BASE = 'https://app.example.ru/api/auth/demo';

const OFF_ORIGIN = [
  ['protocol-relative', '//evil.example/pwn'],
  ['backslash authority', '/\\evil.example/pwn'],
  ['triple slash', '///evil.example'],
  ['double backslash', '\\\\evil.example'],
  ['absolute https', 'https://evil.example'],
  ['absolute http', 'http://evil.example'],
  ['tab the browser strips', '/\t/evil.example'],
  ['newline the browser strips', '/\n//evil.example'],
  ['carriage return', '/\r//evil.example'],
  ['javascript scheme', 'javascript:alert(1)'],
  ['data scheme', 'data:text/html,x'],
  ['lookalike host', '//app.example.ru.evil.example'],
  ['userinfo confusion', 'https://app.example.ru@evil.example'],
] as const;

describe('same-origin redirect destinations', () => {
  it.each(OFF_ORIGIN)('rejects a destination that leaves the origin: %s', (_label, candidate) => {
    expect(sameOriginDestination(candidate, BASE)).toBeNull();
  });

  it.each(OFF_ORIGIN)('the old startsWith guard would have allowed or mangled: %s', (_label, candidate) => {
    const legacy = candidate.startsWith('/') ? candidate : '/';
    const resolved = new URL(legacy, BASE);
    const escaped = resolved.origin !== 'https://app.example.ru';
    const neutralised = legacy === '/';
    expect(escaped || neutralised).toBe(true);
  });

  it('keeps a legitimate path, its query and its fragment', () => {
    expect(sameOriginDestination('/lots', BASE)).toBe('/lots');
    expect(sameOriginDestination('/platform-v7/control-tower?a=1#f', BASE)).toBe('/platform-v7/control-tower?a=1#f');
    expect(sameOriginDestination('/', BASE)).toBe('/');
  });

  it('returns a root-relative string, never an origin, so a caller cannot re-resolve it off-site', () => {
    const destination = sameOriginDestination('https://app.example.ru/lots?x=1', BASE);
    expect(destination).toBe('/lots?x=1');
    expect(destination?.startsWith('http')).toBe(false);
  });

  /**
   * Not redundant with the origin comparison, which is what it looks like at
   * first. Node's URL parser strips tab, newline and carriage return from a path
   * and hands back a SAME-ORIGIN result that has been silently rewritten:
   * new URL('/foo\tbar', base).pathname is '/foobar'. The origin check is
   * satisfied and the caller redirects somewhere nobody asked for. A browser may
   * strip a different set, which is exactly why these are refused rather than
   * normalised here.
   */
  it('refuses a destination containing characters a parser would strip, rather than rewriting it', () => {
    expect(new URL('/foo\tbar', BASE).pathname).toBe('/foobar');
    expect(sameOriginDestination('/foo\tbar', BASE)).toBeNull();
    expect(sameOriginDestination('/foo\nbar', BASE)).toBeNull();
    expect(sameOriginDestination('/foo\rbar', BASE)).toBeNull();
    expect(safeRedirectDestination('/lo\tts', BASE, '/lab')).toBe('/lab');
  });

  it('rejects what is not a string, and what is empty', () => {
    expect(sameOriginDestination(undefined, BASE)).toBeNull();
    expect(sameOriginDestination(null, BASE)).toBeNull();
    expect(sameOriginDestination(42, BASE)).toBeNull();
    expect(sameOriginDestination('   ', BASE)).toBeNull();
  });

  it('falls back rather than throwing when the base itself is unusable', () => {
    expect(sameOriginDestination('/lots', 'not a url')).toBeNull();
    expect(safeRedirectDestination('/lots', 'not a url')).toBe('/');
  });

  it('resolves the fallback by the same rule, so a bad fallback cannot reintroduce the hole', () => {
    expect(safeRedirectDestination('//evil.example', BASE, '//also-evil.example')).toBe('/');
    expect(safeRedirectDestination('//evil.example', BASE, '/lab')).toBe('/lab');
    expect(safeRedirectDestination('/lots', BASE, '/lab')).toBe('/lots');
  });
});
