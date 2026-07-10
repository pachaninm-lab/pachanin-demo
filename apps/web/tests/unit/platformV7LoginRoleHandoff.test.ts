import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const landing = readFileSync(path.join(root, 'apps/web/app/(platform-public)/platform-v7/page.tsx'), 'utf8');
const login = readFileSync(path.join(root, 'apps/web/app/(platform-public)/platform-v7/login/page.tsx'), 'utf8');
const loginRoute = readFileSync(path.join(root, 'apps/web/app/api/auth/login/route.ts'), 'utf8');

function count(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe('platform-v7 server-authoritative login handoff', () => {
  it('uses one role-neutral login destination from the public surface', () => {
    expect(count(landing, "href='/platform-v7/login'")).toBe(1);
    expect(landing).not.toContain('/platform-v7/login?role=');
    expect(landing).not.toContain('?role=');
  });

  it('does not read or render a requested role in the login page', () => {
    expect(login).not.toContain('useSearchParams');
    expect(login).not.toContain('requestedRole');
    expect(login).not.toContain('workspaces');
    expect(login).not.toContain('login-workspace-picker');
    expect(login).not.toContain('sessionStorage');
    expect(login).not.toContain('usePlatformV7RStore');
  });

  it('redirects only to the server-resolved workspace', () => {
    expect(login).toContain('payload.redirectTo');
    expect(loginRoute).toContain('normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole)');
    expect(loginRoute).toContain('platformHome(role)');
    expect(loginRoute).not.toContain('body.role');
    expect(loginRoute).not.toContain('searchParams');
  });
});
