import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('P0 production authentication fails closed', () => {
  it('never creates a local session when refresh cannot reach the API', () => {
    const route = read('apps/web/app/api/auth/refresh/route.ts');
    expect(route).toContain('fetch(`${API_URL}/auth/refresh`');
    expect(route).toContain('applyAuthenticatedSession');
    expect(route).toContain('AUTH_SERVICE_UNAVAILABLE');
    expect(route).toContain('assertCsrf(request)');
    expect(route).not.toContain('Fall through to demo refresh');
    expect(route).not.toContain('Buffer.from(JSON.stringify({ role, exp }))');
  });

  it('resolves /auth/me from the server API rather than a writable marker cookie', () => {
    const route = read('apps/web/app/api/auth/me/route.ts');
    expect(route).toContain('fetch(`${API_URL}/auth/me`');
    expect(route).toContain('Authorization: `Bearer ${accessToken}`');
    expect(route).not.toContain('SESSION_COOKIE');
    expect(route).not.toContain('decodeURIComponent(raw)');
  });

  it('revokes the server session on logout and clears every browser credential', () => {
    const route = read('apps/web/app/api/auth/logout/route.ts');
    const menu = read('apps/web/components/platform-v7/HeaderUtilityMenu.tsx');
    expect(route).toContain('fetch(`${API_URL}/auth/logout`');
    expect(route).toContain('clearAuthenticatedSession');
    expect(route).toContain('assertCsrf(request)');
    expect(menu).toContain("fetch('/api/auth/logout'");
    expect(menu).toContain('applyCsrfHeader()');
  });

  it('does not fall back to synthetic data for a real or unavailable backend', () => {
    const proxy = read('apps/web/app/api/proxy/[...path]/route.ts');
    expect(proxy).toContain('demoToken && demoLoginAllowed()');
    expect(proxy).toContain("return realBackendUnavailable('backend_unreachable')");
    expect(proxy).toContain("return realBackendUnavailable('api_url_missing')");
    expect(proxy).not.toContain('(!API_URL || demoToken)');
  });

  it('binds every protected cabinet to a signed role and live identity context', () => {
    const middleware = read('apps/web/middleware.ts');
    const layout = read('apps/web/app/platform-v7/layout.tsx');
    expect(middleware).toContain('readVerifiedCabinetSessionContext');
    expect(middleware).toContain("if (access.status === 'denied')");
    expect(layout).toContain('getAuthProfile()');
    expect(layout).toContain('context.membershipId !== profile.membershipId');
    expect(layout).toContain('context.organizationId !== profile.orgId');
    expect(layout).toContain('context.tenantId !== profile.tenantId');
  });

  it('rejects unknown roles instead of defaulting them to the operator cabinet', () => {
    const session = read('apps/web/lib/server/auth-session-response.ts');
    const functionBody = session.slice(
      session.indexOf('export function normalizeSurfaceRole'),
      session.indexOf('export function platformHome'),
    );
    expect(functionBody).toContain('return null;');
    expect(functionBody).not.toContain("return 'operator';");
  });
});
