import { describe, expect, it } from 'vitest';
import robots from '../../app/robots';
import sitemap from '../../app/sitemap';

function values(input: string | string[] | undefined): string[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return url.split('?')[0].replace(/\/$/, '') || '/';
  }
}

describe('platform-v7 robots and sitemap', () => {
  it('keeps the canonical public landing in the sitemap and auth surfaces out', async () => {
    const entries = await Promise.resolve(sitemap());
    const paths = entries.map((entry) => pathOf(String(entry.url)));

    expect(paths).toContain('/platform-v7');
    for (const forbidden of [
      '/platform-v7/login',
      '/platform-v7/forgot-password',
      '/platform-v7/reset-password',
      '/platform-v7/mfa',
    ]) {
      expect(paths).not.toContain(forbidden);
    }
  });

  it('does not block the landing before crawlers can read canonical metadata', async () => {
    const value = await Promise.resolve(robots());
    const rules = Array.isArray(value.rules) ? value.rules : [value.rules];
    const disallowed = rules.flatMap((rule) => values(rule.disallow));

    expect(disallowed).not.toContain('/platform-v7');
    expect(disallowed).not.toContain('/platform-v7/');
    expect(value.sitemap).toBeTruthy();
  });
});
