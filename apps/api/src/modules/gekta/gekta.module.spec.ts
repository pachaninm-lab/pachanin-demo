import { Test } from '@nestjs/testing';
import { GektaModule } from './gekta.module';
import { GektaOperatorGuard } from './gekta-operator.guard';

/**
 * Граф модуля поднимается целиком.
 *
 * Дефект внедрения зависимостей не виден ни одной другой проверкой: юнит-тесты
 * создают guard и сервисы через `new`, а typecheck не читает метаданных
 * `design:paramtypes`. Так уже случилось однажды — зависимость guard была
 * объявлена структурным типом, TypeScript записал в метаданные `Object`, Nest
 * не нашёл такой провайдер, приложение не стартовало, поды grainflow-api не
 * прошли readiness и приёмка Kubernetes упала с «initial application rollout
 * failed». Все проверки PR при этом были зелёными.
 *
 * Этот тест делает такую ошибку видимой в CI, а не на выкатке.
 */
describe('GektaModule wiring', () => {
  it('resolves every provider, controller and guard it declares', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [GektaModule] }).compile();
    expect(moduleRef.get(GektaOperatorGuard, { strict: false })).toBeInstanceOf(GektaOperatorGuard);
    await moduleRef.close();
  }, 60_000);
});
