import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  const root = process.cwd().endsWith('/apps/web')
    ? resolve(process.cwd(), '..', '..')
    : process.cwd();
  return readFileSync(resolve(root, path), 'utf8');
}

const route = source('apps/web/app/api/staff/founder/role-mode/session/route.ts');

describe('Founder role-mode canonical session BFF', () => {
  it('keeps the opaque staff credential inside the /api/staff server boundary', () => {
    expect(route).toContain("const STAFF_ACCESS_COOKIE = 'pc_staff_access_token'");
    expect(route).toContain('request.cookies.get(ACCESS_COOKIE)');
    expect(route).toContain('request.cookies.get(STAFF_ACCESS_COOKIE)');
    expect(route).toContain("'X-Staff-Access-Session': staffAccessToken");
    expect(route).toContain('Authorization: `Bearer ${accessToken}`');
    expect(route).toContain('fetch(`${API_BASE_URL}/staff/founder/role-mode/session`');
    expect(route).toContain('requiresCanonicalControlHost(request)');
    expect(route).toContain("redirect: 'manual'");
    expect(route).toContain("cache: 'no-store'");
    expect(route).toContain('delete safePayload.accessToken');
  });

  it('does not accept browser-selected role, tenant, organization or canonical path authority', () => {
    expect(route).not.toContain("searchParams.get('role')");
    expect(route).not.toContain("searchParams.get('tenantId')");
    expect(route).not.toContain("searchParams.get('organizationId')");
    expect(route).not.toContain("searchParams.get('canonicalPath')");
    expect(route).not.toContain('export async function POST');
    expect(route).not.toContain('effectiveRole:');
    expect(route).not.toContain('effectiveTenantId:');
  });

  it('fails closed when either authenticated owner context or delegated staff session is missing', () => {
    expect(route).toContain("code: 'UNAUTHENTICATED'");
    expect(route).toContain("code: 'ROLE_MODE_SESSION_INACTIVE'");
    expect(route).toContain("code: 'STAFF_SERVICE_UNAVAILABLE'");
    expect(route).toContain("code: 'ROLE_MODE_SESSION_UNAVAILABLE'");
    expect(route).toContain("code: 'UPSTREAM_REDIRECT_REJECTED'");
  });
});
