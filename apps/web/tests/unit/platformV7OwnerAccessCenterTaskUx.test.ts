import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ownerAccessCenterMessages } from '../../i18n/owner-access-center-messages';
import { assertCsrf, assertSameOriginIfPresent } from '../../lib/server-request-security';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const page = read('apps/web/app/platform-v7/staff/page.tsx');
const entry = read('apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx');
const directCenter = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.tsx');
const directRoute = read('apps/web/app/platform-v7/staff/open-cabinet/route.ts');
const submitRoute = read('apps/web/app/platform-v7/staff/open-cabinet/submit/route.ts');
const prepareRoute = read('apps/web/app/platform-v7/staff/prepare/route.ts');
const directCss = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.module.css');
const center = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV2.tsx');
const catalog = read('apps/web/lib/platform-v7/staff-access-task-catalog.ts');
const deferred = read('apps/web/components/platform-v7/staff/StaffOperationalWorkspacesDeferred.tsx');

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe('platform-v7 owner access center task UX', () => {
  it('provides all twelve owner cabinet transitions', () => {
    expect(page).toContain('<OwnerAccessCenter');
    expect(entry).toContain("export { OwnerAccessCenter } from './OwnerAccessCenterV3'");
    for (const role of ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive']) {
      expect(directCenter).toContain(`role: '${role}'`);
    }
    expect(directCenter).toContain('action="/platform-v7/staff/open-cabinet/submit"');
    expect(directCenter).toContain('name="organizationId"');
    expect(directCenter).not.toContain('Рабочий тикет');
    expect(directCenter).not.toContain('Причина доступа');
  });

  it('repairs missing or stale CSRF before every owner transition', () => {
    expect(page).toContain("verification.status === 'verified' && !csrfToken");
    expect(page).toContain("redirect('/platform-v7/staff/prepare')");
    expect(prepareRoute).toContain("request.nextUrl.searchParams.get('format') === 'json'");
    expect(prepareRoute).toContain("NextResponse.json({ ok: true, csrfToken: token })");
    expect(prepareRoute).toContain('response.cookies.set(CSRF_COOKIE');
    expect(directCenter).toContain("fetch('/platform-v7/staff/prepare?format=json'");
    expect(directCenter).toContain('let freshToken = await refreshCsrf(controller.signal)');
    expect(directCenter).toContain("result.payload?.code === 'CSRF_REJECTED'");
  });

  it('accepts the public custom-domain origin behind the Netlify proxy and a matching legacy duplicate cookie', () => {
    const headers = new Headers({
      origin: 'https://xn----8sbjf4befbjgs9b.xn--p1ai',
      'x-forwarded-host': 'xn----8sbjf4befbjgs9b.xn--p1ai',
      'x-forwarded-proto': 'https',
      cookie: 'pc_csrf_token=stale; pc_csrf_token=fresh',
      'x-csrf-token': 'fresh',
    });
    const request = new Request('https://main--vermillion-kitsune-0e7b97.netlify.app/platform-v7/staff/open-cabinet', {
      method: 'POST',
      headers,
    });
    expect(assertSameOriginIfPresent(request)).toEqual({ ok: true });
    expect(assertCsrf(request)).toEqual({ ok: true });
  });

  it('still rejects an unrelated cross-site origin', () => {
    const request = new Request('https://main--vermillion-kitsune-0e7b97.netlify.app/platform-v7/staff/open-cabinet', {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        'x-forwarded-host': 'xn----8sbjf4befbjgs9b.xn--p1ai',
        'x-forwarded-proto': 'https',
        cookie: 'pc_csrf_token=fresh',
        'x-csrf-token': 'fresh',
      },
    });
    expect(assertSameOriginIfPresent(request)).toEqual({ ok: false, reason: 'origin_mismatch' });
    expect(assertCsrf(request)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('uses observable authenticated JSON transition with native fallback', () => {
    expect(directCenter).toContain("fetch('/platform-v7/staff/open-cabinet'");
    expect(directCenter).toContain("'X-CSRF-Token': token");
    expect(directCenter).toContain("credentials: 'same-origin'");
    expect(directCenter).toContain('onSubmit={(event) => openCabinet');
    expect(directCenter).toContain('busyRole === item.role ? text.opening : text.open');
    expect(directCenter).toContain('role="alert"');
    expect(directCenter).toContain('window.location.replace(result.payload.redirectTo)');
    expect(submitRoute).toContain("import { POST as issueCabinetSession } from '../route'");
  });

  it('creates the client role marker only after server success', () => {
    const failureGate = directCenter.indexOf('if (!result.response.ok');
    const roleMarker = directCenter.indexOf('window.sessionStorage.setItem');
    const navigation = directCenter.indexOf('window.location.replace(result.payload.redirectTo)');
    expect(failureGate).toBeGreaterThan(-1);
    expect(roleMarker).toBeGreaterThan(failureGate);
    expect(navigation).toBeGreaterThan(roleMarker);
    expect(directCenter).toContain('Navigation must not stop');
  });

  it('keeps owner authority and cabinet session server verified', () => {
    expect(directRoute).toContain('assertCsrf(request)');
    expect(directRoute).toContain('assertSameOriginIfPresent(request)');
    expect(directRoute).toContain('claims.owner !== true');
    expect(directRoute).toContain("item.role === 'PLATFORM_OWNER' && item.status === 'ACTIVE'");
    expect(directRoute).toContain('signCabinetSession(parsed.role, secret');
    expect(directRoute).toContain('response.cookies.set(CABINET_SESSION_COOKIE');
    expect(directRoute).not.toContain('response.cookies.set(ACCESS_COOKIE');
  });

  it('retains the protected advanced staff surface', () => {
    expect(directCenter).toContain('<OwnerAccessCenterV2 {...baseProps} />');
    expect(page).toContain('accessCatalog={staffAccessTaskCatalog()}');
    expect(catalog).toContain("id: 'view_cabinet'");
    expect(center).toContain('permissions: selectedPermissions');
    expect(deferred).toContain("fetch('/api/staff/session-context'");
    expect(deferred).toContain('if (!ready || !active) return null');
  });

  it('remains mobile-first and multilingual', () => {
    expect(directCss).toContain('@media (max-width: 520px)');
    expect(directCss).toContain('grid-template-columns: 1fr');
    expect(directCss).toContain('min-height: 54px');
    expect(keys(ownerAccessCenterMessages.en)).toEqual(keys(ownerAccessCenterMessages.ru));
    expect(keys(ownerAccessCenterMessages.zh)).toEqual(keys(ownerAccessCenterMessages.ru));
  });
});
