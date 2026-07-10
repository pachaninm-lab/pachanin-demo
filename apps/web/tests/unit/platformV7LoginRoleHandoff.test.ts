import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const loginPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const loginFlow = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicAuthLoginFlow.tsx'), 'utf8');
const loginRoute = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/api/auth/login/route.ts'), 'utf8');

describe('platform-v7 server role handoff', () => {
  it('does not read role from URL or expose a role picker', () => {
    for (const source of [loginPage, loginFlow]) {
      expect(source).not.toContain("new URLSearchParams(window.location.search).get('role')");
      expect(source).not.toContain('useSearchParams');
      expect(source).not.toContain('readRoleFromPublicEntry');
      expect(source).not.toContain('?role=');
    }
  });

  it('accepts only the server redirect after authentication', () => {
    expect(loginFlow).toContain('payload.redirectTo');
    expect(loginFlow).toContain("globalThis.location.assign(payload.redirectTo)");
    expect(loginFlow).not.toContain('setRole(');
    expect(loginFlow).not.toContain('sessionStorage');
    expect(loginFlow).not.toContain("fetch('/api/platform-v7/cabinet-session'");
    expect(loginRoute).toContain('normalizeSurfaceRole(payload.user.role');
    expect(loginRoute).toContain('applyAuthenticatedSession');
  });
});
