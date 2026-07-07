import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 locale middleware sync', () => {
  it('persists lang query into the SSR locale cookie before render', () => {
    const source = read('apps/web/middleware.ts');

    expect(source).toContain('LOCALE_COOKIE');
    expect(source).toContain('VALID_LOCALES');
    expect(source).toContain('resolveLocaleFromQuery');
    expect(source).toContain("req.nextUrl.searchParams.get('lang')");
    expect(source).toContain('persistLocaleCookie');
    expect(source).toContain("response.cookies.set(LOCALE_COOKIE, locale");
  });

  it('disables cache on language-switched platform responses', () => {
    const source = read('apps/web/middleware.ts');

    expect(source).toContain('x-pc-locale');
    expect(source).toContain("cache-control', 'no-store");
    expect(source).toContain('privateModeEnabled && protectedPath');
  });
});
