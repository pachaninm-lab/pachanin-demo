import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';

@Injectable()
export class SettlementAccessService {
  constructor(private readonly rls: RlsTransactionService) {}

  async assertDealAccess(
    dealId: string,
    user: RequestUser,
    write: boolean,
  ): Promise<void> {
    await this.rls.withTrustedContext(user, async (tx, context) => {
      const deals = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT deal."id"
        FROM public."deals" deal
        WHERE deal."id" = ${dealId}
          AND deal."tenantId" = ${context.tenantId}
        LIMIT 1
      `);
      if (!deals[0]) {
        throw new ForbiddenException({
          code: write
            ? 'SETTLEMENT_DEAL_WRITE_SCOPE_DENIED'
            : 'SETTLEMENT_DEAL_READ_SCOPE_DENIED',
          dealId,
        });
      }

      const participants = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT participant."id"
        FROM public."deal_participants" participant
        WHERE participant."dealId" = ${dealId}
          AND participant."tenantId" = ${context.tenantId}
          AND participant."organizationId" = ${context.orgId}
          AND participant."userId" = ${context.userId}
          AND participant."role" = ${context.role}
          AND participant."status" = 'ACTIVE'
          AND participant."accessLevel" IN (
            ${write ? 'WORK' : 'READ'},
            ${write ? 'APPROVE' : 'WORK'},
            'APPROVE'
          )
        LIMIT 1
      `);
      if (!participants[0]) {
        throw new ForbiddenException({
          code: write
            ? 'SETTLEMENT_DEAL_WRITE_SCOPE_DENIED'
            : 'SETTLEMENT_DEAL_READ_SCOPE_DENIED',
          dealId,
        });
      }
    });
  }

  async assertPaymentAccess(
    paymentId: string,
    user: RequestUser,
    write: boolean,
  ): Promise<void> {
    const dealId = await this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ dealId: string }>>(Prisma.sql`
        SELECT payment.deal_id AS "dealId"
        FROM settlement.payments payment
        WHERE payment.id = ${paymentId}
        LIMIT 1
      `);
      if (!rows[0]) {
        throw new ForbiddenException({
          code: write
            ? 'SETTLEMENT_PAYMENT_WRITE_SCOPE_DENIED'
            : 'SETTLEMENT_PAYMENT_READ_SCOPE_DENIED',
          paymentId,
        });
      }
      return rows[0].dealId;
    });
    await this.assertDealAccess(dealId, user, write);
  }

  async filterReadablePayments<T extends { dealId?: unknown }>(
    rows: readonly T[],
    user: RequestUser,
  ): Promise<T[]> {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const allowed = await tx.$queryRaw<Array<{ dealId: string }>>(Prisma.sql`
        SELECT participant."dealId" AS "dealId"
        FROM public."deal_participants" participant
        WHERE participant."tenantId" = ${context.tenantId}
          AND participant."organizationId" = ${context.orgId}
          AND participant."userId" = ${context.userId}
          AND participant."role" = ${context.role}
          AND participant."status" = 'ACTIVE'
          AND participant."accessLevel" IN ('READ','WORK','APPROVE')
      `);
      const allowedIds = new Set(allowed.map((item) => item.dealId));
      return rows.filter((item) => typeof item.dealId === 'string' && allowedIds.has(item.dealId));
    });
  }
}
