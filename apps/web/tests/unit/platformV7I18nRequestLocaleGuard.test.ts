import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 i18n request locale precedence', () => {
  it('treats a valid middleware locale header as authoritative even when it is the default RU locale', () => {
    const source = read('apps/web/i18n/request.ts');

    expect(source).toContain("headers } from 'next/headers'");
    expect(source).toContain("LOCALE_HEADER = 'x-pc-locale'");
    expect(source).toContain('let headerLocaleResolved = false');
    expect(source).toContain('headerStore.get(LOCALE_HEADER)');
    expect(source).toContain('if (isAppLocale(headerLocale)) {');
    expect(source).toContain('headerLocaleResolved = true');
    expect(source).toContain('if (!headerLocaleResolved) {');
    expect(source).toContain('cookieStore.get(LOCALE_COOKIE)');
    expect(source).not.toContain('if (locale === DEFAULT_LOCALE)');
  });
});
