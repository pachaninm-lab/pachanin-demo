export const MFA_STEP_UP_COOKIE = 'pc_mfa_step_up';
export const MFA_STEP_UP_TTL_SECONDS = 10 * 60;

export function mfaStepUpCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth/mfa-step-up',
    maxAge: MFA_STEP_UP_TTL_SECONDS,
  };
}

export function clearMfaStepUpCookieOptions() {
  return {
    ...mfaStepUpCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  };
}
