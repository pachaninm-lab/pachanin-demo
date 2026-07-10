import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const loginPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const loginClient = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/login/LoginFormClient.tsx'), 'utf8');
const loginRoute = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/api/auth/login/route.ts'), 'utf8');

describe('platform-v7 server-authoritative login handoff', () => {
  it('server-renders the entry shell without reading a browser-selected role', () => {
    expect(loginPage).not.toContain("'use client'");
    expect(loginPage).toContain('<LoginFormClient copy={copy} />');
    expect(loginClient).not.toContain('URLSearchParams');
    expect(loginClient).not.toContain('sessionStorage');
    expect(loginClient).not.toContain('localStorage');
    expect(loginClient).not.toContain('usePlatformV7RStore');
    expect(loginClient).not.toContain('PLATFORM_V7_ACTIVE_ROLE_KEY');
    expect(loginClient).not.toContain('/api/platform-v7/cabinet-session');
  });

  it('uses only the server response for the workspace redirect', () => {
    expect(loginClient).toContain("payload.redirectTo?.startsWith('/platform-v7/')");
    expect(loginClient).toContain('globalThis.location.assign(payload.redirectTo)');
    expect(loginRoute).toContain('normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole)');
    expect(loginRoute).toContain('applyAuthenticatedSession');
    expect(loginRoute).not.toContain('detectDemoRole');
    expect(loginRoute).not.toContain('demoLoginAllowed');
  });
});
