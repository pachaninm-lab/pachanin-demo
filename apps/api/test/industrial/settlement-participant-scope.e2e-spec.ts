import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { cleanTenant, destroyInstance, provisionDeal } from './harness';
import {
  createSettlementInstance,
  type SettlementServiceInstance,
} from './settlement-harness';

jest.setTimeout(180_000);

describe('Settlement exact DealParticipant scope', () => {
  let instance: SettlementServiceInstance;

  beforeAll(async () => {
    instance = await createSettlementInstance();
    await cleanTenant(instance.prisma);
  });

  afterAll(async () => {
    await cleanTenant(instance.prisma);
    await destroyInstance(instance);
  });

  it.each([Role.ADMIN, Role.SUPPORT_MANAGER])(
    'denies same-tenant %s without an active DealParticipant row',
    async (role) => {
      const fixture = await provisionDeal(
        instance.prisma,
        `participant-${role.toLowerCase()}`,
        100_000n,
      );
      await instance.settlement.configureTerms({
        commandId: `terms:${fixture.dealId}`,
        idempotencyKey: `terms:${fixture.dealId}`,
        dealId: fixture.dealId,
        reserveAmountKopecks: fixture.totalKopecks,
        beneficiaries: [{
          organizationId: fixture.sellerOrgId,
          role: 'SELLER',
          allocationKopecks: fixture.totalKopecks,
        }],
      }, fixture.users.accounting);

      const outsider: RequestUser = {
        id: `outsider-${role.toLowerCase()}`,
        email: `outsider-${role.toLowerCase()}@industrial-e2e.invalid`,
        role,
        orgId: fixture.serviceOrgId,
        tenantId: fixture.users.accounting.tenantId,
        sessionId: `outsider-session-${role.toLowerCase()}`,
        mfaVerified: true,
        mfaVerifiedAt: new Date().toISOString(),
      };

      await expect(instance.settlement.getWorksheet(fixture.dealId, outsider))
        .rejects.toBeInstanceOf(ForbiddenException);

      const visible = await instance.rls.withTrustedContext(outsider, (tx) =>
        tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM settlement.payments
          WHERE deal_id = ${fixture.dealId}
        `),
      );
      expect(visible[0]?.count ?? 0n).toBe(0n);
    },
  );
});
