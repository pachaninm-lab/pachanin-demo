/**
 * Права кабинета оператора Гекты.
 *
 * Проверка прав всегда серверная. Клиент получает только результат решения и
 * никогда не участвует в его принятии.
 *
 * Разделение построено вокруг одного принципа приватности: поиск пользователя и
 * работа с метаданными — обычная работа поддержки, а чтение содержания диалогов
 * — отдельная привилегия, которая требует согласия пользователя и остаётся в
 * журнале.
 */

export const GEKTA_OPERATOR_ROLES = ['GEKTA_SUPPORT', 'GEKTA_OPERATOR', 'GEKTA_ADMIN', 'GEKTA_OWNER'] as const;

export type GektaOperatorRole = (typeof GEKTA_OPERATOR_ROLES)[number];

export const GEKTA_OPERATOR_PERMISSIONS = [
  'account.search',
  'account.read_metadata',
  'account.read_conversation_content',
  'entitlement.grant_manual',
  'entitlement.grant_lifetime',
  'entitlement.revoke_manual',
  'entitlement.reset_quota',
  'entitlement.extend_trial',
  'account.suspend',
  'billing.read_metadata',
  'metrics.read_global',
  'merchant.read_legal_status',
  'audit.read',
] as const;

export type GektaOperatorPermission = (typeof GEKTA_OPERATOR_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<GektaOperatorRole, readonly GektaOperatorPermission[]> = {
  // Поддержка видит, что происходит, но ничего не выдаёт и не снимает.
  GEKTA_SUPPORT: ['account.search', 'account.read_metadata'],
  // Оператор дополнительно чинит ошибочно исчерпанный лимит и видит платёжные метаданные.
  GEKTA_OPERATOR: ['account.search', 'account.read_metadata', 'entitlement.reset_quota', 'billing.read_metadata'],
  // Администратор выдаёт и отзывает срочный доступ, продлевает пробный период и блокирует.
  GEKTA_ADMIN: [
    'account.search',
    'account.read_metadata',
    'entitlement.grant_manual',
    'entitlement.revoke_manual',
    'entitlement.reset_quota',
    'entitlement.extend_trial',
    'account.suspend',
    'billing.read_metadata',
    'audit.read',
  ],
  // Владелец дополнительно выдаёт бессрочный доступ и видит глобальные метрики
  // и юридический статус продавца.
  GEKTA_OWNER: [...GEKTA_OPERATOR_PERMISSIONS],
};

export function permissionsFor(roles: readonly GektaOperatorRole[]): ReadonlySet<GektaOperatorPermission> {
  const granted = new Set<GektaOperatorPermission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) granted.add(permission);
  }
  return granted;
}

export function hasPermission(roles: readonly GektaOperatorRole[], permission: GektaOperatorPermission): boolean {
  return permissionsFor(roles).has(permission);
}

export function isOperatorRole(value: unknown): value is GektaOperatorRole {
  return typeof value === 'string' && (GEKTA_OPERATOR_ROLES as readonly string[]).includes(value);
}

export type SupportAccessGrant = Readonly<{
  accountId: string;
  grantedByOperatorId: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
}>;

export const SUPPORT_ACCESS_WINDOW_HOURS = 24;

/**
 * Согласие пользователя на доступ поддержки к диалогам ограничено по времени и
 * выдаётся самим пользователем. Ни одна роль не читает содержание диалога без
 * действующего гранта — даже владелец.
 */
export function canReadConversationContent(
  roles: readonly GektaOperatorRole[],
  grant: SupportAccessGrant | null,
  accountId: string,
  now: Date,
): { allowed: boolean; reason: string | null } {
  if (!hasPermission(roles, 'account.read_conversation_content')) {
    return { allowed: false, reason: 'permission_denied' };
  }
  if (!grant) return { allowed: false, reason: 'no_support_grant' };
  if (grant.accountId !== accountId) return { allowed: false, reason: 'grant_account_mismatch' };
  const expires = Date.parse(grant.expiresAt);
  if (!Number.isFinite(expires) || expires <= now.getTime()) {
    return { allowed: false, reason: 'grant_expired' };
  }
  return { allowed: true, reason: null };
}

export function createSupportAccessGrant(
  accountId: string,
  operatorId: string,
  reason: string,
  now: Date,
  windowHours = SUPPORT_ACCESS_WINDOW_HOURS,
): SupportAccessGrant {
  return {
    accountId,
    grantedByOperatorId: operatorId,
    reason: reason.slice(0, 500),
    grantedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + windowHours * 60 * 60 * 1000).toISOString(),
  };
}

export type ManualGrantKind = 'DAYS_7' | 'DAYS_30' | 'UNTIL_DATE' | 'LIFETIME';

export type OperatorAuditEntry = Readonly<{
  correlationId: string;
  actorOperatorId: string;
  actorRoles: readonly GektaOperatorRole[];
  targetAccountId: string;
  /** Телефон — только локатор поиска, и только в маскированном виде. */
  phoneLocatorMasked: string | null;
  action: string;
  previousState: string;
  newState: string;
  reason: string;
  expiresAt: string | null;
  source: string;
  timestamp: string;
}>;

/**
 * Каждое изменение доступа записывается целиком: кто, кому, что было, что
 * стало, почему и до каких пор. Запись неизменяема по построению.
 */
export function buildAuditEntry(entry: Omit<OperatorAuditEntry, 'timestamp'>, now: Date): OperatorAuditEntry {
  return { ...entry, timestamp: now.toISOString() };
}

/**
 * Поиск по телефону может вернуть несколько аккаунтов с неподтверждённым
 * номером. Угадывать нельзя: доступ выдаётся конкретному account ID, а телефон
 * остаётся только способом его найти.
 */
export function resolveGrantTarget(matches: readonly { accountId: string }[]): {
  status: 'single' | 'ambiguous' | 'not_found';
  accountId: string | null;
  candidates: readonly string[];
} {
  if (matches.length === 0) return { status: 'not_found', accountId: null, candidates: [] };
  if (matches.length === 1) return { status: 'single', accountId: matches[0].accountId, candidates: [] };
  return { status: 'ambiguous', accountId: null, candidates: matches.map((match) => match.accountId) };
}
