import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import { JwtAuthGuard } from './jwt-auth.guard';

function context(user?: RequestUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard legacy compatibility boundary', () => {
  it('preserves the PostgreSQL-authorized context created by AppAuthGuard', () => {
    const user: RequestUser = {
      id: 'user-1',
      email: 'user@example.test',
      role: Role.BUYER,
      orgId: 'org-1',
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      sessionId: 'session-1',
    };
    expect(new JwtAuthGuard().canActivate(context(user))).toBe(true);
  });

  it('fails closed when the global live-session guard did not provide a complete actor', () => {
    expect(() => new JwtAuthGuard().canActivate(context())).toThrow(UnauthorizedException);
    expect(() => new JwtAuthGuard().canActivate(context({
      id: 'user-1',
      email: 'user@example.test',
      role: Role.BUYER,
      orgId: 'org-1',
    }))).toThrow(UnauthorizedException);
  });
});
