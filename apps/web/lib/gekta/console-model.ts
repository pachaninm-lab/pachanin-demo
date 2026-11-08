import type { GektaOperatorPermission } from '@/lib/gekta/operator-rbac';

/**
 * Модель кабинета владельца Гекты.
 *
 * Числа приходят с сервера как есть. Ничего не додумывается: если метрики нет,
 * показывается прочерк, а не ноль и не оценка. Действия, на которые у роли нет
 * права, не показываются вовсе — кнопка, которая гарантированно вернёт отказ,
 * это ложная функциональность.
 */

export type ConsoleMetrics = Readonly<{
  accounts: { total: number; today: number; last7Days: number; last30Days: number };
  entitlement: {
    trialActive: number;
    trialExpired: number;
    paidActive: number;
    pastDue: number;
    cancelled: number;
    manualActive: number;
    lifetime: number;
    suspended: number;
  };
  activity: { completedAnswers: number; conversations: number; projects: number };
  conversion: { trialToPaid: number | null };
  serverTime: string;
}>;

export type ConsoleAccount = Readonly<{
  accountId: string;
  userId: string;
  email?: string;
  registeredAt?: string;
  phoneState?: string | null;
  trial?: { startedAt: string | null; endsAt: string | null; active: boolean };
  subscriptionStatus?: string;
  lifetimeAccess?: boolean;
  suspended?: boolean;
  usage?: { completedAnswers: number; answersToday: number };
  counts?: { conversations: number; projects: number };
  grants?: readonly ConsoleGrant[];
}>;

export type ConsoleGrant = Readonly<{
  id: string;
  kind: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  reason: string;
}>;

export type SearchOutcome = Readonly<{
  status: 'single' | 'ambiguous' | 'not_found';
  accounts: readonly ConsoleAccount[];
}>;

export type GrantKind = 'DAYS_7' | 'DAYS_30' | 'UNTIL_DATE' | 'LIFETIME';

export type ConsoleActionId = GrantKind | 'EXTEND_TRIAL' | 'SUSPEND' | 'UNSUSPEND' | 'RESET_QUOTA';

export type ConsoleAction = Readonly<{
  id: ConsoleActionId;
  label: string;
  permission: GektaOperatorPermission;
  /** Требует ли действие даты. Форма без даты не отправляется. */
  needsDate: boolean;
  destructive: boolean;
}>;

export const CONSOLE_ACTIONS: readonly ConsoleAction[] = [
  { id: 'DAYS_7', label: 'Доступ на 7 дней', permission: 'entitlement.grant_manual', needsDate: false, destructive: false },
  { id: 'DAYS_30', label: 'Доступ на 30 дней', permission: 'entitlement.grant_manual', needsDate: false, destructive: false },
  { id: 'UNTIL_DATE', label: 'Доступ до даты', permission: 'entitlement.grant_manual', needsDate: true, destructive: false },
  { id: 'LIFETIME', label: 'Бессрочный доступ', permission: 'entitlement.grant_lifetime', needsDate: false, destructive: false },
  { id: 'EXTEND_TRIAL', label: 'Продлить пробный период на 30 дней', permission: 'entitlement.extend_trial', needsDate: false, destructive: false },
  { id: 'RESET_QUOTA', label: 'Сбросить дневной лимит', permission: 'entitlement.reset_quota', needsDate: false, destructive: false },
  { id: 'SUSPEND', label: 'Приостановить аккаунт', permission: 'account.suspend', needsDate: false, destructive: true },
  { id: 'UNSUSPEND', label: 'Снять приостановку', permission: 'account.suspend', needsDate: false, destructive: false },
];

export function visibleActions(
  permissions: readonly string[],
  account: ConsoleAccount | null,
): readonly ConsoleAction[] {
  const granted = new Set(permissions);
  return CONSOLE_ACTIONS.filter((action) => {
    if (!granted.has(action.permission)) return false;
    // Приостановка и её снятие взаимно исключают друг друга: показывается ровно
    // то действие, которое изменит текущее состояние.
    if (action.id === 'SUSPEND') return account?.suspended !== true;
    if (action.id === 'UNSUSPEND') return account?.suspended === true;
    return true;
  });
}

/**
 * Отзыв всегда адресуется конкретному гранту: у аккаунта их может быть
 * несколько, и «отозвать доступ вообще» — это операция, смысл которой
 * непонятен ни оператору, ни журналу.
 */
export function revocableGrants(
  permissions: readonly string[],
  account: ConsoleAccount | null,
): readonly ConsoleGrant[] {
  if (!permissions.includes('entitlement.revoke_manual')) return [];
  return (account?.grants ?? []).filter((grant) => !grant.revokedAt);
}

export type SearchMode = 'phone' | 'email' | 'accountId';

/** Пустой или слишком длинный запрос не уходит на сервер. */
export function buildSearchQuery(mode: SearchMode, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 320) return null;
  return `${mode}=${encodeURIComponent(trimmed)}`;
}

/** Метрика без значения показывается прочерком, а не выдуманным нулём. */
export function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function formatShare(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value * 100)} %`;
}

export function formatMoment(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(parsed);
}

/**
 * Состояние телефона показывается словами пользователя, но никогда как
 * «подтверждён», пока подтверждения на самом деле не было.
 */
export function phoneStateLabel(state: string | null | undefined): string {
  switch (state) {
    case 'DECLARED':
      return 'указан пользователем, не подтверждён';
    case 'VERIFIED':
      return 'подтверждён';
    case 'CONFLICTED':
      return 'конфликт: номер заявлен несколькими аккаунтами';
    case 'REVOKED':
      return 'отозван';
    default:
      return 'не указан';
  }
}
