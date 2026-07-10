import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const loginPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const loginRoute = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/api/auth/login/route.ts'), 'utf8');

describe('platform-v7 server role handoff', () => {
  it('does not read role from URL or expose a role picker', () => {
    expect(loginPage).not.toContain("new URLSearchParams(window.location.search).get('role')");
    expect(loginPage).not.toContain('useSearchParams');
    expect(loginPage).not.toContain('readRoleFromPublicEntry');
    expect(loginPage).not.toContain('?role=');
  });

  it('accepts only the server redirect after authentication', () => {
    expect(loginPage).toContain('payload.redirectTo');
    expect(loginPage).toContain("globalThis.location.assign(payload.redirectTo)");
    expect(loginPage).not.toContain('setRole(');
    expect(loginPage).not.toContain('sessionStorage');
    expect(loginPage).not.toContain("fetch('/api/platform-v7/cabinet-session'");
    expect(loginRoute).toContain('normalizeSurfaceRole(payload.user.role');
    expect(loginRoute).toContain('applyAuthenticatedSession');
  });
});
