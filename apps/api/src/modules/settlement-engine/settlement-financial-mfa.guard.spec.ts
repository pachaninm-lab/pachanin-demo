import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import { Role } from '../../common/types/request-user';
import { SettlementFinancialMfaGuard } from './settlement-financial-mfa.guard';

function user(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    orgId: 'org-1',
    tenantId: 'tenant-1',
    sessionId: 'session-1',
    role: Role.ACCOUNTING,
    email: 'accounting@example.invalid',
    mfaVerified: true,
    mfaVerifiedAt: new Date().toISOString(),
    ...overrides,
  };
}

function context(actor?: RequestUser): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: actor }),
    }),
  } as unknown as ExecutionContext;
}

describe('SettlementFinancialMfaGuard', () => {
  const guard = new SettlementFinancialMfaGuard();

  it('allows only recent server-derived MFA', () => {
    expect(guard.canActivate(context(user()))).toBe(true);
  });

  it.each([
    undefined,
    user({ mfaVerified: false }),
    user({ mfaVerified: true, mfaVerifiedAt: undefined }),
    user({ mfaVerifiedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString() }),
    user({ mfaVerifiedAt: new Date(Date.now() + 60_000).toISOString() }),
  ])('fails closed for absent, false, missing, stale or future MFA evidence', (actor) => {
    expect(() => guard.canActivate(context(actor)))
      .toThrow(ForbiddenException);
  });
});
