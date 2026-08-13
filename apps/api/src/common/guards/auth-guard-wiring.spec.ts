import { Test } from '@nestjs/testing';
import { AuthModule } from '../../modules/auth/auth.module';
import { StaffAccessModule } from '../../modules/staff-access/staff-access.module';
import { AppAuthGuard } from './auth.guard';

jest.setTimeout(30_000);

/**
 * Глобальный guard собирается Nest'ом по метаданным конструктора, а не
 * вызовом new. Юнит-тест с ручным конструированием и typecheck этого не
 * видят: неразрешимая зависимость проявляется только при сборке графа — и
 * тогда приложение не стартует, а pod никогда не становится ready.
 *
 * Модули здесь ровно те, из которых AppModule берёт зависимости guard'а.
 */
describe('AppAuthGuard wiring', () => {
  it('resolves every dependency the application injector must provide', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, StaffAccessModule],
      providers: [AppAuthGuard],
    }).compile();
    try {
      expect(moduleRef.get(AppAuthGuard)).toBeInstanceOf(AppAuthGuard);
    } finally {
      await moduleRef.close();
    }
  });
});
