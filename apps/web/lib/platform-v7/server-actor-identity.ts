// SEC-001 (audit): привязка актора к доверенной серверной сессии.
//
// Главный блокер go-live: серверная граница действий принимала actorId/actorRole
// из тела запроса без сверки с сессией (возможна подмена роли). Здесь —
// authoritative-контракт: доверенный актор берётся ИЗ СЕССИИ; если тело тоже
// содержит актора, он ОБЯЗАН совпасть, иначе отказ + audit-событие.
//
// Это чистая, протестированная логика enforcement. Остаётся owner-side только
// однострочная обвязка на API-границе: извлечь актора из подписанной session-
// cookie/JWT и вызвать platformV7AssertActorMatchesSession ДО обработки тела.
// Пример приведён в самом низу файла (в комментарии), без правок app/api.

export interface PlatformV7TrustedActor {
  readonly actorId: string;
  readonly actorRole: string;
  readonly organizationId: string;
}

export interface PlatformV7ClaimedActor {
  readonly actorId?: unknown;
  readonly actorRole?: unknown;
  readonly organizationId?: unknown;
}

export type PlatformV7IdentityAuditCode =
  | 'NO_SESSION'
  | 'ACTOR_MISMATCH'
  | 'ROLE_MISMATCH'
  | 'ORG_MISMATCH';

export interface PlatformV7IdentityMismatchAudit {
  readonly eventType: 'identity.mismatch';
  readonly auditCode: PlatformV7IdentityAuditCode;
  readonly claimedActorId: string | null;
  readonly trustedActorId: string | null;
  readonly reason: string;
  readonly occurredAt: string;
}

// Плоский результат (все поля всегда присутствуют): репозиторий собирается с
// strict:false, где сужение discriminated-union по boolean ненадёжно. При ok
// заполнен actor; при !ok — auditCode/reason/audit.
export interface PlatformV7IdentityDecision {
  readonly ok: boolean;
  readonly actor: PlatformV7TrustedActor | null;
  readonly auditCode: PlatformV7IdentityAuditCode | null;
  readonly reason: string | null;
  readonly audit: PlatformV7IdentityMismatchAudit | null;
}

const EPOCH = new Date(0).toISOString();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function deny(
  auditCode: PlatformV7IdentityAuditCode,
  reason: string,
  claimedActorId: string | null,
  trustedActorId: string | null,
  occurredAt: string,
): PlatformV7IdentityDecision {
  return {
    ok: false,
    actor: null,
    auditCode,
    reason,
    audit: { eventType: 'identity.mismatch', auditCode, claimedActorId, trustedActorId, reason, occurredAt },
  };
}

/**
 * Сверяет заявленного в теле актора с доверенным (из сессии). Сессия —
 * authoritative: claim'ы из тела не могут переопределить её. Отсутствующий в
 * теле claim допускается (используется сессионный актор); присутствующий, но
 * несовпадающий — отказ + audit.
 */
export function platformV7AssertActorMatchesSession(
  claimed: PlatformV7ClaimedActor | null | undefined,
  trusted: PlatformV7TrustedActor | null | undefined,
  occurredAt: string = EPOCH,
): PlatformV7IdentityDecision {
  if (!trusted || !isNonEmptyString(trusted.actorId)) {
    return deny('NO_SESSION', 'No trusted server session actor.', readClaimId(claimed), null, occurredAt);
  }

  const claimedId = readClaimId(claimed);

  if (claimed && isNonEmptyString(claimed.actorId) && claimed.actorId !== trusted.actorId) {
    return deny('ACTOR_MISMATCH', 'Body actorId does not match session.', claimedId, trusted.actorId, occurredAt);
  }
  if (claimed && isNonEmptyString(claimed.actorRole) && claimed.actorRole !== trusted.actorRole) {
    return deny('ROLE_MISMATCH', 'Body actorRole does not match session.', claimedId, trusted.actorId, occurredAt);
  }
  if (claimed && isNonEmptyString(claimed.organizationId) && claimed.organizationId !== trusted.organizationId) {
    return deny('ORG_MISMATCH', 'Body organizationId does not match session.', claimedId, trusted.actorId, occurredAt);
  }

  return { ok: true, actor: trusted, auditCode: null, reason: null, audit: null };
}

function readClaimId(claimed: PlatformV7ClaimedActor | null | undefined): string | null {
  return claimed && isNonEmptyString(claimed.actorId) ? claimed.actorId : null;
}

/**
 * Возвращает доверенного актора для дальнейшей обработки или null при отказе.
 * Удобно как однострочный гейт на API-границе.
 */
export function platformV7ResolveTrustedActor(
  claimed: PlatformV7ClaimedActor | null | undefined,
  trusted: PlatformV7TrustedActor | null | undefined,
  occurredAt: string = EPOCH,
): PlatformV7TrustedActor | null {
  const decision = platformV7AssertActorMatchesSession(claimed, trusted, occurredAt);
  return decision.ok ? decision.actor : null;
}

// --- Обвязка на API-границе (owner-side, БЕЗ правок здесь) ---
//
// import { cookies } from 'next/headers';
// const trusted = parseSessionToTrustedActor(cookies()); // из подписанной cookie/JWT
// const decision = platformV7AssertActorMatchesSession(body, trusted);
// if (!decision.ok) {
//   // записать decision.audit в audit-sink, вернуть 403
//   return NextResponse.json({ ok: false, reason: decision.reason }, { status: 403 });
// }
// // дальше использовать decision.actor (НЕ body) как актора действия.
