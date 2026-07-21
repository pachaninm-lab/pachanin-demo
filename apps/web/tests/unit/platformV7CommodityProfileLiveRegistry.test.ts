import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const exists = (path: string) => existsSync(join(process.cwd(), path));

const files = {
  live: 'components/crop-platform/LiveCommodityProfileRegistry.tsx',
  liveCss: 'components/crop-platform/LiveCommodityProfileRegistry.module.css',
  registry: 'components/crop-platform/CommodityProfileRegistryView.tsx',
  page: 'app/platform-v7/commodity-profiles/page.tsx',
  detail: 'app/platform-v7/commodity-profiles/[profileId]/page.tsx',
  readBff: 'app/api/platform-v7/commodity-profiles/[[...path]]/route.ts',
  staffReadBff: 'app/api/staff/commodity-profile-registry/[[...path]]/route.ts',
  commandBff: 'app/api/staff/commodity-profiles/[profileId]/commands/[actionId]/route.ts',
} as const;

describe('PC-CROP-01B.4 live commodity registry', () => {
  for (const path of Object.values(files)) {
    it(`contains ${path}`, () => expect(exists(path)).toBe(true));
  }

  const live = read(files.live);
  const page = read(files.page);
  const detail = read(files.detail);
  const readBff = read(files.readBff);
  const staffReadBff = read(files.staffReadBff);
  const commandBff = read(files.commandBff);
  const css = read(files.liveCss);

  it('loads only server authority and never falls back to fixtures or browser persistence', () => {
    expect(live).toContain("fetchRegistry('/api/staff/commodity-profile-registry?limit=100')");
    expect(live).toContain("fetchRegistry('/api/platform-v7/commodity-profiles?limit=100')");
    expect(live).not.toMatch(/fixture|mockProfiles|demoProfiles/i);
    expect(live).not.toContain('localStorage');
    expect(live).not.toContain('indexedDB');
    expect(page).toContain("data-authority='postgresql-private-bff'");
    expect(detail).toContain("data-authority='postgresql-private-bff'");
  });

  it('preserves server-derived identity and staff/JIT boundaries', () => {
    expect(readBff).toContain('Authorization: `Bearer ${accessToken}`');
    expect(readBff).not.toContain('X-Staff-Access-Session');
    expect(staffReadBff).toContain("'X-Staff-Access-Session': staffToken");
    expect(commandBff).toContain("'X-Staff-Access-Session': staffToken");
    expect(commandBff).toContain('assertCsrf(request)');
    expect(commandBff).toContain("'If-Match': ifMatch");
    for (const forbidden of ['role:', 'tenantId:', 'hasJitAuthority:']) {
      expect(commandBff).not.toContain(forbidden);
    }
  });

  it('models loading, empty, forbidden, error, conflict and reconnecting without replacing server truth', () => {
    for (const state of ['loading', 'ready', 'empty', 'error', 'forbidden', 'conflict', 'reconnecting']) {
      expect(live).toContain(`'${state}'`);
    }
    expect(live).toContain("window.addEventListener('online', reconnect)");
    expect(live).toContain("data-live-registry-state={kind}");
    expect(live).toContain("setKind('conflict')");
    expect(live).toContain('Your reason is preserved');
  });

  it('uses RU, EN and ZH presentation copy while authority remains server-side', () => {
    expect(live).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(live).toContain("ru: {");
    expect(live).toContain("en: {");
    expect(live).toContain("zh: {");
    expect(live).toContain('actionFor(profile, locale)');
    expect(live).toContain('profile.actions.filter');
  });

  it('supports mobile safe areas, keyboard focus and reduced motion', () => {
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(live).toContain("role='dialog'");
    expect(live).toContain("aria-modal='true'");
  });

  it('keeps private pages non-indexable and redirects missing sessions to login', () => {
    for (const source of [page, detail]) {
      expect(source).toContain('robots: { index: false, follow: false, nocache: true }');
      expect(source).toContain('redirect(');
      expect(source).toContain('ACCESS_COOKIE');
    }
  });
});
