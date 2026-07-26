import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPublicBrandRuntimeScript,
  normalizePublicBrandText,
  PUBLIC_ASCII_HOST,
  PUBLIC_BRAND_HOST,
  PUBLIC_BRAND_ORIGIN,
  publicBrandUrl,
  toPublicBrandUrl,
} from '../../lib/platform-v7/public-brand-domain';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public brand domain authority', () => {
  it('normalizes technical IDN serialization to the Cyrillic brand URL', () => {
    expect(
      toPublicBrandUrl(`https://${PUBLIC_ASCII_HOST}/platform-v7?lang=ru#deal`),
    ).toBe(`${PUBLIC_BRAND_ORIGIN}/platform-v7?lang=ru#deal`);
    expect(
      normalizePublicBrandText(`Открыть https://${PUBLIC_ASCII_HOST}/platform-v7`),
    ).toBe(`Открыть ${PUBLIC_BRAND_ORIGIN}/platform-v7`);
    expect(publicBrandUrl('platform-v7')).toBe(`${PUBLIC_BRAND_ORIGIN}/platform-v7`);
  });

  it('does not rewrite an unrelated external host', () => {
    expect(toPublicBrandUrl('https://example.com/platform-v7')).toBe('https://example.com/platform-v7');
  });

  it('enforces branded address, DOM metadata, clipboard and Web Share surfaces', () => {
    const script = buildPublicBrandRuntimeScript();
    expect(script).toContain('window.history.replaceState');
    expect(script).toContain('MutationObserver');
    expect(script).toContain('navigator.clipboard');
    expect(script).toContain('navigator.share');
    expect(script).toContain(PUBLIC_BRAND_HOST);
  });

  it('keeps the technical host out of central user-facing metadata sources', () => {
    for (const path of [
      'app/layout.tsx',
      'app/platform-v7/head.tsx',
      'components/platform-v7/PlatformV7StructuredData.tsx',
    ]) {
      expect(read(path)).not.toContain(PUBLIC_ASCII_HOST);
      expect(read(path)).toContain('public-brand-domain');
    }
  });
});
