/**
 * Policy for the passwordless demo-login fallback in `/api/auth/login`.
 *
 * The demo fallback mints a session without verifying a password (role is
 * derived from the email prefix). It is available only in an explicitly
 * enabled non-production test contour. Production can never enable it with an
 * environment flag.
 */

export const ALLOW_DEMO_LOGIN_FLAG = 'PLATFORM_V7_ALLOW_DEMO_LOGIN';

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return String(env.NODE_ENV || '').toLowerCase() === 'production';
}

export function demoLoginAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProduction(env)) return false;
  return String(env[ALLOW_DEMO_LOGIN_FLAG] || '').trim().toLowerCase() === 'true';
}
