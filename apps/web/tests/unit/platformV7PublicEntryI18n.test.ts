import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const locales = ['ru', 'en', 'zh'] as const;

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readCatalog(locale: (typeof locales)[number]) {
  return JSON.parse(read(`apps/web/messages/public-entry/${locale}.json`)) as Record<string, unknown>;
}

function collectLeafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => collectLeafKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe('platform-v7 declarative public entry i18n', () => {
  it('keeps RU, EN and ZH catalogs structurally identical', () => {
    const baseline = collectLeafKeys(readCatalog('ru'));

    for (const locale of locales) {
      expect(collectLeafKeys(readCatalog(locale))).toEqual(baseline);
    }
  });

  it('keeps every translated leaf non-empty', () => {
    for (const locale of locales) {
      const catalog = readCatalog(locale);
      const leaves = collectLeafKeys(catalog);

      for (const key of leaves) {
        const value = key.split('.').reduce<unknown>((node, part) => {
          if (!node || typeof node !== 'object') return undefined;
          return (node as Record<string, unknown>)[part];
        }, catalog);

        expect(typeof value, `${locale}:${key}`).toBe('string');
        expect(String(value).trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('renders login copy from next-intl rather than page-local dictionaries', () => {
    const source = read('apps/web/app/platform-v7/login/page.tsx');

    expect(source).toContain("useTranslations('publicEntry.login')");
    expect(source).not.toContain('const copy =');
    expect(source).not.toContain('useLocale');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('B2B Deal Execution');
  });

  it('loads the public entry catalog on the server request boundary', () => {
    const requestConfig = read('apps/web/i18n/request.ts');

    expect(requestConfig).toContain("../messages/public-entry/${locale}.json");
    expect(requestConfig).toContain('...publicEntryMessages');
  });
});
