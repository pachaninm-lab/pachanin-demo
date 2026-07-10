import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const locales = ['ru', 'en', 'zh'] as const;
const PUBLIC_ROOT = 'apps/web/app/(platform-public)/platform-v7';

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readCatalog(directory: string, locale: (typeof locales)[number]) {
  return JSON.parse(read(`apps/web/messages/${directory}/${locale}.json`)) as Record<string, unknown>;
}

function collectLeafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => collectLeafKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe('platform-v7 declarative public entry i18n', () => {
  for (const directory of ['public-entry', 'public-system']) {
    it(`keeps RU, EN and ZH ${directory} catalogs structurally identical`, () => {
      const baseline = collectLeafKeys(readCatalog(directory, 'ru'));
      for (const locale of locales) {
        expect(collectLeafKeys(readCatalog(directory, locale))).toEqual(baseline);
      }
    });

    it(`keeps every ${directory} translated leaf non-empty`, () => {
      for (const locale of locales) {
        const catalog = readCatalog(directory, locale);
        for (const key of collectLeafKeys(catalog)) {
          const value = key.split('.').reduce<unknown>((node, part) => {
            if (!node || typeof node !== 'object') return undefined;
            return (node as Record<string, unknown>)[part];
          }, catalog);
          expect(typeof value, `${directory}:${locale}:${key}`).toBe('string');
          expect(String(value).trim().length, `${directory}:${locale}:${key}`).toBeGreaterThan(0);
        }
      }
    });
  }

  it('renders login copy from next-intl rather than page-local dictionaries', () => {
    const source = read(`${PUBLIC_ROOT}/login/page.tsx`);
    expect(source).toContain("useTranslations('publicEntry.login')");
    expect(source).not.toContain('const copy =');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('B2B Deal Execution');
  });

  it('loads both public catalogs on the server request boundary', () => {
    const requestConfig = read('apps/web/i18n/request.ts');
    expect(requestConfig).toContain('../messages/public-entry/${locale}.json');
    expect(requestConfig).toContain('../messages/public-system/${locale}.json');
    expect(requestConfig).toContain('...publicEntryMessages.publicEntry');
    expect(requestConfig).toContain('...publicSystemMessages.publicEntry');
  });
});
