import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function json(relativePath: string) {
  return JSON.parse(read(relativePath)) as Record<string, unknown>;
}

function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe('platform-v7 public SEO', () => {
  const layout = read('apps/web/app/(platform-public)/platform-v7/layout.tsx');
  const loginLayout = read('apps/web/app/(platform-public)/platform-v7/login/layout.tsx');
  const forgotLayout = read('apps/web/app/(platform-public)/platform-v7/forgot-password/layout.tsx');
  const resetLayout = read('apps/web/app/(platform-public)/platform-v7/reset-password/layout.tsx');

  it('keeps RU, EN and ZH SEO catalogs structurally identical and non-empty', () => {
    const ru = json('apps/web/messages/public-seo/ru.json');
    const baseline = leafKeys(ru);
    for (const locale of ['ru', 'en', 'zh']) {
      const catalog = json(`apps/web/messages/public-seo/${locale}.json`);
      expect(leafKeys(catalog)).toEqual(baseline);
      for (const key of baseline) {
        const value = key.split('.').reduce<unknown>((node, part) => {
          if (!node || typeof node !== 'object') return undefined;
          return (node as Record<string, unknown>)[part];
        }, catalog);
        expect(String(value || '').trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('renders canonical, hreflang, Open Graph and Twitter metadata on the server', () => {
    expect(layout).toContain('export async function generateMetadata');
    expect(layout).toContain("'x-default': '/platform-v7'");
    expect(layout).toContain("en: '/platform-v7?lang=en'");
    expect(layout).toContain("zh: '/platform-v7?lang=zh'");
    expect(layout).toContain('openGraph:');
    expect(layout).toContain('twitter:');
    expect(layout).toContain("type: 'website'");
    expect(layout).toContain("card: 'summary'");
  });

  it('publishes restrained structured data without unconfirmed integrations or scale claims', () => {
    expect(layout).toContain("'@type': 'Organization'");
    expect(layout).toContain("'@type': 'WebApplication'");
    expect(layout).toContain("applicationCategory: 'BusinessApplication'");
    for (const forbidden of ['Sber', 'Сбер', 'ФГИС', 'ЭДО', 'live', 'production-ready', 'тысяч сделок']) {
      expect(layout).not.toContain(forbidden);
    }
  });

  it('keeps all authentication and recovery pages noindex with self canonicals', () => {
    const cases = [
      [loginLayout, '/platform-v7/login'],
      [forgotLayout, '/platform-v7/forgot-password'],
      [resetLayout, '/platform-v7/reset-password'],
    ] as const;
    for (const [source, canonical] of cases) {
      expect(source).toContain('index: false');
      expect(source).toContain('follow: false');
      expect(source).toContain(`canonical: '${canonical}'`);
    }
  });

  it('merges SEO messages without replacing the declarative public entry catalog', () => {
    const request = read('apps/web/i18n/request.ts');
    expect(request).toContain('../messages/public-seo/${locale}.json');
    expect(request).toContain('...publicSeoMessages');
    expect(request).toContain('...publicEntryMessages.publicEntry');
    expect(request).toContain('...publicSystemMessages.publicEntry');
  });
});
