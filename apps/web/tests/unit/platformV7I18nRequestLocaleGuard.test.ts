import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 i18n request locale precedence', () => {
  it('uses RU for a clean request and only accepts an explicit middleware locale header', () => {
    const source = read('apps/web/i18n/request.ts');

    expect(source).toContain("import { headers } from 'next/headers';");
    expect(source).toContain("LOCALE_HEADER = 'x-pc-locale'");
    expect(source).toContain('let locale = DEFAULT_LOCALE');
    expect(source).toContain('headerStore.get(LOCALE_HEADER)');
    expect(source).toContain('if (isAppLocale(headerLocale)) locale = headerLocale');
    expect(source).not.toContain('cookies()');
    expect(source).not.toContain('LOCALE_COOKIE');
  });

  it('does not restore a stale locale cookie in the owner control center', () => {
    const source = read('apps/web/app/platform-v7/staff/page.tsx');

    expect(source).toContain("headers().get('x-pc-locale')");
    expect(source).toContain('isAppLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE');
    expect(source).not.toContain('cookieLocale');
    expect(source).not.toContain('LOCALE_COOKIE');
  });
});
