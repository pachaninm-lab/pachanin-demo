/**
 * Policy for the passwordless demo-login fallback in `/api/auth/login`.
 *
 * The demo fallback mints a session without verifying a password (role is
 * derived from the email prefix). That is fine for local/dev/test, but it must
 * NOT be silently available in production on a real platform. It is therefore
 * secure-by-default: disabled in production unless an operator explicitly
 * opts in via `PLATFORM_V7_ALLOW_DEMO_LOGIN=true` (a conscious, visible switch,
 * mirroring the flag idiom already used by the cabinet-session route).
 */

export const ALLOW_DEMO_LOGIN_FLAG = 'PLATFORM_V7_ALLOW_DEMO_LOGIN';

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return String(env.NODE_ENV || '').toLowerCase() === 'production';
}

export function demoLoginAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (String(env[ALLOW_DEMO_LOGIN_FLAG] || '').trim().toLowerCase() === 'true') return true;
  return !isProduction(env);
}
