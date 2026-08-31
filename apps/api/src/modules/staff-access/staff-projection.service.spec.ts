import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { RequestUser, Role } from '../../common/types/request-user';
import { digestOpaqueAuthToken } from '../auth/opaque-token-authority';
import { StaffProjectionService } from './staff-projection.service';
import { StaffPermission } from './staff-access.types';

describe('StaffProjectionService capability boundary', () => {
  const user: RequestUser = {
    id: 'staff-user',
    email: 'staff@example.test',
    role: Role.ADMIN,
    orgId: 'staff-org',
    tenantId: 'staff-tenant',
    membershipId: 'staff-membership',
    sessionId: 'staff-session',
  };
  const accessContext = {
    accessSessionId: 'access-session',
    staffRole: 'ADMIN',
    effectiveTenantId: 'target-tenant',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  };

  it('keeps cross-tenant identity projections out of the general staff service', () => {
    const source = readFileSync(require.resolve('./staff-access.service'), 'utf8');
    expect(source).not.toMatch(/repository\.prisma\.(?:organization|userOrg|user)\./);
    expect(source).not.toContain('JOIN public.users');
    expect(source).not.toContain('JOIN public.user_orgs');
    expect(source).not.toContain('JOIN public.organizations');
  });

  it('purpose-binds the presented bearer credential before the SQL projection', async () => {
    const queryRaw = jest.fn(async (_query: Prisma.Sql) => []);
    const access = { requirePermission: jest.fn(async () => undefined) };
    const service = new StaffProjectionService({ $queryRaw: queryRaw } as never, access as never);
    const presented = 'sa_v1_test-capability';

    await service.organizationDirectory(user, accessContext as never, presented);

    expect(access.requirePermission).toHaveBeenCalledWith(user, StaffPermission.ORGANIZATION_LIST);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toContain(
      digestOpaqueAuthToken({ purpose: 'staff-access', rawToken: presented }),
    );
  });

  it('rejects an empty capability before querying the staff authority', async () => {
    const queryRaw = jest.fn(async (_query: Prisma.Sql) => []);
    const access = { requirePermission: jest.fn(async () => undefined) };
    const service = new StaffProjectionService({ $queryRaw: queryRaw } as never, access as never);

    await expect(
      service.organizationDirectory(user, accessContext as never, '   '),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
