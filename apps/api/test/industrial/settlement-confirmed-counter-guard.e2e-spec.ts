import { Prisma } from '@prisma/client';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { cleanTenant, destroyInstance, provisionDeal } from './harness';
import {
  createSettlementInstance,
  type SettlementServiceInstance,
} from './settlement-harness';

jest.setTimeout(180_000);

describe('Settlement confirmed counter substitution guard', () => {
  let instance: SettlementServiceInstance;

  beforeAll(async () => {
    instance = await createSettlementInstance();
    await cleanTenant(instance.prisma);
  });

  afterAll(async () => {
    await cleanTenant(instance.prisma);
    await destroyInstance(instance);
  });

  it('rejects direct confirmed reserve substitution by a human participant', async () => {
    const fixture = await provisionDeal(instance.prisma, 'confirmed-human', 100_000n);
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

    await expect(instance.rls.withTrustedContext(fixture.users.accounting, (tx) =>
      tx.$executeRaw(Prisma.sql`
        UPDATE settlement.payments
        SET confirmed_reserved_minor = confirmed_reserved_minor + 1,
            version = version + 1
        WHERE deal_id = ${fixture.dealId}
      `),
    )).rejects.toThrow(/only an exact verified bank callback may change confirmed money/);

    const payment = await instance.rls.withTrustedContext(fixture.users.accounting, (tx) =>
      tx.$queryRaw<Array<{ confirmedReserved: bigint; version: bigint }>>(Prisma.sql`
        SELECT confirmed_reserved_minor AS "confirmedReserved", version
        FROM settlement.payments
        WHERE deal_id = ${fixture.dealId}
      `),
    );
    expect(payment).toEqual([{ confirmedReserved: 0n, version: 0n }]);
  });

  it('rejects BANK_CALLBACK identity without an exact validated callback insert', async () => {
    const fixture = await provisionDeal(instance.prisma, 'confirmed-callback', 100_000n);
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

    const fakeCallback: RequestUser = {
      id: 'bank-callback:forged',
      email: 'bank-callback-forged@system.invalid',
      role: Role.BANK_CALLBACK,
      orgId: fixture.buyerOrgId,
      tenantId: fixture.users.accounting.tenantId,
      sessionId: 'bank-event:forged',
      mfaVerified: true,
      mfaVerifiedAt: new Date().toISOString(),
    };

    await expect(instance.rls.withTrustedContext(fakeCallback, (tx) =>
      tx.$executeRaw(Prisma.sql`
        UPDATE settlement.payments
        SET confirmed_reserved_minor = confirmed_reserved_minor + 1,
            version = version + 1
        WHERE deal_id = ${fixture.dealId}
      `),
    )).rejects.toThrow(/lacks exact transaction binding/);

    const payment = await instance.rls.withTrustedContext(fixture.users.accounting, (tx) =>
      tx.$queryRaw<Array<{ confirmedReserved: bigint; version: bigint }>>(Prisma.sql`
        SELECT confirmed_reserved_minor AS "confirmedReserved", version
        FROM settlement.payments
        WHERE deal_id = ${fixture.dealId}
      `),
    );
    expect(payment).toEqual([{ confirmedReserved: 0n, version: 0n }]);
  });
});
