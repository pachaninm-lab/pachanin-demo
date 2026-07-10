import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const forgotRoute = read('apps/web/app/api/auth/forgot-password/route.ts');
const resetRoute = read('apps/web/app/api/auth/reset-password/route.ts');
const forgotClient = read('apps/web/app/platform-v7/forgot-password/ForgotPasswordFormClient.tsx');
const resetPage = read('apps/web/app/platform-v7/reset-password/page.tsx');
const resetClient = read('apps/web/app/platform-v7/reset-password/ResetPasswordFormClient.tsx');
const layout = read('apps/web/app/platform-v7/layout.tsx');
const templateSwitch = read('apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx');
const messages = read('apps/web/i18n/public-entry-messages.ts');

describe('platform-v7 password recovery boundary', () => {
  it('uses a universal BFF response and never returns reset tokens to the browser', () => {
    expect(forgotRoute).toContain("/auth/password-reset/request");
    expect(forgotRoute).toContain("'x-password-reset-delivery-key': deliveryKey");
    expect(forgotRoute).toContain('UNIVERSAL_MESSAGE');
    expect(forgotRoute).toContain('sendTransactionalMail');
    expect(forgotRoute).not.toContain('token: delivery.token');
    expect(forgotRoute).not.toContain('email, token');
  });

  it('replaces the old support request with the dedicated recovery endpoint', () => {
    expect(forgotClient).toContain("fetch('/api/auth/forgot-password'");
    expect(forgotClient).not.toContain('/api/platform-v7/inquiries');
    expect(forgotClient).not.toContain('requestName');
    expect(forgotClient).not.toContain('requestMessage');
  });

  it('confirms through the auth API and clears all local auth state on success', () => {
    expect(resetRoute).toContain('/auth/password-reset/confirm');
    expect(resetRoute).toContain('clearAuthenticatedSession(response)');
    expect(resetRoute).toContain('MFA_PENDING_COOKIE');
    expect(resetRoute).not.toContain('localStorage');
    expect(resetRoute).not.toContain('sessionStorage');
  });

  it('keeps the token in the server page contract and not in client URL parsing', () => {
    expect(resetPage).toContain("searchParams?.token");
    expect(resetPage).toContain('<ResetPasswordFormClient token={token} copy={copy} />');
    expect(resetPage).toContain('index: false');
    expect(resetClient).not.toContain('useSearchParams');
    expect(resetClient).toContain("fetch('/api/auth/reset-password'");
    expect(resetClient).toContain("autoComplete='new-password'");
  });

  it('keeps both recovery routes outside protected runtime guards', () => {
    expect(layout).toContain("'/platform-v7/forgot-password'");
    expect(layout).toContain("'/platform-v7/reset-password'");
    expect(templateSwitch).toContain("'/platform-v7/forgot-password'");
    expect(templateSwitch).toContain("'/platform-v7/reset-password'");
  });

  it('contains complete RU EN ZH reset copy and no legacy support fields', () => {
    expect(messages.match(/reset:\s*\{/g)?.length).toBe(4); // type + ru + en + zh
    expect(messages).toContain("sessionsRevoked: 'Все прежние сессии отозваны. Войдите заново.'");
    expect(messages).toContain("sessionsRevoked: 'All previous sessions were revoked. Sign in again.'");
    expect(messages).toContain("sessionsRevoked: '所有旧会话已撤销。请重新登录。'");
    expect(messages).not.toContain('requestName');
    expect(messages).not.toContain('requestMessage');
  });
});
