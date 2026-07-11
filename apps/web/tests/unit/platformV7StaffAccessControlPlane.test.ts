import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const currentDir = process.cwd();
const webRoot = currentDir.endsWith(path.join('apps', 'web'))
  ? currentDir
  : path.join(currentDir, 'apps', 'web');
const read = (relativePath: string) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const proxy = read('lib/server/staff/staff-api-channel-proxy.ts');
const platformLayout = read('app/platform-v7/layout.tsx');
const page = read('app/platform-v7/staff/page.tsx');
const client = read('components/platform-v7/staff/StaffControlCenterClient.tsx');
const viewAs = read('components/platform-v7/staff/StaffViewAsClient.tsx');
const messages = read('i18n/staff-messages.ts');
const css = read('styles/platform-v7-staff.css');

describe('platform-v7 industrial Staff Access Control Plane UI', () => {
  it('keeps opaque staff grants in separate HttpOnly control and delegated cookies', () => {
    expect(proxy).toContain('pc_staff_control_session');
    expect(proxy).toContain('pc_staff_delegated_session');
    expect(proxy).toContain('httpOnly: true');
    expect(proxy).toContain("sameSite: 'strict'");
    expect(proxy).toContain('delete sanitized.accessToken');
    expect(proxy).not.toContain('localStorage');
    expect(proxy).not.toContain('sessionStorage');
  });

  it('fails closed without API URL, access JWT or same-origin mutation', () => {
    expect(proxy).toContain('STAFF_API_UNAVAILABLE');
    expect(proxy).toContain('AUTH_REQUIRED');
    expect(proxy).toContain('CSRF_ORIGIN_REJECTED');
    expect(proxy).toContain('REQUEST_TOO_LARGE');
    expect(proxy).toContain("redirect: 'manual'");
  });

  it('does not accept business role, tenant or staff authority from a URL', () => {
    expect(page).not.toContain('searchParams');
    expect(client).not.toContain('localStorage');
    expect(client).not.toContain('sessionStorage');
    expect(client).not.toContain('?role=');
    expect(client).toContain("accessMode: 'CONTROL_PLANE'");
    expect(client).toContain("accessMode: 'VIEW_AS'");
  });

  it('keeps the staff realm outside the business-role cabinet shell', () => {
    expect(platformLayout).toContain("const STAFF_PATH_PREFIX = '/platform-v7/staff'");
    expect(platformLayout).toContain('isStaffPath(pathname)');
    expect(platformLayout).toContain('pathname.startsWith(`${STAFF_PATH_PREFIX}/`)');
  });

  it('keeps VIEW_AS read-only, explicit and attributable to the real actor', () => {
    expect(viewAs).toContain("mode: 'READ_ONLY_VIEW_AS'");
    expect(viewAs).toContain('actorUserId');
    expect(viewAs).toContain('accessSessionId');
    expect(viewAs).toContain('payment:release');
    expect(viewAs).toContain('document:sign');
    expect(viewAs).toContain('lab:finalize');
    expect(viewAs).toContain('acceptance:sign');
    expect(viewAs).toContain('arbitration:decide');
    expect(viewAs).toContain("router.replace('/platform-v7/staff')");
  });

  it('provides the full internal workspace rather than fake counters', () => {
    expect(client).toContain("requestJson<Organization[]>('control', 'organizations')");
    expect(client).toContain("'access/requests/review'");
    expect(client).toContain("'access/sessions/review'");
    expect(client).toContain("'audit/events?limit=50'");
    expect(client).toContain("'break-glass/active'");
    expect(client).not.toContain('Math.random');
    expect(client).not.toContain('demo');
  });

  it('has complete RU EN ZH staff copy and mobile accessibility guards', () => {
    expect(messages).toContain('ru: {');
    expect(messages).toContain('en: {');
    expect(messages).toContain('zh: {');
    expect(messages).toContain('Фактический сотрудник');
    expect(messages).toContain('Actual staff actor');
    expect(messages).toContain('实际员工');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });
});
