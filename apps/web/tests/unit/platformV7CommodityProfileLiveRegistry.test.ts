import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const exists = (path: string) => existsSync(join(process.cwd(), path));

const files = {
  client: 'components/crop-platform/CommodityProfileRegistryClient.tsx',
  clientCss: 'components/crop-platform/CommodityProfileRegistryClient.module.css',
  adapter: 'components/crop-platform/commodity-profile-live-adapter.ts',
  registry: 'components/crop-platform/CommodityProfileRegistryView.tsx',
  page: 'app/platform-v7/commodity-profiles/page.tsx',
  detail: 'app/platform-v7/commodity-profiles/[profileId]/page.tsx',
  readBff: 'app/api/platform-v7/commodity-profiles/[[...path]]/route.ts',
  staffReadBff: 'app/api/staff/commodity-profile-registry/[[...path]]/route.ts',
  commandBff: 'app/api/staff/commodity-profiles/[profileId]/commands/[actionId]/route.ts',
  routes: 'lib/platform-v7/routes.ts',
  designPolicy: 'lib/platform-v7/design-system-v8-route-policy.ts',
  accessPolicy: 'lib/platform-v7/cabinet-access-policy.ts',
} as const;

describe('PC-CROP-01B.4 strict live commodity registry', () => {
  for (const path of Object.values(files)) {
    it(`contains ${path}`, () => expect(exists(path)).toBe(true));
  }

  const client = read(files.client);
  const adapter = read(files.adapter);
  const page = read(files.page);
  const detail = read(files.detail);
  const readBff = read(files.readBff);
  const staffReadBff = read(files.staffReadBff);
  const commandBff = read(files.commandBff);
  const clientCss = read(files.clientCss);
  const routes = read(files.routes);
  const designPolicy = read(files.designPolicy);
  const accessPolicy = read(files.accessPolicy);

  it('loads only private BFF authority and never falls back to fixtures or browser persistence', () => {
    expect(client).toContain('/api/staff/commodity-profile-registry');
    expect(client).toContain('/api/platform-v7/commodity-profiles');
    expect(client).toContain('/versions?limit=100');
    expect(client).toContain("data-static-authority-fallback='false'");
    expect(`${client}\n${adapter}`).not.toMatch(/fixture|mockProfiles|demoProfiles/i);
    expect(`${client}\n${adapter}`).not.toContain('localStorage');
    expect(`${client}\n${adapter}`).not.toContain('sessionStorage');
    expect(`${client}\n${adapter}`).not.toContain('indexedDB');
    expect(page).toContain("data-authority='postgresql-private-bff'");
    expect(detail).toContain("data-authority='postgresql-private-bff'");
  });

  it('rejects incomplete server contracts and consumes only server primaryAction', () => {
    expect(adapter).toContain('return null');
    expect(adapter).toContain('if (!content || primaryAction === null) return null');
    expect(adapter).not.toContain("|| 'DRAFT'");
    expect(adapter).not.toContain("|| '—'");
    expect(adapter).not.toMatch(/QUALITY_\$\{/);
    expect(adapter).not.toMatch(/DOCUMENT_\$\{/);
    expect(adapter).not.toContain('profile.actions.filter');
    expect(adapter).toContain('profile.primaryAction');
    expect(clientCss).toContain('Deal/Lot pin authority is a later governed slice');
    expect(clientCss).toContain(':global([data-immutable] small)');
  });

  it('accepts versionless aggregates without manufacturing a renderable version', () => {
    expect(adapter).toContain('if (profile.selectedVersion === null) continue');
    expect(adapter).toContain('const selected = record(profile.selectedVersion)');
    expect(adapter).toContain('if (!selected) return null');
    expect(adapter).not.toContain('selectedVersion ??');
  });

  it('traverses every cursor under one bounded fail-closed request authority', () => {
    expect(client).toContain('collectCommodityProfilePages');
    expect(client).toContain('`?limit=100&cursor=${encodeURIComponent(cursor)}`');
    expect(client).toContain('staffAwareGet(path, controller.signal)');
    expect(client).toContain('window.setTimeout(() => controller.abort(), 12_000)');
    expect(adapter).toContain('COMMODITY_PROFILE_REGISTRY_MAX_PAGES = 20');
    expect(adapter).toContain('COMMODITY_PROFILE_REGISTRY_MAX_ITEMS = 2_000');
    expect(adapter).toContain('const seenCursors = new Set<string>()');
    expect(adapter).toContain('if (seenCursors.has(page.nextCursor)) return null');
    expect(adapter).toContain('if (observedItems > maxItems) return null');
    expect(adapter).toContain('JSON.stringify(existing) !== JSON.stringify(item)');
  });

  it('preserves authenticated and staff/JIT boundaries', () => {
    expect(readBff).toContain('Authorization: `Bearer ${accessToken}`');
    expect(readBff).not.toContain('X-Staff-Access-Session');
    expect(staffReadBff).toContain("'X-Staff-Access-Session': staffToken");
    expect(commandBff).toContain("'X-Staff-Access-Session': staffToken");
    expect(commandBff).toContain('assertCsrf(request)');
    expect(commandBff).toContain("'If-Match': ifMatch");
    expect(commandBff).not.toMatch(/\brole\s*:/);
    expect(commandBff).not.toMatch(/\btenantId\s*:/);
    expect(commandBff).not.toMatch(/\bhasJitAuthority\s*:/);
  });

  it('executes only confirmed server actions with CSRF, If-Match and immutable command identifiers', () => {
    expect(client).toContain('/api/staff/commodity-profiles/');
    expect(client).toContain("'X-CSRF-Token': csrfToken");
    expect(client).toContain("'If-Match': pending.etag");
    expect(client).toContain('commandToken(');
    expect(client).toContain('response.status === 409');
    expect(client).toContain('setReceipt(copy.receipt)');
    expect(client).toContain("role='dialog'");
    expect(page).toContain('CSRF_COOKIE');
    expect(detail).toContain('CSRF_COOKIE');
  });

  it('models loading, empty, forbidden, error, conflict, reconnecting and ready without replacing server truth', () => {
    for (const state of ['loading', 'ready', 'empty', 'error', 'forbidden', 'conflict', 'reconnecting']) {
      expect(client).toContain(`'${state}'`);
    }
    expect(client).toContain("window.addEventListener('online', reconnect)");
    expect(client).toContain('data-live-state={liveState}');
    expect(client).toContain("setLiveState('reconnecting')");
    expect(client).toContain('parseCommodityProfilePage');
    expect(client).toContain('parseCommodityProfileHistory');
  });

  it('registers the protected route in shell, design and authenticated access policies', () => {
    for (const source of [routes, designPolicy, accessPolicy]) {
      expect(source).toContain('/platform-v7/commodity-profiles');
    }
    for (const source of [page, detail]) {
      expect(source).toContain('robots: { index: false, follow: false, nocache: true }');
      expect(source).toContain('redirect(');
      expect(source).toContain('ACCESS_COOKIE');
    }
  });

  it('keeps mobile safe areas, focus visibility and hides unimplemented pin-count authority', () => {
    const pageCss = read('app/platform-v7/commodity-profiles/commodity-profiles.module.css');
    expect(pageCss).toContain('env(safe-area-inset-bottom)');
    expect(pageCss).toContain('@media (max-width: 430px)');
    expect(clientCss).toContain('@media (max-width: 640px)');
    expect(clientCss).toContain(':focus-visible');
    expect(client).toContain("data-pinning-authority='not-in-slice'");
  });
});
