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

  async function expectDirectMutationDenied(
    actor: RequestUser,
    dealId: string,
    triggerPattern: RegExp,
  ): Promise<void> {
    let denied = false;
    try {
      const changed = await instance.rls.withTrustedContext(actor, (tx) =>
        tx.$executeRaw(Prisma.sql`
          UPDATE settlement.payments
          SET confirmed_reserved_minor = confirmed_reserved_minor + 1,
              version = version + 1
          WHERE deal_id = ${dealId}
        `),
      );
      denied = changed === 0;
    } catch (error) {
      denied = triggerPattern.test(String((error as Error)?.message ?? error));
    }
    expect(denied).toBe(true);

    const payment = await instance.prisma.$queryRaw<
      Array<{ confirmedReserved: bigint; version: bigint }>
    >(Prisma.sql`
      SELECT confirmed_reserved_minor AS "confirmedReserved", version
      FROM settlement.payments
      WHERE deal_id = ${dealId}
    `);
    expect(payment).toEqual([{ confirmedReserved: 0n, version: 0n }]);
  }

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

    await expectDirectMutationDenied(
      fixture.users.accounting,
      fixture.dealId,
      /only an exact verified bank callback may change confirmed money|row-level security|permission denied/i,
    );
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

    await expectDirectMutationDenied(
      fakeCallback,
      fixture.dealId,
      /lacks exact transaction binding|row-level security|permission denied/i,
    );
  });
});
