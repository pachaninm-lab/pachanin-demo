import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthPrismaService } from './auth-prisma.service';
import { PersistentAuthRepository } from './persistent-auth.repository';
import { GektaRegistrationController } from './gekta-registration.controller';
import { GektaRegistrationService } from './gekta-registration.service';
import { ProductSessionService } from './product-session.service';

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

  /**
   * Сборка графа — единственная проверка, которая ловит неразрешимую
   * зависимость: юнит-тесты создают классы через new, а typecheck не видит
   * метаданных конструктора. Нерешённый провайдер здесь означает, что
   * приложение не поднимется, а pod никогда не станет ready.
   */
  it('resolves the product session service the global auth guard depends on', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    try {
      expect(moduleRef.get(ProductSessionService)).toBeInstanceOf(ProductSessionService);
      expect(moduleRef.get(GektaRegistrationService)).toBeInstanceOf(GektaRegistrationService);
      expect(moduleRef.get(GektaRegistrationController)).toBeInstanceOf(GektaRegistrationController);
    } finally {
      await moduleRef.close();
    }
  });
});
