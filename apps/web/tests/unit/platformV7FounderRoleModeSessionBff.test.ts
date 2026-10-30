import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  const root = process.cwd().endsWith('/apps/web')
    ? resolve(process.cwd(), '..', '..')
    : process.cwd();
  return readFileSync(resolve(root, path), 'utf8');
}

const route = source('apps/web/app/api/staff/[...path]/route.ts');

describe('Founder role-mode canonical session BFF', () => {
  it('admits only the exact Founder session read through the existing /api/staff boundary', () => {
    expect(route).toContain('/^founder\\/role-mode\\/session$/');
    expect(route).toContain("const roleModeSessionRead = method === 'GET' && path === 'founder/role-mode/session';");
    expect(route).toContain("const STAFF_ACCESS_COOKIE = 'pc_staff_access_token'");
    expect(route).toContain('request.cookies.get(ACCESS_COOKIE)');
    expect(route).toContain('request.cookies.get(STAFF_ACCESS_COOKIE)');
    expect(route).toContain("'x-staff-access-session': staffAccessToken");
    expect(route).toContain('Authorization: `Bearer ${accessToken}`');
    expect(route).toContain('const targetUrl = `${API_BASE_URL}/staff/${path}');
    expect(route).toContain('requiresCanonicalControlHost(request)');
    expect(route).toContain("redirect: 'manual'");
    expect(route).toContain("cache: 'no-store'");
    expect(route).toContain('delete safePayload.accessToken');
  });

  it('keeps Founder session transport read-only and rejects a missing delegated credential', () => {
    const writePaths = route.split('const WRITE_PATHS = [')[1]?.split('] as const;')[0] || '';
    expect(writePaths).not.toContain('founder\\/role-mode\\/session');
    expect(route).toContain("if (roleModeSessionRead && !staffAccessToken)");
    expect(route).toContain("code: 'ROLE_MODE_SESSION_INACTIVE'");
    expect(route).toContain("code: roleModeSessionRead ? 'ROLE_MODE_SESSION_UNAVAILABLE' : 'STAFF_SERVICE_UNAVAILABLE'");
    expect(route).toContain("code: 'UPSTREAM_REDIRECT_REJECTED'");
  });

  it('does not accept browser-selected role, tenant, organization or canonical path authority', () => {
    expect(route).not.toContain("searchParams.get('role')");
    expect(route).not.toContain("searchParams.get('tenantId')");
    expect(route).not.toContain("searchParams.get('organizationId')");
    expect(route).not.toContain("searchParams.get('canonicalPath')");
  });
});