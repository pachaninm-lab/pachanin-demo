import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const PUBLIC_ROOT = 'apps/web/app/(platform-public)/platform-v7';

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 login security boundary', () => {
  const loginPage = read(`${PUBLIC_ROOT}/login/page.tsx`);
  const loginRoute = read('apps/web/app/api/auth/login/route.ts');
  const mfaRoute = read('apps/web/app/api/auth/mfa-login/route.ts');
  const refreshRoute = read('apps/web/app/api/auth/refresh/route.ts');
  const ticket = read('apps/web/lib/server/mfa-login-ticket.ts');

  it('does not derive or persist the role in client code', () => {
    expect(loginPage).not.toContain('surfaceRole');
    expect(loginPage).not.toContain('sessionStorage');
    expect(loginPage).not.toContain('localStorage');
    expect(loginPage).not.toContain('usePlatformV7RStore');
    expect(loginPage).not.toContain('PLATFORM_V7_ACTIVE_ROLE_KEY');
    expect(loginPage).not.toContain('cabinet-session');
    expect(loginPage).toContain('payload.redirectTo');
  });

  it('removes demo identity fallbacks from login and refresh', () => {
    for (const source of [loginRoute, refreshRoute]) {
      expect(source).not.toContain('demoLoginAllowed');
      expect(source).not.toContain('detectDemoRole');
      expect(source).not.toContain('demo-refresh');
      expect(source).not.toContain('Demo Org');
    }
  });

  it('withholds authenticated cookies until MFA succeeds', () => {
    expect(loginRoute).toContain('mfaRequired: true');
    expect(loginRoute).toContain('sealMfaLoginTicket');
    expect(loginRoute).not.toMatch(/mfaRequired:\s*true[\s\S]{0,500}applyAuthenticatedSession/);
    expect(mfaRoute).toContain('applyAuthenticatedSession');
    expect(mfaRoute).toContain("fetch(`${API_URL}/api/mfa/verify`");
  });

  it('supports separate TOTP and backup-code UI paths', () => {
    expect(loginPage).toContain("type LoginStep = 'password' | 'mfa'");
    expect(loginPage).toContain("type MfaMethod = 'totp' | 'backup_code'");
    expect(loginPage).toContain("fetch('/api/auth/mfa-login'");
    expect(loginPage).toContain("fetch('/api/auth/mfa-login/cancel'");
    expect(loginPage).toContain("autoComplete={method === 'totp' ? 'one-time-code' : 'off'}");
  });

  it('stores provisional credentials only in an encrypted HttpOnly strict cookie', () => {
    expect(ticket).toContain("createCipheriv('aes-256-gcm'");
    expect(ticket).toContain('httpOnly: true');
    expect(ticket).toContain("sameSite: 'strict'");
    expect(ticket).toContain("path: '/api/auth'");
    expect(ticket).toContain('MFA_PENDING_TTL_SECONDS = 5 * 60');
  });

  it('requires server refresh rotation and clears revoked sessions', () => {
    expect(refreshRoute).toContain("fetch(`${API_URL}/auth/refresh`");
    expect(refreshRoute).toContain('applyAuthenticatedSession');
    expect(refreshRoute).toContain('clearAuthenticatedSession');
    expect(refreshRoute).toContain("code: apiResponse.status === 429 ? 'RATE_LIMITED' : 'SESSION_REVOKED'");
  });
});
