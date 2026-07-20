import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import { CommodityProfileRepository } from './commodity-profile.repository';

type QueryHandler = (query: unknown) => unknown[];
type TrustedContextWork = (tx: { $queryRaw: (query: unknown) => Promise<unknown[]> }) => Promise<unknown>;

function user(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    orgId: 'org-1',
    tenantId: 'tenant-1',
    role: Role.BUYER,
    email: 'user@example.test',
    sessionId: 'session-1',
    membershipId: 'membership-1',
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    canonicalCode: 'WHEAT.FOOD',
    archetype: 'DRY_BULK',
    authoritativeNameRu: 'Пшеница продовольственная',
    displayNameEn: 'Food wheat',
    displayNameZh: null,
    classification: 'INTERNAL',
    version: 4n,
    updatedAt: new Date('2026-07-20T00:00:00.000Z'),
    profileVersionId: 'profile-version-1',
    sequence: 2,
    lifecycle: 'EFFECTIVE',
    sourceStatus: 'VERIFIED',
    effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
    effectiveTo: null,
    contentHash: 'a'.repeat(64),
    content: { quality: [] },
    ...overrides,
  };
}

function repository(handler: QueryHandler) {
  const rls = {
    withTrustedContext: jest.fn(async (_user: RequestUser, work: TrustedContextWork) => work({
      $queryRaw: jest.fn(async (query: unknown) => handler(query)),
    })),
  };
  return { repository: new CommodityProfileRepository(rls as never), rls };
}

describe('CommodityProfileRepository', () => {
  it('returns deterministic read model and server-derived actions', async () => {
    const { repository } = repository(() => [row()]);

    const result = await repository.list(user(), { limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'profile-1',
      version: '4',
      selectedVersion: {
        id: 'profile-version-1',
        lifecycle: 'EFFECTIVE',
        contentHash: 'a'.repeat(64),
      },
    });
    expect(result.items[0]!.actions.some((action) => action.id === 'DEPRECATE')).toBe(true);
  });

  it('filters classified rows for ordinary commercial role', async () => {
    const { repository } = repository(() => [
      row(),
      row({ id: 'profile-secret', classification: 'COMMERCIAL_SECRET' }),
    ]);

    const result = await repository.list(user(), { limit: 20 });

    expect(result.items.map((item) => item.id)).toEqual(['profile-1']);
  });

  it('allows classified rows only through server staff authority', async () => {
    const { repository } = repository(() => [
      row({ id: 'profile-secret', classification: 'COMMERCIAL_SECRET' }),
    ]);

    const result = await repository.list(user({
      role: Role.COMPLIANCE_OFFICER,
      staffRoles: ['COMPLIANCE_CONTROL'],
      mfaVerified: true,
    }));

    expect(result.items).toHaveLength(1);
  });

  it('rejects incomplete trusted identity before querying PostgreSQL', async () => {
    const { repository, rls } = repository(() => [row()]);

    await expect(repository.list(user({ sessionId: undefined }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(rls.withTrustedContext).not.toHaveBeenCalled();
  });

  it('rejects malformed cursor and invalid limits fail closed', async () => {
    const { repository, rls } = repository(() => [row()]);

    await expect(repository.list(user(), { cursor: 'not-json' })).rejects.toBeInstanceOf(RangeError);
    await expect(repository.list(user(), { limit: 101 })).rejects.toBeInstanceOf(RangeError);
    expect(rls.withTrustedContext).not.toHaveBeenCalled();
  });

  it('returns not found when exact version is absent', async () => {
    const { repository } = repository(() => [row({ profileVersionId: null })]);

    await expect(repository.getById(user(), 'profile-1', { versionId: 'missing-version' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies direct classified read to ordinary role', async () => {
    const { repository } = repository(() => [row({ classification: 'CONFIDENTIAL' })]);

    await expect(repository.getById(user(), 'profile-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
