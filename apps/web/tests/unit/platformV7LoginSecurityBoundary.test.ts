import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const page = read('apps/web/app/platform-v7/login/page.tsx');
const flow = read('apps/web/components/platform-v7/PublicAuthLoginFlow.tsx');
const loginRoute = read('apps/web/app/api/auth/login/route.ts');
const mfaRoute = read('apps/web/app/api/auth/mfa-login/route.ts');
const cancelRoute = read('apps/web/app/api/auth/mfa-login/cancel/route.ts');
const session = read('apps/web/lib/server/auth-session-response.ts');
const ticket = read('apps/web/lib/server/mfa-login-ticket.ts');
const requestConfig = read('apps/web/i18n/request.ts');

describe('platform-v7 server-authoritative login boundary', () => {
  it('renders one canonical login flow without browser role authority', () => {
    expect(page).toContain('<PublicAuthLoginFlow />');
    for (const forbidden of [
      'surfaceRole(',
      'usePlatformV7RStore',
      'PLATFORM_V7_ACTIVE_ROLE_KEY',
      'sessionStorage',
      "fetch('/api/platform-v7/cabinet-session'",
      'platformV7RoleHome',
      '?role=',
    ]) {
      expect(flow).not.toContain(forbidden);
    }
    expect(flow).toContain('payload.redirectTo');
    expect(flow).toContain("globalThis.location.assign(payload.redirectTo)");
  });

  it('removes demo identity fallback and email-derived role detection', () => {
    for (const forbidden of ['demoLoginAllowed', 'detectDemoRole', 'setDemoSession', 'demo-refresh', 'Demo Org', 'payload?.demo']) {
      expect(loginRoute).not.toContain(forbidden);
    }
    expect(loginRoute).toContain("fetch(`${API_URL}/auth/login`");
    expect(loginRoute).toContain('UNIVERSAL_ERROR');
  });

  it('withholds access refresh and cabinet cookies until MFA succeeds', () => {
    expect(loginRoute).toContain('payload.mfaRequired');
    expect(loginRoute).toContain('sealMfaLoginTicket');
    expect(loginRoute).not.toMatch(/payload\.mfaRequired[\s\S]{0,1300}applyAuthenticatedSession/);
    expect(mfaRoute).toContain("fetch(`${API_URL}/auth/mfa/verify`");
    expect(mfaRoute).toContain('applyAuthenticatedSession');
    expect(session).toContain('signCabinetSession');
    expect(session).toContain('CABINET_SESSION_COOKIE');
  });

  it('stores only an encrypted challenge in the pending cookie', () => {
    expect(ticket).toContain("createCipheriv('aes-256-gcm'");
    expect(ticket).toContain('challengeToken: string');
    expect(ticket).not.toContain('accessToken: string');
    expect(ticket).not.toContain('refreshToken: string');
    expect(ticket).toContain('httpOnly: true');
    expect(ticket).toContain("sameSite: 'strict'");
    expect(ticket).toContain("path: '/api/auth'");
    expect(cancelRoute).toContain('clearMfaPendingCookieOptions');
  });

  it('keeps password MFA and backup-code disclosure as separate states', () => {
    expect(flow).toContain("type Step = 'password' | 'mfa' | 'backup-codes'");
    expect(flow).toContain("type Method = 'totp' | 'backup_code'");
    expect(flow).toContain("postJson('/api/auth/mfa-login'");
    expect(flow).toContain("autoComplete={method === 'totp' ? 'one-time-code' : 'off'}");
    expect(flow).toContain("step === 'backup-codes'");
    expect(requestConfig).toContain('publicAuthMfaMessages');
  });
});
