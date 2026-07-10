import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthPrismaService } from './auth-prisma.service';
import { PersistentAuthRepository } from './persistent-auth.repository';

jest.setTimeout(10_000);

describe('AuthModule database wiring', () => {
  it('binds PersistentAuthRepository exclusively to AuthPrismaService', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    try {
      const repository = moduleRef.get(PersistentAuthRepository);
      const authPrisma = moduleRef.get(AuthPrismaService);
      expect(repository.prisma).toBe(authPrisma);
      expect(repository.prisma).toBeInstanceOf(AuthPrismaService);
    } finally {
      await moduleRef.close();
    }
  });
});
