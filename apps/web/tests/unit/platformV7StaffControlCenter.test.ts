import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { staffControlCenterMessages } from '../../i18n/staff-control-center-messages';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>).flatMap(stringValues);
}

const page = source('apps/web/app/platform-v7/staff/page.tsx');
const proxy = source('apps/web/app/api/staff/[...path]/route.ts');
const client = source('apps/web/components/platform-v7/staff/StaffControlCenter.tsx');
const entry = source('apps/web/components/platform-v7/StaffControlCenterEntry.tsx');
const css = source('apps/web/components/platform-v7/staff/StaffControlCenter.module.css');
const requestService = source('apps/api/src/modules/staff-access/staff-access-request.service.ts');

describe('platform-v7 Staff Control Center authority boundary', () => {
  it('verifies the real server session and never derives staff authority from URL or local storage', () => {
    expect(page).toContain("cookies().get(ACCESS_COOKIE)");
    expect(page).toContain("fetch(`${API_URL}/auth/me`");
    expect(page).toContain("redirect('/platform-v7/login?next=%2Fplatform-v7%2Fstaff')");
    expect(page).not.toContain('localStorage');
    expect(page).not.toContain('pc-role');
    expect(client).not.toContain('localStorage');
    expect(client).not.toContain('roleFrom');
  });

  it('keeps the staff proxy allowlisted, CSRF-protected and token-safe', () => {
    expect(proxy).toContain('const READ_PATHS = [');
    expect(proxy).toContain('const WRITE_PATHS = [');
    expect(proxy).toContain("if (!path || !isAllowed(method, path))");
    expect(proxy).toContain("code: 'STAFF_ROUTE_NOT_ALLOWED'");
    expect(proxy).toContain('const csrf = assertCsrf(request)');
    expect(proxy).toContain("code: 'CSRF_REJECTED'");
    expect(proxy).toContain('delete safePayload.accessToken');
    expect(proxy).toContain("httpOnly: true");
    expect(proxy).toContain("sameSite: 'strict'");
    expect(proxy).toContain("path: '/api/staff'");
    expect(proxy).not.toContain('accessToken: token');
  });

  it('revalidates opaque staff-session metadata against persisted server state', () => {
    expect(proxy).toContain('async function listOwnSessions');
    expect(proxy).toContain('function persistedMetadata');
    expect(proxy).toContain("row.id === metadata.accessSessionId");
    expect(proxy).toContain('cleanupActivatedSession');
    expect(proxy).toContain("code: 'STAFF_SESSION_INVALID_RESPONSE'");
  });

  it('does not expose Staff Control Center navigation to an ordinary user', () => {
    expect(entry).toContain("fetch('/api/staff/assignments/me'");
    expect(entry).toContain("if (!visible || !portalTarget) return null");
    expect(entry).toContain("['ACTIVE', 'ELIGIBLE'].includes");
    expect(entry).not.toContain('localStorage');
  });

  it('requires an active exact permission before organization, review and audit data are loaded', () => {
    expect(client).toContain("activePermissions.includes('organization:list')");
    expect(client).toContain("activePermissions.includes('staff-request:read')");
    expect(client).toContain("activePermissions.includes('staff-session:read')");
    expect(client).toContain("activePermissions.includes('audit:read')");
    expect(proxy).toContain("...(staffAccessToken ? { 'x-staff-access-session': staffAccessToken } : {})");
  });

  it('keeps VIEW_AS read-only and exact organization, role and optional deal scoped', () => {
    expect(client).toContain("mode === 'VIEW_AS'");
    expect(client).toContain('targetOrganizationId: organizationId');
    expect(client).toContain('{ targetRole }');
    expect(client).toContain('targetDealId.trim()');
    expect(client).toContain('READ ONLY');
    expect(client).toContain('copy.cabinet.warning');
    expect(client).not.toContain("payment:release");
    expect(client).not.toContain("document:sign");
  });

  it('keeps an approved own request activatable after page refresh', () => {
    expect(requestService).toContain('latest_grant.id AS grant_id');
    expect(requestService).toContain('latest_grant.status AS grant_status');
    expect(requestService).toContain('latest_grant.expires_at AS grant_expires_at');
    expect(client).toContain('item.grant_id');
    expect(client).toContain("['GRANTED', 'ACTIVE'].includes");
  });

  it('keeps RU, EN and ZH dictionaries structurally identical and non-empty', () => {
    expect(keys(staffControlCenterMessages.en)).toEqual(keys(staffControlCenterMessages.ru));
    expect(keys(staffControlCenterMessages.zh)).toEqual(keys(staffControlCenterMessages.ru));
    for (const locale of ['ru', 'en', 'zh'] as const) {
      expect(stringValues(staffControlCenterMessages[locale]).length).toBeGreaterThan(100);
      expect(stringValues(staffControlCenterMessages[locale]).every((value) => value.trim().length > 0)).toBe(true);
    }
  });

  it('has an explicit 320–360 px mobile layout without a fixed desktop width', () => {
    expect(css).toContain('@media (max-width: 360px)');
    expect(css).toContain('overflow-x: clip');
    expect(css).toContain('grid-template-columns: 1fr');
    expect(css).not.toMatch(/(?:^|[;{\s])width:\s*(?:[4-9]\d\d|\d{4,})px/m);
    expect(css).not.toContain('min-width: 1000px');
  });
});
