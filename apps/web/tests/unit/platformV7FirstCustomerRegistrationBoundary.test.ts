import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const registerRoute = read('app/api/auth/register/route.ts');
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
