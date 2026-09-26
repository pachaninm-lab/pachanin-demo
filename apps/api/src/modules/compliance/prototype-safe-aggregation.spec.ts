/**
 * Накопители, ключ которых приходит из данных.
 *
 * Имя адаптера берётся из записи события интеграции и попадало ключом в
 * объектный литерал. У литерала `!acc['toString']` ложно — там лежит
 * унаследованная функция, — поэтому ветка инициализации не срабатывала и
 * счётчик писался в член прототипа. Запись `acc['__proto__'] = …` собственного
 * свойства не создаёт вовсе, и адаптер с таким именем пропадал из ответа.
 *
 * Тесты гоняют НАСТОЯЩИЕ сервисы со стабом prisma. Копия логики рядом с
 * сервисом проходила бы и после того, как сервис вернут к литералу.
 *
 * Та же правка в отчёте 29-СХ (exports.service) здесь не проверяется: она
 * вынесена в #5135, где у неё свой тест.
 */
import { RequestUser, Role } from '../../common/types/request-user';
import { ComplianceService } from './compliance.service';
import { IntegrationEventsService } from '../integration-events/integration-events.service';

const user = { id: 'u1', role: Role.ADMIN, tenantId: 't1' } as unknown as RequestUser;

describe('статистика адаптеров в compliance: форма ответа сохранена, данные не теряются', () => {
  it('имя адаптера, совпадающее с членом прототипа, остаётся отдельной записью', async () => {
    const events = [
      { adapterName: 'fns', status: 'SUCCESS', createdAt: new Date('2026-01-01T00:00:00Z') },
      { adapterName: '__proto__', status: 'SUCCESS', createdAt: new Date('2026-01-02T00:00:00Z') },
      { adapterName: '__proto__', status: 'ERROR', createdAt: new Date('2026-01-03T00:00:00Z') },
      { adapterName: 'toString', status: 'ERROR', createdAt: new Date('2026-01-04T00:00:00Z') },
    ];
    const prisma = { integrationEvent: { findMany: async () => events } };
    const service = new (ComplianceService as unknown as new (...args: unknown[]) => {
      getIntegrationStatus(user: RequestUser): Promise<Record<string, { ok: number; error: number }>>;
    })(prisma, {}, {});

    const status = await service.getIntegrationStatus(user);

    expect(Object.hasOwn(status, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(status)).toBe(Object.prototype);
    expect(status['__proto__']).toEqual(expect.objectContaining({ ok: 1, error: 1 }));
    expect(status['toString']).toEqual(expect.objectContaining({ ok: 0, error: 1 }));
    expect(status['fns']).toEqual(expect.objectContaining({ ok: 1, error: 0 }));

    // Ответ обязан пережить сериализацию: именно на ней литерал терял запись.
    const serialized = JSON.parse(JSON.stringify(status));
    expect(serialized['__proto__']).toEqual(expect.objectContaining({ ok: 1, error: 1 }));
  });
});

describe('статистика адаптеров в integration-events: то же на втором сайте', () => {
  it('счётчики и среднее время верны для имён, совпадающих с членами прототипа', async () => {
    const events = [
      { adapterName: 'fns', status: 'SUCCESS', durationMs: 100 },
      { adapterName: '__proto__', status: 'SUCCESS', durationMs: 10 },
      { adapterName: '__proto__', status: 'ERROR', durationMs: 30 },
      { adapterName: 'constructor', status: 'ERROR', durationMs: 50 },
      { adapterName: 'hasOwnProperty', status: 'SUCCESS', durationMs: 7 },
    ];
    const prisma = { integrationEvent: { findMany: async () => events } };
    const service = new IntegrationEventsService(prisma as never);

    const stats = await service.getStats();

    expect(Object.getPrototypeOf(stats)).toBe(Object.prototype);
    expect(Object.keys(stats).sort()).toEqual(['__proto__', 'constructor', 'fns', 'hasOwnProperty']);
    expect(stats['__proto__']).toEqual({ total: 2, ok: 1, error: 1, avgMs: 20 });
    expect(stats['constructor']).toEqual({ total: 1, ok: 0, error: 1, avgMs: 50 });
    expect(stats['hasOwnProperty']).toEqual({ total: 1, ok: 1, error: 0, avgMs: 7 });
    expect(stats['fns']).toEqual({ total: 1, ok: 1, error: 0, avgMs: 100 });

    const serialized = JSON.parse(JSON.stringify(stats));
    expect(serialized['__proto__']).toEqual({ total: 2, ok: 1, error: 1, avgMs: 20 });
  });
});

describe('граница API', () => {
  it('Object.fromEntries сохраняет унаследованные имена собственным свойством', () => {
    // На этом держится возврат обоих сервисов: форма ответа остаётся объектом,
    // но данные больше не проваливаются в прототип.
    const restored = Object.fromEntries(new Map([['__proto__', 7], ['ok', 1]]));
    expect(Object.hasOwn(restored, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(restored)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(restored))['__proto__']).toBe(7);

    const literal: Record<string, number> = {};
    literal['__proto__'] = 7;
    expect(Object.hasOwn(literal, '__proto__')).toBe(false);
    expect(JSON.stringify(literal)).toBe('{}');
  });
});
