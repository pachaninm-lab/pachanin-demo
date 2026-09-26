import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import { SettlementPostgresqlRepository, type ConfigureSettlementTermsInput } from './settlement-postgresql.repository';

const user = {
  id: 'accountant-1', orgId: 'buyer-1', tenantId: 'tenant-1', sessionId: 'session-1',
  role: 'ACCOUNTING',
} as RequestUser;

function input(beneficiary: unknown): ConfigureSettlementTermsInput {
  return {
    commandId: 'terms-command', idempotencyKey: 'terms-key', dealId: 'deal-1',
    reserveAmountKopecks: '100', beneficiaries: [beneficiary],
  } as ConfigureSettlementTermsInput;
}

function beneficiary(priority?: unknown) {
  return { organizationId: 'seller-1', role: 'SELLER', allocationKopecks: '100', priority };
}

function repository() {
  const reachedTransaction = new Error('Reached trusted transaction boundary');
  const withTrustedContext = jest.fn().mockRejectedValue(reachedTransaction);
  return {
    instance: new SettlementPostgresqlRepository({} as any, { withTrustedContext } as any),
    withTrustedContext,
    reachedTransaction,
  };
}

describe('Settlement terms reject malformed beneficiaries before database access', () => {
  it.each([null, undefined, [], 'seller', 1, true])('rejects non-object beneficiary %p', async (value) => {
    const { instance, withTrustedContext } = repository();
    await expect(instance.configureTerms(input(value), user)).rejects.toMatchObject({
      response: { code: 'INVALID_SETTLEMENT_BENEFICIARY', index: 0 },
    });
    expect(withTrustedContext).not.toHaveBeenCalled();
  });

  it.each([2_147_483_648, Number.MAX_SAFE_INTEGER, -1, 0.5, '1', true, Number.NaN, Infinity])(
    'rejects priority outside the PostgreSQL integer contract: %p', async (priority) => {
      const { instance, withTrustedContext } = repository();
      await expect(instance.configureTerms(input(beneficiary(priority)), user)).rejects.toMatchObject({
        response: { code: 'INVALID_BENEFICIARY_PRIORITY', index: 0 },
      });
      expect(withTrustedContext).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null, 0, 1, 2_147_483_647])('accepts valid/default priority %p', async (priority) => {
    const { instance, withTrustedContext, reachedTransaction } = repository();
    await expect(instance.configureTerms(input(beneficiary(priority)), user)).rejects.toBe(reachedTransaction);
    expect(withTrustedContext).toHaveBeenCalledTimes(1);
  });

  it('returns an HTTP 400 exception for null rather than an unhandled TypeError', async () => {
    const { instance, withTrustedContext } = repository();
    await expect(instance.configureTerms(input(null), user)).rejects.toBeInstanceOf(BadRequestException);
    expect(withTrustedContext).not.toHaveBeenCalled();
  });
  it('retains role denial before inspecting malformed beneficiaries', async () => {
    const { instance, withTrustedContext } = repository();
    await expect(instance.configureTerms(input(null), { ...user, role: 'FARMER' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(withTrustedContext).not.toHaveBeenCalled();
  });

});
