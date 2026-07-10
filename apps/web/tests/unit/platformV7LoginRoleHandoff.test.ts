import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const loginPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const loginRoute = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/api/auth/login/route.ts'), 'utf8');

describe('platform-v7 server-authoritative login handoff', () => {
  it('does not read or persist a browser-selected role', () => {
    expect(loginPage).not.toContain('URLSearchParams');
    expect(loginPage).not.toContain('sessionStorage');
    expect(loginPage).not.toContain('localStorage');
    expect(loginPage).not.toContain('usePlatformV7RStore');
    expect(loginPage).not.toContain('PLATFORM_V7_ACTIVE_ROLE_KEY');
    expect(loginPage).not.toContain('/api/platform-v7/cabinet-session');
  });

  it('uses only the server response for the workspace redirect', () => {
    expect(loginPage).toContain("payload.redirectTo?.startsWith('/platform-v7/')");
    expect(loginPage).toContain('globalThis.location.assign(payload.redirectTo)');
    expect(loginRoute).toContain('normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole)');
    expect(loginRoute).toContain('applyAuthenticatedSession');
    expect(loginRoute).not.toContain('detectDemoRole');
    expect(loginRoute).not.toContain('demoLoginAllowed');
  });
});
