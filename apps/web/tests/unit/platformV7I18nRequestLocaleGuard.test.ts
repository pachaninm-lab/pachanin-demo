import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 i18n request locale precedence', () => {
  it('prefers the middleware locale header before cookie fallback', () => {
    const source = read('apps/web/i18n/request.ts');

    expect(source).toContain("headers } from 'next/headers'");
    expect(source).toContain("LOCALE_HEADER = 'x-pc-locale'");
    expect(source).toContain('headerStore.get(LOCALE_HEADER)');
    expect(source).toContain('isAppLocale(headerLocale)');
    expect(source).toContain('cookieStore.get(LOCALE_COOKIE)');
  });
});
