import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Кабинет владельца и поддержки.
 *
 * Метрики считаются по фактическим записям: ни одно число здесь не выдумано и
 * не подставлено по умолчанию. Пустая база честно показывает нули.
 */
@Injectable()
export class GektaOperatorService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics(now: Date = new Date()) {
    const day = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const [
      total, today, week, month,
      trialActive, trialExpired, lifetime, suspended,
      paidActive, pastDue, cancelled,
      manualActive, conversations, projects, usage,
    ] = await this.prisma.$transaction([
      this.prisma.gektaAccount.count(),
      this.prisma.gektaAccount.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.gektaAccount.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * day) } } }),
      this.prisma.gektaAccount.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * day) } } }),
      this.prisma.gektaAccount.count({ where: { suspended: false, lifetimeAccess: false, trialEndsAt: { gt: now } } }),
      this.prisma.gektaAccount.count({ where: { suspended: false, lifetimeAccess: false, trialEndsAt: { lte: now } } }),
      this.prisma.gektaAccount.count({ where: { lifetimeAccess: true } }),
      this.prisma.gektaAccount.count({ where: { suspended: true } }),
      this.prisma.gektaSubscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.gektaSubscription.count({ where: { status: 'PAST_DUE' } }),
      this.prisma.gektaSubscription.count({ where: { status: 'CANCELLED' } }),
      this.prisma.gektaEntitlementGrant.count({ where: { kind: 'MANUAL', revokedAt: null, expiresAt: { gt: now } } }),
      this.prisma.gektaConversation.count({ where: { deletedAt: null } }),
      this.prisma.gektaProject.count({ where: { deletedAt: null } }),
      this.prisma.gektaUsage.aggregate({ _sum: { completedAnswers: true } }),
    ]);

    const completedAnswers = Number(usage._sum.completedAnswers ?? BigInt(0));
    return {
      accounts: { total, today, last7Days: week, last30Days: month },
      entitlement: { trialActive, trialExpired, paidActive, pastDue, cancelled, manualActive, lifetime, suspended },
      activity: { completedAnswers, conversations, projects },
      // Конверсия в платный тариф появляется только вместе с реальными платежами.
      conversion: {
        trialToPaid: trialActive + trialExpired > 0 ? paidActive / (trialActive + trialExpired) : null,
      },
      serverTime: now.toISOString(),
    };
  }

  async findAccountByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, gektaAccount: { select: { id: true } } },
    });
    return user?.gektaAccount ? [{ accountId: user.gektaAccount.id, userId: user.id }] : [];
  }

  /** Метаданные аккаунта. Содержание диалогов сюда не попадает никогда. */
  async accountSummary(accountId: string, now: Date = new Date()) {
    const account = await this.prisma.gektaAccount.findUnique({
      where: { id: accountId },
      include: {
        user: { select: { id: true, email: true, createdAt: true, mfaEnabled: true } },
        usage: true,
        subscription: true,
        phoneIdentity: { select: { state: true, declaredAt: true, verifiedAt: true } },
        grants: { orderBy: { grantedAt: 'desc' }, take: 20 },
        _count: { select: { conversations: true, projects: true } },
      },
    });
    if (!account) return null;

    return {
      accountId: account.id,
      userId: account.user.id,
      email: account.user.email,
      registeredAt: account.user.createdAt.toISOString(),
      mfaEnabled: account.user.mfaEnabled,
      phoneState: account.phoneIdentity?.state ?? null,
      trial: {
        startedAt: account.trialStartedAt?.toISOString() ?? null,
        endsAt: account.trialEndsAt?.toISOString() ?? null,
        active: Boolean(account.trialEndsAt && account.trialEndsAt > now),
      },
      subscriptionStatus: account.subscription?.status ?? 'NONE',
      lifetimeAccess: account.lifetimeAccess,
      suspended: account.suspended,
      usage: {
        completedAnswers: Number(account.usage?.completedAnswers ?? BigInt(0)),
        answersToday: account.usage?.answersToday ?? 0,
      },
      counts: { conversations: account._count.conversations, projects: account._count.projects },
      grants: account.grants.map((grant) => ({
        id: grant.id,
        kind: grant.kind,
        grantedAt: grant.grantedAt.toISOString(),
        expiresAt: grant.expiresAt?.toISOString() ?? null,
        revokedAt: grant.revokedAt?.toISOString() ?? null,
        reason: grant.reason,
      })),
    };
  }

  /** Каждое изменение доступа фиксируется целиком и неизменяемо. */
  async writeAudit(entry: {
    correlationId: string;
    actorUserId: string;
    actorRoles: readonly string[];
    accountId: string | null;
    phoneLocatorMasked: string | null;
    action: string;
    previousState: string;
    newState: string;
    reason: string;
    expiresAt: Date | null;
    source: string;
  }) {
    return this.prisma.gektaOperatorAudit.create({
      data: {
        correlationId: entry.correlationId,
        actorUserId: entry.actorUserId,
        actorRoles: entry.actorRoles.join(','),
        accountId: entry.accountId,
        phoneLocatorMasked: entry.phoneLocatorMasked,
        action: entry.action,
        previousState: entry.previousState,
        newState: entry.newState,
        reason: entry.reason.slice(0, 500),
        expiresAt: entry.expiresAt,
        source: entry.source,
      },
    });
  }

  async auditTrail(accountId: string, take = 50) {
    return this.prisma.gektaOperatorAudit.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
