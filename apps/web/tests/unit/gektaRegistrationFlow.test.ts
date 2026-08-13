import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const page = read('app/gekta/register/page.tsx');
const client = read('components/gekta/GektaRegistrationClient.tsx');
const registerRoute = read('app/api/gekta/auth/register/route.ts');
const resendRoute = read('app/api/gekta/auth/register/email/resend/route.ts');
const emailRoute = read('app/api/gekta/auth/email/verify/route.ts');
const loginRoute = read('app/api/gekta/auth/login/route.ts');
const mfaRoute = read('app/api/gekta/auth/mfa/verify/route.ts');
const refreshRoute = read('app/api/gekta/auth/refresh/route.ts');
const session = read('lib/server/gekta-auth-session.ts');
const registrationMail = read('lib/server/gekta-registration-mail.ts');
const workspace = read('lib/gekta/server-workspace.ts');
const middleware = read('middleware.ts');
const chat = read('components/gekta/GektaChatWorkspace.tsx');

describe('Gekta registration and product-session browser boundary', () => {
  it('publishes a real personal registration and returning-login entry point', () => {
    expect(page).toContain('<GektaRegistrationClient');
    expect(client).toContain("name='fullName'");
    expect(client).toContain("name='phone'");
    expect(client).toContain("name='acceptedServiceTerms'");
    expect(client).toContain("name='acceptedPersonalData'");
    expect(client).toContain('/legal/usloviya-ispolzovaniya-gekta');
    expect(client).toContain('/legal/politika-konfidencialnosti');
    expect(chat).toContain("data-gekta-login-entry='true'");
    expect(chat).toContain("fetch('/api/gekta/auth/logout'");
  });

  it('keeps bearer credentials out of the client component and local storage', () => {
    expect(client).not.toContain('challengeToken');
    expect(client).not.toContain('accessToken');
    expect(client).not.toContain('refreshToken');
    expect(client).not.toContain('localStorage');
    expect(page).not.toContain('verifyToken');
    expect(mfaRoute).toContain('openGektaMfaTicket');
    expect(mfaRoute).toContain('applyGektaSession');
  });

  it('does not let a mail scanner consume the single-use verification token', () => {
    expect(registrationMail).toContain("new URL('/api/gekta/auth/email/verify'");
    expect(emailRoute).toContain('export function GET(request: Request)');
    expect(emailRoute).toContain('sealGektaEmailTicket(token)');
    expect(emailRoute).toContain('NextResponse.redirect(target, 303)');
    expect(emailRoute).toContain('export async function POST(request: Request)');
    expect(emailRoute).toContain('openGektaEmailTicket');
    expect(emailRoute).toContain('assertCsrf(request)');
  });

  it('delivers mail only behind the internal delivery key and never returns its token', () => {
    expect(registerRoute).toContain('REGISTRATION_DELIVERY_KEY');
    expect(registerRoute).toContain("'X-Registration-Delivery-Key': deliveryKey");
    expect(registerRoute).toContain('sendGektaVerificationMail');
    expect(registrationMail).toContain('sendTransactionalMail');
    expect(registerRoute).toContain("status: 'EMAIL_VERIFICATION_REQUIRED'");
    expect(registerRoute).not.toContain('emailDelivery: delivery');
  });

  it('can safely redeliver an expired or failed verification email', () => {
    expect(client).toContain("authRequest('register/email/resend'");
    expect(resendRoute).toContain("'register/email/resend'");
    expect(resendRoute).toContain("'X-Registration-Delivery-Key': deliveryKey");
    expect(resendRoute).toContain('sendGektaVerificationMail');
    expect(resendRoute).toContain('Unknown, active, cooling-down and pending addresses');
  });

  it('normalizes both supported MFA-enrollment response shapes', () => {
    expect(loginRoute).toContain("upstream.payload.enrollmentRequired === true\n    || Boolean(setupSecret || otpAuthUri)");
    expect(emailRoute).toContain("upstream.payload.enrollmentRequired === true\n    || Boolean(setupSecret || otpAuthUri)");
  });

  it('keeps the product session out of the signed platform cabinet contour', () => {
    expect(session).toContain('for (const name of [SESSION_COOKIE, CABINET_SESSION_COOKIE])');
    expect(session).not.toContain('signCabinetSession');
    expect(middleware).toContain("p.startsWith('/api/gekta/')");
    expect(refreshRoute).toContain("postGektaAuth(request, 'refresh'");
    expect(workspace).toContain('let refreshInFlight: Promise<boolean> | null = null;');
    expect(workspace).toContain('if (response.status === 401 && await refreshProductSession())');
  });

  it('keeps the registration controls usable on 320px mobile screens', () => {
    expect(client).toContain("min-h-12 w-full");
    expect(client).toContain("min-h-11 items-start");
    expect(client).toContain("text-base text-slate-950");
    expect(client).toContain("overflow-x-clip");
  });
});
