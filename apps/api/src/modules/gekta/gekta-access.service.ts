import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Доступ к Гекте для зарегистрированного пользователя.
 *
 * Все решения принимаются здесь, по серверным часам и по состоянию в базе.
 * Браузер получает только результат: очистка cookie, смена браузера, выход и
 * повторный вход не меняют ни одного факта о доступе.
 */

export type GektaEntitlementState =
  | 'ANONYMOUS_FREE'
  | 'REGISTRATION_REQUIRED'
  | 'TRIAL_ACTIVE'
  | 'TRIAL_EXPIRED'
  | 'PAID_ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'MANUAL_ACCESS'
  | 'LIFETIME_ACCESS'
  | 'SUSPENDED';

export type GektaEntitlement = Readonly<{
  state: GektaEntitlementState;
  canAsk: boolean;
  expiresAt: string | null;
  serverTime: string;
}>;

export type ManualGrantKind = 'DAYS_7' | 'DAYS_30' | 'UNTIL_DATE' | 'LIFETIME';

const DAY_MS = 24 * 60 * 60 * 1000;

function trialDays(): number {
  const raw = Number.parseInt(process.env.GEKTA_TRIAL_DAYS ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

@Injectable()
export class GektaAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Аккаунт Гекты создаётся один раз на пользователя платформы. Пробный период
   * выдаётся только при первом создании: `trialGranted` закрывает повторную
   * выдачу навсегда, поэтому новый браузер или повторный вход его не возобновят.
   */
  async ensureAccount(userId: string, now: Date = new Date()) {
    const existing = await this.prisma.gektaAccount.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.gektaAccount.create({
      data: {
        userId,
        trialStartedAt: now,
        trialEndsAt: new Date(now.getTime() + trialDays() * DAY_MS),
        trialGranted: true,
        usage: { create: {} },
        subscription: { create: {} },
      },
    });
  }

  /**
   * Порядок разбора состояний не произвольный: блокировка сильнее любого гранта,
   * бессрочный и ручной доступ сильнее подписки, подписка сильнее пробного
   * периода. Иначе выданный владельцем доступ терялся бы после истечения trial.
   */
  async resolveEntitlement(userId: string, now: Date = new Date()): Promise<GektaEntitlement> {
    const account = await this.prisma.gektaAccount.findUnique({
      where: { userId },
      include: {
        subscription: true,
        grants: { where: { revokedAt: null }, orderBy: { grantedAt: 'desc' } },
      },
    });

    const serverTime = now.toISOString();
    if (!account) {
      return { state: 'REGISTRATION_REQUIRED', canAsk: false, expiresAt: null, serverTime };
    }
    if (account.suspended) {
      return { state: 'SUSPENDED', canAsk: false, expiresAt: null, serverTime };
    }
    if (account.lifetimeAccess || account.grants.some((grant) => grant.kind === 'LIFETIME')) {
      return { state: 'LIFETIME_ACCESS', canAsk: true, expiresAt: null, serverTime };
    }

    const manual = account.grants
      .filter((grant) => grant.kind === 'MANUAL' && grant.expiresAt && grant.expiresAt > now)
      .sort((a, b) => (b.expiresAt!.getTime() - a.expiresAt!.getTime()))[0];
    if (manual) {
      return { state: 'MANUAL_ACCESS', canAsk: true, expiresAt: manual.expiresAt!.toISOString(), serverTime };
    }

    const subscription = account.subscription;
    if (subscription?.status === 'ACTIVE') {
      return { state: 'PAID_ACTIVE', canAsk: true, expiresAt: subscription.currentPeriodEnd?.toISOString() ?? null, serverTime };
    }
    if (subscription?.status === 'PAST_DUE') {
      return { state: 'PAST_DUE', canAsk: false, expiresAt: subscription.currentPeriodEnd?.toISOString() ?? null, serverTime };
    }

    if (account.trialEndsAt && account.trialEndsAt > now) {
      return { state: 'TRIAL_ACTIVE', canAsk: true, expiresAt: account.trialEndsAt.toISOString(), serverTime };
    }
    if (subscription?.status === 'CANCELLED') {
      return { state: 'CANCELLED', canAsk: false, expiresAt: subscription.currentPeriodEnd?.toISOString() ?? null, serverTime };
    }
    if (account.trialEndsAt) {
      return { state: 'TRIAL_EXPIRED', canAsk: false, expiresAt: account.trialEndsAt.toISOString(), serverTime };
    }
    return { state: 'REGISTRATION_REQUIRED', canAsk: false, expiresAt: null, serverTime };
  }

  /** То же решение, но по идентификатору аккаунта: нужно кабинету оператора. */
  async resolveEntitlementByAccount(accountId: string, now: Date = new Date()): Promise<GektaEntitlement> {
    const account = await this.prisma.gektaAccount.findUnique({ where: { id: accountId }, select: { userId: true } });
    if (!account) {
      return { state: 'REGISTRATION_REQUIRED', canAsk: false, expiresAt: null, serverTime: now.toISOString() };
    }
    return this.resolveEntitlement(account.userId, now);
  }

  /** Завершённый ответ — единственное, что увеличивает счётчик. */
  async recordCompletedAnswer(accountId: string, now: Date = new Date()) {
    const usage = await this.prisma.gektaUsage.findUnique({ where: { accountId } });
    if (!usage) {
      return this.prisma.gektaUsage.create({
        data: { accountId, completedAnswers: BigInt(1), answersToday: 1, todayResetAt: now, lastAnswerAt: now },
      });
    }
    const sameDay = usage.todayResetAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    return this.prisma.gektaUsage.update({
      where: { accountId },
      data: {
        completedAnswers: { increment: 1 },
        answersToday: sameDay ? { increment: 1 } : 1,
        todayResetAt: sameDay ? usage.todayResetAt : now,
        lastAnswerAt: now,
      },
    });
  }

  /** Ручной доступ всегда выдаётся конкретному accountId, не телефону. */
  async grantManualAccess(input: {
    accountId: string;
    kind: ManualGrantKind;
    until?: Date | null;
    grantedBy: string;
    reason: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const expiresAt = input.kind === 'LIFETIME'
      ? null
      : input.kind === 'UNTIL_DATE'
        ? input.until ?? null
        : new Date(now.getTime() + (input.kind === 'DAYS_7' ? 7 : 30) * DAY_MS);

    if (input.kind !== 'LIFETIME' && !expiresAt) {
      throw new Error('a dated manual grant requires an expiry');
    }

    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.gektaEntitlementGrant.create({
        data: {
          accountId: input.accountId,
          kind: input.kind === 'LIFETIME' ? 'LIFETIME' : 'MANUAL',
          expiresAt,
          grantedBy: input.grantedBy,
          reason: input.reason.slice(0, 500),
        },
      });
      if (input.kind === 'LIFETIME') {
        await tx.gektaAccount.update({ where: { id: input.accountId }, data: { lifetimeAccess: true } });
      }
      return grant;
    });
  }

  /**
   * Отзыв не удаляет запись: история выданного доступа должна оставаться
   * проверяемой, поэтому грант помечается отозванным.
   */
  async revokeGrant(grantId: string, revokedBy: string, now: Date = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.gektaEntitlementGrant.update({
        where: { id: grantId },
        data: { revokedAt: now, revokedBy },
      });
      if (grant.kind === 'LIFETIME') {
        const remaining = await tx.gektaEntitlementGrant.count({
          where: { accountId: grant.accountId, kind: 'LIFETIME', revokedAt: null },
        });
        if (remaining === 0) {
          await tx.gektaAccount.update({ where: { id: grant.accountId }, data: { lifetimeAccess: false } });
        }
      }
      return grant;
    });
  }

  async extendTrial(accountId: string, days: number, now: Date = new Date()) {
    const account = await this.prisma.gektaAccount.findUniqueOrThrow({ where: { id: accountId } });
    const base = account.trialEndsAt && account.trialEndsAt > now ? account.trialEndsAt : now;
    return this.prisma.gektaAccount.update({
      where: { id: accountId },
      data: { trialEndsAt: new Date(base.getTime() + days * DAY_MS) },
    });
  }

  async setSuspended(accountId: string, suspended: boolean, reason: string, now: Date = new Date()) {
    return this.prisma.gektaAccount.update({
      where: { id: accountId },
      data: {
        suspended,
        suspendedAt: suspended ? now : null,
        suspendReason: suspended ? reason.slice(0, 500) : null,
      },
    });
  }

  /** Сброс ошибочно исчерпанного лимита. Историю ответов не стирает. */
  async resetDailyQuota(accountId: string, now: Date = new Date()) {
    return this.prisma.gektaUsage.update({
      where: { accountId },
      data: { answersToday: 0, todayResetAt: now },
    });
  }
}
