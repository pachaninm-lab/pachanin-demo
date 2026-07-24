import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canRoleAccessCabinet } from '@/lib/platform-v7/cabinet-access-policy';
import { isDesignSystemV8Route } from '@/lib/platform-v7/design-system-v8-route-policy';
import { PLATFORM_V7_INTEGRATIONS_ROUTE } from '@/lib/platform-v7/routes';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative: string) => fs.existsSync(path.join(root, relative));

describe('Platform V7 Integration Control Tower vertical', () => {
  it('provides protected list/detail pages and private BFF routes', () => {
    expect(exists('app/platform-v7/integrations/page.tsx')).toBe(true);
    expect(exists('app/platform-v7/integrations/[adapterCode]/page.tsx')).toBe(true);
    expect(exists('app/api/platform-v7/integrations/[[...path]]/route.ts')).toBe(true);
    expect(exists('app/api/staff/integration-control-tower/[[...path]]/route.ts')).toBe(true);
    expect(exists('app/api/staff/integrations/inbox/[entryId]/commands/redrive/route.ts')).toBe(true);
    expect(exists('app/api/staff/integrations/[adapterCode]/commands/reconcile/route.ts')).toBe(true);
    const page = read('app/platform-v7/integrations/page.tsx');
    expect(page).toContain('ACCESS_COOKIE');
    expect(page).toContain("redirect('/platform-v7/login");
    expect(page).toContain("data-authority='postgresql-private-bff'");
    expect(page).toContain("data-static-authority-fallback='false'");
  });

  it('keeps all browser reads behind authenticated no-store proxies', () => {
    const readBff = read('app/api/platform-v7/integrations/[[...path]]/route.ts');
    const staffBff = read('app/api/staff/integration-control-tower/[[...path]]/route.ts');
    for (const source of [readBff, staffBff]) {
      expect(source).toContain('ACCESS_COOKIE');
      expect(source).toContain("cache: 'no-store'");
      expect(source).toContain("redirect: 'manual'");
      expect(source).toContain('AbortSignal.timeout(8_000)');
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
    }
    expect(staffBff).toContain('pc_staff_access_token');
    expect(staffBff).toContain('X-Staff-Access-Session');
  });

  it('requires CSRF, staff JIT and If-Match for write proxies', () => {
    const proxy = read('app/api/staff/integrations/_command-proxy.ts');
    expect(proxy).toContain('assertCsrf(request)');
    expect(proxy).toContain('pc_staff_access_token');
    expect(proxy).toContain("request.headers.get('if-match')");
    expect(proxy).toContain("'If-Match': ifMatch");
    expect(proxy).toContain('MAX_BODY_BYTES');
    expect(proxy).toContain("redirect: 'manual'");
    expect(proxy).not.toContain('role:');
    expect(proxy).not.toContain('tenantId:');
  });

  it('does not provide fixtures, local authority or fake live status', () => {
    const client = read('components/crop-platform/IntegrationControlTowerClient.tsx');
    const adapter = read('components/crop-platform/integration-control-tower-live-adapter.ts');
    expect(client).toContain("data-static-authority-fallback='false'");
    expect(client).not.toContain('localStorage');
    expect(client).not.toContain('sessionStorage');
    expect(client).not.toContain('fixture');
    expect(adapter).not.toContain('MOCK_OK');
    expect(adapter).not.toContain('LIVE_SIMULATED');
    expect(adapter).toContain('CONFIRMED_LIVE');
    expect(adapter).toContain('ADAPTER_READY');
    expect(adapter).toContain('requiresConfirmation: true');
  });

  it('renders explicit loading, empty, forbidden, error, conflict, stale, reconnecting and degraded states', () => {
    const client = read('components/crop-platform/IntegrationControlTowerClient.tsx');
    for (const state of ['loading', 'empty', 'forbidden', 'error', 'conflict', 'stale', 'reconnecting', 'degraded']) {
      expect(client).toContain(`'${state}'`);
    }
    expect(client).toContain("role='dialog'");
    expect(client).toContain("aria-modal='true'");
  });

  it('limits cabinet access to operator, compliance and executive', () => {
    expect(PLATFORM_V7_INTEGRATIONS_ROUTE).toBe('/platform-v7/integrations');
    expect(canRoleAccessCabinet('operator', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(true);
    expect(canRoleAccessCabinet('compliance', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(true);
    expect(canRoleAccessCabinet('executive', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(true);
    expect(canRoleAccessCabinet('buyer', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(false);
    expect(canRoleAccessCabinet('seller', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(false);
    expect(isDesignSystemV8Route(PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(true);
    expect(isDesignSystemV8Route('/platform-v7/integrations/FGIS_ZERNO')).toBe(true);
  });

  it('has responsive, focus-visible and reduced-motion boundaries', () => {
    const css = read('components/crop-platform/IntegrationControlTowerClient.module.css');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('safe-area-inset-bottom');
  });
});
