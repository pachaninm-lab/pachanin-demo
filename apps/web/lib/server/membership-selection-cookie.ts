export const MEMBERSHIP_SELECTION_COOKIE = 'pc_membership_selection';
export const MEMBERSHIP_SELECTION_TTL_SECONDS = 5 * 60;

export function membershipSelectionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: MEMBERSHIP_SELECTION_TTL_SECONDS,
  };
}

export function clearMembershipSelectionCookieOptions() {
  return {
    ...membershipSelectionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  };
}
