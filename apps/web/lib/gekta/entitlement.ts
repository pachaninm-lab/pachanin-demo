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
    anonymousFreeAnswers: Math.min(1_000, positiveInteger(process.env.GEKTA_ANONYMOUS_FREE_ANSWERS, 10)),
    trialDays: positiveInteger(process.env.GEKTA_TRIAL_DAYS, 30),
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

export type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

export type GektaAccountAccess = Readonly<{
  accountId: string;
  /** Начало и конец пробного доступа. Обе даты ставит сервер. */
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: SubscriptionStatus;
  /** Конец оплаченного периода, если подписка активна или в просрочке. */
  currentPeriodEnd: string | null;
  /** Ручной доступ от владельца. `null` в `manualAccessUntil` при бессрочном. */
  manualAccessUntil: string | null;
  lifetimeAccess: boolean;
  suspended: boolean;
}>;

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/**
 * Разрешение доступа зарегистрированного аккаунта.
 *
 * Порядок разбора не произвольный: блокировка сильнее любого гранта, бессрочный
 * и ручной доступ сильнее подписки, подписка сильнее пробного периода. Все даты
 * сравниваются с серверным `now` — часы браузера в решение не входят.
 */
export function resolveAccountEntitlement(access: GektaAccountAccess, now: Date): GektaEntitlementSnapshot {
  const serverTime = now.toISOString();
  const current = now.getTime();
  const base = { canAsk: true, remaining: null, limit: null, serverTime } as const;

  if (access.suspended) {
    return { ...base, state: 'SUSPENDED', canAsk: false, expiresAt: null };
  }
  if (access.lifetimeAccess) {
    return { ...base, state: 'LIFETIME_ACCESS', expiresAt: null };
  }

  const manualUntil = parseTime(access.manualAccessUntil);
  if (manualUntil !== null && manualUntil > current) {
    return { ...base, state: 'MANUAL_ACCESS', expiresAt: access.manualAccessUntil };
  }

  if (access.subscriptionStatus === 'ACTIVE') {
    return { ...base, state: 'PAID_ACTIVE', expiresAt: access.currentPeriodEnd };
  }
  if (access.subscriptionStatus === 'PAST_DUE') {
    return { ...base, state: 'PAST_DUE', canAsk: false, expiresAt: access.currentPeriodEnd };
  }

  const trialEnds = parseTime(access.trialEndsAt);
  if (trialEnds !== null) {
    if (trialEnds > current) {
      return { ...base, state: 'TRIAL_ACTIVE', expiresAt: access.trialEndsAt };
    }
    // Отменённая подписка после закончившегося пробного периода — отдельное
    // состояние: человек уже платил, и текст для него другой.
    if (access.subscriptionStatus === 'CANCELLED') {
      return { ...base, state: 'CANCELLED', canAsk: false, expiresAt: access.currentPeriodEnd };
    }
    return { ...base, state: 'TRIAL_EXPIRED', canAsk: false, expiresAt: access.trialEndsAt };
  }

  if (access.subscriptionStatus === 'CANCELLED') {
    return { ...base, state: 'CANCELLED', canAsk: false, expiresAt: access.currentPeriodEnd };
  }

  // Аккаунт есть, пробный доступ ещё не выдан.
  return { ...base, state: 'REGISTRATION_REQUIRED', canAsk: false, expiresAt: null };
}

/**
 * Пробный доступ выдаётся один раз на аккаунт. Повторная регистрация того же
 * человека не создаёт новый пробный период: решение принимается по аккаунту,
 * а не по браузеру, cookie или localStorage.
 */
export function startTrial(now: Date, trialDays = getGektaAccessPolicy().trialDays): { trialStartedAt: string; trialEndsAt: string } {
  const ends = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  return { trialStartedAt: now.toISOString(), trialEndsAt: ends.toISOString() };
}

/** Сколько полных дней пробного доступа осталось. Никогда не отрицательное. */
export function trialDaysRemaining(trialEndsAt: string | null, now: Date): number {
  const ends = parseTime(trialEndsAt);
  if (ends === null) return 0;
  return Math.max(0, Math.ceil((ends - now.getTime()) / (24 * 60 * 60 * 1000)));
}

/** States in which the product must show a gate instead of a composer. */
export function isBlockedState(state: GektaEntitlementState): boolean {
  return state === 'REGISTRATION_REQUIRED'
    || state === 'TRIAL_EXPIRED'
    || state === 'PAST_DUE'
    || state === 'CANCELLED'
    || state === 'SUSPENDED';
}
