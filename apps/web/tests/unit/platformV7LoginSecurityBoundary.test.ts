import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const loginPage = read('apps/web/app/platform-v7/login/page.tsx');
const loginClient = read('apps/web/app/platform-v7/login/LoginFormClient.tsx');
const loginRoute = read('apps/web/app/api/auth/login/route.ts');
const mfaRoute = read('apps/web/app/api/auth/mfa-login/route.ts');
const cancelRoute = read('apps/web/app/api/auth/mfa-login/cancel/route.ts');
const session = read('apps/web/lib/server/auth-session-response.ts');
const ticket = read('apps/web/lib/server/mfa-login-ticket.ts');
const messages = read('apps/web/i18n/public-login-copy.ts');

describe('platform-v7 server-authoritative login boundary', () => {
  it('keeps the public shell server-rendered and client authority limited to credentials', () => {
    expect(loginPage).not.toContain("'use client'");
    expect(loginPage).toContain('getPublicLoginCopy(locale)');
    expect(loginPage).toContain('<LoginFormClient copy={form} />');
    for (const forbidden of [
      'surfaceRole(',
      'usePlatformV7RStore',
      'PLATFORM_V7_ACTIVE_ROLE_KEY',
      'sessionStorage',
      "fetch('/api/platform-v7/cabinet-session'",
      'platformV7RoleHome',
    ]) {
      expect(loginClient).not.toContain(forbidden);
    }
    expect(loginClient).toContain('payload.redirectTo');
    expect(loginClient).toContain('globalThis.location.assign(payload.redirectTo)');
  });

  it('removes production demo fallback and email-derived role detection', () => {
    for (const forbidden of [
      'demoLoginAllowed',
      'detectDemoRole',
      'setDemoSession',
      'demo-refresh',
      'Demo Org',
      'payload?.demo',
    ]) {
      expect(loginRoute).not.toContain(forbidden);
    }
    expect(loginRoute).toContain('fetch(`${API_URL}/auth/login`');
    expect(loginRoute).toContain('UNIVERSAL_ERROR');
  });

  it('withholds access refresh and cabinet cookies until MFA succeeds', () => {
    expect(loginRoute).toContain('payload.mfaRequired');
    expect(loginRoute).toContain('sealMfaLoginTicket');
    expect(loginRoute).not.toMatch(/payload\.mfaRequired[\s\S]{0,1400}applyAuthenticatedSession/);
    expect(mfaRoute).toContain('fetch(`${API_URL}/auth/mfa/verify`');
    expect(mfaRoute).toContain('applyAuthenticatedSession');
    expect(session).toContain('signCabinetSession');
    expect(session).toContain('CABINET_SESSION_COOKIE');
  });

  it('stores only the encrypted challenge in a bounded HttpOnly ticket', () => {
    expect(ticket).toContain("createCipheriv('aes-256-gcm'");
    expect(ticket).toContain('challengeToken: string');
    expect(ticket).not.toContain('accessToken: string');
    expect(ticket).not.toContain('refreshToken: string');
    expect(ticket).toContain('httpOnly: true');
    expect(ticket).toContain("sameSite: 'strict'");
    expect(ticket).toContain("path: '/api/auth'");
    expect(ticket).toContain('MFA_PENDING_TTL_SECONDS = 10 * 60');
    expect(cancelRoute).toContain('clearMfaPendingCookieOptions');
  });

  it('keeps password, MFA and one-time backup-code disclosure as separate UI states', () => {
    expect(loginClient).toContain("type LoginStep = 'password' | 'mfa' | 'backup-codes'");
    expect(loginClient).toContain("type MfaMethod = 'totp' | 'backup_code'");
    expect(loginClient).toContain("requestJson('/api/auth/mfa-login'");
    expect(loginClient).toContain("autoComplete={method === 'totp' ? 'one-time-code' : 'off'}");
    expect(loginClient).toContain("step === 'backup-codes'");
    expect(messages).toContain('mfaTitle:');
    expect(messages).toContain('backupCodesTitle:');
  });
});
