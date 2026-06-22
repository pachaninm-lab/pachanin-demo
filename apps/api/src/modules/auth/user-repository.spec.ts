import { Role } from '../../common/types/request-user';
import { RuntimeUserRepository, type StoredUser } from './user.repository';
import { PrismaUserRepository } from './prisma-user.repository';
import { selectUserRepository } from './user-repository.factory';

function seedUser(over: Partial<StoredUser> = {}): StoredUser {
  return { id: 'user-1', email: 'A@Demo.ru', passwordHash: 'hash', role: Role.FARMER, orgId: 'org-1', fullName: 'A', ...over };
}

describe('RuntimeUserRepository (default identity adapter)', () => {
  it('looks up users case-insensitively and isolates internal state', async () => {
    const repo = new RuntimeUserRepository([seedUser()]);
    expect((await repo.findByEmail('a@demo.ru'))?.id).toBe('user-1');
    expect(await repo.findByEmail('missing@demo.ru')).toBeNull();
    const list = await repo.list();
    list[0].fullName = 'mutated';
    expect((await repo.findById('user-1'))?.fullName).toBe('A'); // returned copies, not internal refs
  });

  it('creates users and updates role/org', async () => {
    const repo = new RuntimeUserRepository([]);
    await repo.create(seedUser({ id: 'u2', email: 'b@demo.ru' }));
    expect((await repo.setRole('u2', Role.BUYER)).role).toBe(Role.BUYER);
    expect((await repo.setOrg('u2', 'org-9')).orgId).toBe('org-9');
  });

  it('stores, reads and deletes refresh tokens', async () => {
    const repo = new RuntimeUserRepository([]);
    await repo.saveRefreshToken({ token: 't1', userId: 'u2', expiresAt: Date.now() + 1000 });
    expect((await repo.getRefreshToken('t1'))?.userId).toBe('u2');
    await repo.deleteRefreshToken('t1');
    expect(await repo.getRefreshToken('t1')).toBeNull();
  });
});

describe('PrismaUserRepository (DB-backed identity adapter)', () => {
  it('requires PrismaService — constructing without it fails loudly', () => {
    expect(() => new PrismaUserRepository(undefined)).toThrow(/PrismaService/);
  });

  it('normalises email to lower-case on create and lookup', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      },
    } as any;
    const repo = new PrismaUserRepository(prisma);
    await repo.findByEmail('A@Demo.ru');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@demo.ru' } });
    const created = await repo.create(seedUser({ email: 'B@Demo.ru' }));
    expect(created.email).toBe('b@demo.ru');
  });

  it('maps refresh-token expiry between epoch-ms and Date', async () => {
    const exp = Date.now() + 5000;
    const prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ token: 't', userId: 'u', expiresAt: new Date(exp) }),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const repo = new PrismaUserRepository(prisma);
    await repo.saveRefreshToken({ token: 't', userId: 'u', expiresAt: exp });
    expect(prisma.refreshToken.create.mock.calls[0][0].data.expiresAt).toBeInstanceOf(Date);
    expect((await repo.getRefreshToken('t'))?.expiresAt).toBe(exp);
  });
});

describe('selectUserRepository (no silent Prisma activation)', () => {
  const prisma = { user: {} } as any;
  it('defaults to the runtime adapter when no flag is set', () => {
    expect(selectUserRepository(prisma, undefined)).toBeInstanceOf(RuntimeUserRepository);
  });
  it('keeps the runtime adapter for unrelated flag values', () => {
    expect(selectUserRepository(prisma, 'true')).toBeInstanceOf(RuntimeUserRepository);
  });
  it('selects the Prisma adapter only under the explicit prisma flag', () => {
    expect(selectUserRepository(prisma, 'prisma')).toBeInstanceOf(PrismaUserRepository);
  });
});
