import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sendTransactionalMail } from '../../lib/server/transactional-mail';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const registerRoute = read('app/api/auth/register/route.ts');
const resendRoute = read('app/api/auth/registration/resend/route.ts');
const registerPage = read('app/platform-v7/register/page.tsx');
const registerClient = read('app/platform-v7/register/RegisterFormClient.tsx');

describe('P0 first-customer registration boundary', () => {
  it('contains no demo cookies, role-by-email detection or API fail-open', () => {
    expect(registerRoute).not.toContain('detectDemoRole');
    expect(registerRoute).not.toContain('demo-refresh');
    expect(registerRoute).not.toContain('ACCESS_COOKIE');
    expect(registerRoute).not.toContain('SESSION_COOKIE');
    expect(registerRoute).not.toContain('Fall through to demo mode');
    expect(registerRoute).toContain("String(process.env.API_URL || '')");
    expect(registerRoute).toContain("code: 'REGISTRATION_SERVICE_UNAVAILABLE'");
  });

  it('fails closed unless a server-only registration delivery boundary and real mail channel are configured', () => {
    expect(registerRoute).toContain('REGISTRATION_DELIVERY_KEY');
    expect(registerRoute).toContain('!mailChannelConfigured()');
    expect(registerRoute).toContain('sendTransactionalMail');
    expect(registerRoute).toContain('registration_delivery_contract_invalid');
    expect(registerRoute).toContain('if (!deliveryResult.delivered)');
    expect(registerRoute).toContain("code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE'");
    expect(registerRoute).not.toContain('REGISTRATION_DELIVERY_KEY:');

    expect(resendRoute).toContain('REGISTRATION_DELIVERY_KEY');
    expect(resendRoute).toContain('!mailConfigured()');
    expect(resendRoute).toContain('sendTransactionalMail');
    expect(resendRoute).toContain('if (!delivery?.email || !delivery.token)');
    expect(resendRoute).toContain('if (!result.delivered)');
    expect(resendRoute).toContain("code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE'");
    expect(resendRoute).not.toContain('REGISTRATION_DELIVERY_KEY:');
  });

  it('retries only the proven transient SMTP timeout once and still fails closed after the retry', () => {
    expect(registerRoute).toContain('export const maxDuration = 30');
    expect(registerRoute).toContain("result.provider === 'smtp'");
    expect(registerRoute).toContain("result.reason.includes('smtp_timeout')");
    expect(registerRoute).toContain('attempts = 2');
    expect(registerRoute).toContain('await new Promise((resolve) => setTimeout(resolve, 250))');
    expect(registerRoute).toContain('if (!deliveryResult.delivered)');
    expect(registerRoute).toContain("code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE'");
    expect(registerRoute).not.toContain('while (');
  });

  it('forwards the bounded API registration retry window needed by the production matrix', () => {
    expect(registerRoute).toContain('retryAfterSeconds?: number');
    expect(registerRoute).toContain('boundedRetryAfterSeconds(payload.retryAfterSeconds)');
    expect(registerRoute).toContain('Number(value) <= 86_400');
    expect(registerRoute).toContain('{ retryAfterSeconds }');
  });

  it('executes the server-only Resend transport without exposing its credential', async () => {
    const previous = {
      resendApiKey: process.env.RESEND_API_KEY,
      resendFromEmail: process.env.RESEND_FROM_EMAIL,
      mailFrom: process.env.PC_MAIL_FROM,
      smtpHost: process.env.PC_SMTP_HOST,
      smtpUser: process.env.PC_SMTP_USER,
      smtpPass: process.env.PC_SMTP_PASS,
    };
    process.env.RESEND_API_KEY = 'test-resend-key-never-sent-to-the-browser';
    process.env.RESEND_FROM_EMAIL = 'security@example.test';
    delete process.env.PC_MAIL_FROM;
    delete process.env.PC_SMTP_HOST;
    delete process.env.PC_SMTP_USER;
    delete process.env.PC_SMTP_PASS;

    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(sendTransactionalMail({
        to: 'recipient@example.test',
        subject: 'Registration verification',
        text: 'single-use verification link',
      })).resolves.toEqual({ delivered: true, provider: 'resend', reason: 'sent' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('https://api.resend.com/emails');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        Authorization: 'Bearer test-resend-key-never-sent-to-the-browser',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(String(init.body))).toEqual({
        from: 'security@example.test',
        to: ['recipient@example.test'],
        subject: 'Registration verification',
        text: 'single-use verification link',
      });
    } finally {
      vi.unstubAllGlobals();
      const restore = (name: string, value: string | undefined) => {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      };
      restore('RESEND_API_KEY', previous.resendApiKey);
      restore('RESEND_FROM_EMAIL', previous.resendFromEmail);
      restore('PC_MAIL_FROM', previous.mailFrom);
      restore('PC_SMTP_HOST', previous.smtpHost);
      restore('PC_SMTP_USER', previous.smtpUser);
      restore('PC_SMTP_PASS', previous.smtpPass);
    }
  });

  it('rejects client role injection and only accepts public workspace classes', () => {
    expect(registerRoute).toContain("Object.prototype.hasOwnProperty.call(body, 'role')");
    expect(registerRoute).toContain("Object.prototype.hasOwnProperty.call(body, 'requestedRole')");
    expect(registerRoute).not.toContain("'arbitrator'");
    expect(registerRoute).not.toContain("'operator'");
    expect(registerRoute).not.toContain("'admin'");
  });

  it('uses one real form and never links submission to onboarding', () => {
    expect(registerPage).toContain('<RegisterFormClient');
    expect(registerPage).not.toContain('ROLE_OPTIONS');
    expect(registerPage).not.toContain('getSelectedRole');
    expect(registerClient).toContain("<form className='p0-register-form'");
    expect(registerClient).toContain("fetch('/api/auth/register'");
    expect(registerClient).not.toContain('/platform-v7/onboarding');
  });

  it('does not create a session and does not expose registration authority on public submission', () => {
    expect(registerRoute).not.toContain('applyAuthenticatedSession');
    expect(registerRoute).not.toContain('cookies()');
    expect(registerRoute).not.toContain('kind: payload.kind');
    expect(registerRoute).not.toContain('statusToken: payload.statusToken');
    expect(registerRoute).not.toContain('applicationId: payload.applicationId');
    expect(registerRoute).toContain("status: 'EMAIL_VERIFICATION_REQUIRED'");
    expect(registerClient).toContain('submissionAccepted');
    expect(registerClient).not.toContain('REGISTRATION_ACCOUNT_ALREADY_EXISTS');
    expect(registerClient).toContain('/api/auth/registration/status');
    expect(registerClient).toContain('/api/auth/registration/verify');
  });

  it('requires explicit non-preselected legal consents', () => {
    expect(registerClient).toContain("name='acceptTerms' type='checkbox'");
    expect(registerClient).toContain("name='acceptPrivacy' type='checkbox'");
    expect(registerClient).not.toContain('defaultChecked');
    expect(registerClient).not.toContain('checked={true}');
  });
});
