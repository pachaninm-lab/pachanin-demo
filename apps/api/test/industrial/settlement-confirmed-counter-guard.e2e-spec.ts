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

  async function readPayment(
    verifier: RequestUser,
    dealId: string,
  ): Promise<Array<{ confirmedReserved: bigint; pendingReserved: bigint; version: bigint }>> {
    return instance.rls.withTrustedContext(verifier, (tx) => tx.$queryRaw(Prisma.sql`
      SELECT
        confirmed_reserved_minor AS "confirmedReserved",
        pending_reserved_minor AS "pendingReserved",
        version
      FROM settlement.payments
      WHERE deal_id = ${dealId}
    `));
  }

  async function expectDirectMutationDenied(
    actor: RequestUser,
    verifier: RequestUser,
    dealId: string,
    triggerPattern: RegExp,
  ): Promise<void> {
    const before = await readPayment(verifier, dealId);
    expect(before).toHaveLength(1);
    expect(before[0].pendingReserved).toBeGreaterThan(0n);

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

    const after = await readPayment(verifier, dealId);
    expect(after).toEqual(before);
  }

  async function provisionPendingPayment(suffix: string) {
    const fixture = await provisionDeal(instance.prisma, suffix, 100_000n);
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
    await instance.settlement.requestReserve(fixture.dealId, fixture.users.buyer, {
      commandId: `reserve:${fixture.dealId}`,
      idempotencyKey: `reserve:${fixture.dealId}`,
    });
    return fixture;
  }

  it('rejects direct confirmed reserve substitution by a human participant', async () => {
    const fixture = await provisionPendingPayment('confirmed-human');

    await expectDirectMutationDenied(
      fixture.users.accounting,
      fixture.users.accounting,
      fixture.dealId,
      /only an exact verified bank callback may change confirmed money|row-level security|permission denied/i,
    );
  });

  it('rejects BANK_CALLBACK identity without an exact validated callback insert', async () => {
    const fixture = await provisionPendingPayment('confirmed-callback');

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
      fixture.users.accounting,
      fixture.dealId,
      /lacks exact transaction binding|row-level security|permission denied/i,
    );
  });
});
