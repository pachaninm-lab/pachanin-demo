/**
 * Gekta access model.
 *
 * Every decision in this module is taken on the server. The browser is told the
 * outcome so it can render the right surface; it is never the authority.
 */

export const GEKTA_ENTITLEMENT_STATES = [
  'ANONYMOUS_FREE',
  'REGISTRATION_REQUIRED',
  'TRIAL_ACTIVE',
  'TRIAL_EXPIRED',
  'PAID_ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'MANUAL_ACCESS',
  'LIFETIME_ACCESS',
  'SUSPENDED',
] as const;

export type GektaEntitlementState = (typeof GEKTA_ENTITLEMENT_STATES)[number];

export type GektaEntitlementSnapshot = Readonly<{
  state: GektaEntitlementState;
  /** True when a new answer may be generated right now. */
  canAsk: boolean;
  /** Free answers left for an anonymous visitor; null when the concept does not apply. */
  remaining: number | null;
  limit: number | null;
  /** Server clock. The browser clock is never used for an access decision. */
  serverTime: string;
  /** Set when the state is time-bounded (trial, manual grant, paid period). */
  expiresAt: string | null;
}>;

function positiveInteger(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Access policy is configuration, not code: production limits are set centrally
 * through the environment so they can change without a release.
 */
export function getGektaAccessPolicy() {
  return {
    anonymousFreeAnswers: positiveInteger(process.env.GEKTA_ANONYMOUS_FREE_ANSWERS, 10),
    trialDays: positiveInteger(process.env.GEKTA_TRIAL_DAYS, 7),
    /** Fair-use ceiling for a paid plan. Never described to the user as "unlimited". */
    paidFairUseAnswersPerDay: positiveInteger(process.env.GEKTA_PAID_FAIR_USE_ANSWERS_PER_DAY, 300),
    monthlyPriceRub: positiveInteger(process.env.GEKTA_MONTHLY_PRICE_RUB, 299),
  } as const;
}

export type AnonymousUsage = Readonly<{ used: number }>;

/**
 * Anonymous visitors are the only identity this deployment can resolve today, so
 * this is the only branch that can currently be reached. The remaining states are
 * resolved from an account record once account-backed entitlement is connected;
 * they are declared here so the server, not the browser, stays their authority.
 */
export function resolveAnonymousEntitlement(usage: AnonymousUsage, now: Date): GektaEntitlementSnapshot {
  const { anonymousFreeAnswers } = getGektaAccessPolicy();
  const used = Math.max(0, Math.min(usage.used, anonymousFreeAnswers));
  const remaining = Math.max(0, anonymousFreeAnswers - used);
  return {
    state: remaining > 0 ? 'ANONYMOUS_FREE' : 'REGISTRATION_REQUIRED',
    canAsk: remaining > 0,
    remaining,
    limit: anonymousFreeAnswers,
    serverTime: now.toISOString(),
    expiresAt: null,
  };
}

/** States in which the product must show a gate instead of a composer. */
export function isBlockedState(state: GektaEntitlementState): boolean {
  return state === 'REGISTRATION_REQUIRED'
    || state === 'TRIAL_EXPIRED'
    || state === 'PAST_DUE'
    || state === 'CANCELLED'
    || state === 'SUSPENDED';
}
