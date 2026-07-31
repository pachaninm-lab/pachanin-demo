import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const forgotRoute = read('app/api/auth/forgot-password/route.ts');
const resetRoute = read('app/api/auth/reset-password/route.ts');
const forgotClient = read('app/platform-v7/forgot-password/ForgotPasswordFormClient.tsx');
const forgotPage = read('app/platform-v7/forgot-password/page.tsx');
const resetClient = read('app/platform-v7/reset-password/ResetPasswordFormClient.tsx');

describe('platform-v7 password recovery boundary', () => {
  it('uses the server delivery boundary and never returns a reset token to the browser', () => {
    expect(forgotRoute).toContain('/auth/password-reset/request');
    expect(forgotRoute).toContain("'x-password-reset-delivery-key': deliveryKey");
    expect(forgotRoute).toContain('UNIVERSAL_MESSAGE');
    expect(forgotRoute).toContain('sendTransactionalMail');
    expect(forgotRoute).not.toContain('token: delivery.token');
    expect(forgotRoute).toContain("new URL('/platform-v7/forgot-password'");
  });

  it('replaces the old support inquiry with the dedicated recovery endpoint', () => {
    expect(forgotClient).toContain("fetch('/api/auth/forgot-password'");
    expect(forgotClient).not.toContain('/api/platform-v7/inquiries');
  });

  it('fails closed when API delivery dependencies are not configured', () => {
    expect(forgotRoute).toContain("code: 'AUTH_SERVICE_UNAVAILABLE'");
    expect(forgotRoute).toContain('mailChannelConfigured()');
    expect(forgotRoute).toContain("String(process.env.API_URL || '')");
  });

  it('confirms through the auth API and clears local auth state on success', () => {
    expect(resetRoute).toContain('/auth/password-reset/confirm');
    expect(resetRoute).toContain('clearAuthenticatedSession(response)');
    expect(resetRoute).toContain('MFA_PENDING_COOKIE');
    expect(resetRoute).not.toContain('localStorage');
    expect(resetRoute).not.toContain('sessionStorage');
  });

  it('keeps the token in the server page contract and out of client URL parsing', () => {
    expect(forgotPage).toContain('const tokenValue = Array.isArray(params.token)');
    expect(forgotPage).toContain('<ResetPasswordFormClient token={token} copy={copy} />');
    expect(resetClient).not.toContain('useSearchParams');
    expect(resetClient).toContain("fetch('/api/auth/reset-password'");
    expect(resetClient).toContain("autoComplete='new-password'");
  });

  it('contains explicit RU EN ZH reset copy and session revocation messaging', () => {
    expect(forgotPage).toContain("sessionsRevoked: 'Все прежние сессии и refresh-токены отозваны.'");
    expect(forgotPage).toContain("sessionsRevoked: 'All previous sessions and refresh tokens have been revoked.'");
    expect(forgotPage).toContain("sessionsRevoked: '所有旧会话和刷新令牌均已撤销。'");
  });
});
