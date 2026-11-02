import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BusinessReputationService } from './business-reputation.service';
import { ReputationBatchDto, REPUTATION_BATCH_MAX } from './dto/reputation-batch.dto';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * V2.2.1/V2.2.2/V15.3.6 на пакетном запросе деловой репутации.
 *
 * Замерено на живом сервисе ДО правки:
 *
 *   orgIds ['__proto__','constructor','org-1'] → собственные ключи ответа
 *       ["constructor","org-1"]; Object.hasOwn(результат,'__proto__') = false;
 *       getPrototypeOf(результат) !== Object.prototype — прототип ПОДМЕНЁН
 *   orgIds длиной 20 000 → принято, 40 000 обращений к БД в одном запросе
 *   orgIds [{}, null, 42] → ключи ['42','[object Object]','null']
 *
 * Тест гоняет НАСТОЯЩИЙ сервис со стабом prisma. Первый стаб был неверен
 * (findUnique вместо findFirst) и потому ничего не измерял — исправлен до
 * того, как из замера сделали вывод.
 */

const USER = { id: 'u1', role: Role.ADMIN, orgId: 'o1', tenantId: 't1' } as RequestUser;

function service(counter = { calls: 0 }) {
  const prisma = {
    deal: { findMany: async () => { counter.calls += 1; return []; } },
    dispute: { count: async () => 0, findMany: async () => [] },
    organization: { findFirst: async () => ({ id: 'x', tenantId: 't1', kycStatus: 'APPROVED', amlStatus: 'CLEAR' }) },
  };
  return new BusinessReputationService(prisma as never);
}

async function errorsFor(payload: unknown): Promise<string[]> {
  const result = await validate(plainToInstance(ReputationBatchDto, payload) as object, { whitelist: true });
  return result.flatMap((item) => Object.keys(item.constraints ?? {}));
}

describe('граница пакета репутации', () => {
  it('пропускает обычный пакет', async () => {
    expect(await errorsFor({ orgIds: ['org-1', 'org-2'] })).toEqual([]);
  });

  it('отвергает пакет сверх границы', async () => {
    const ids = Array.from({ length: REPUTATION_BATCH_MAX + 1 }, (_, i) => `org-${i}`);
    expect(await errorsFor({ orgIds: ids })).toContain('arrayMaxSize');
  });

  it('отвергает пустой пакет и не-массив', async () => {
    expect(await errorsFor({ orgIds: [] })).toContain('arrayNotEmpty');
    expect(await errorsFor({ orgIds: 'org-1' })).toContain('arrayMaxSize');
  });

  it('отвергает элементы, которые не строки', async () => {
    expect(await errorsFor({ orgIds: [{ evil: 1 }] })).toContain('isString');
    expect(await errorsFor({ orgIds: [42] })).toContain('isString');
    expect(await errorsFor({ orgIds: [null] })).toContain('isString');
  });

  it('отвергает слишком длинный идентификатор', async () => {
    expect(await errorsFor({ orgIds: ['x'.repeat(129)] })).toContain('maxLength');
  });
});

describe('сервис пакета репутации отказывает и в обход границы', () => {
  it('ключ __proto__ становится СОБСТВЕННЫМ свойством и прототип не подменяется', async () => {
    const result = await service().getScoreBatch(['__proto__', 'org-1'], USER);
    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.keys(result).sort()).toEqual(['__proto__', 'org-1']);
  });

  it('запись по ключу __proto__ переживает JSON, а не исчезает', async () => {
    const result = await service().getScoreBatch(['__proto__'], USER);
    const roundTripped = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    expect(Object.hasOwn(roundTripped, '__proto__')).toBe(true);
  });

  it('constructor тоже остаётся собственным ключом', async () => {
    const result = await service().getScoreBatch(['constructor', 'valueOf'], USER);
    expect(Object.keys(result).sort()).toEqual(['constructor', 'valueOf']);
  });

  it('пакет сверх границы отвергается сервисом, а не выполняется', async () => {
    const counter = { calls: 0 };
    const ids = Array.from({ length: REPUTATION_BATCH_MAX + 1 }, (_, i) => `org-${i}`);
    await expect(service(counter).getScoreBatch(ids, USER)).rejects.toThrow(/ограничен/u);
    expect(counter.calls).toBe(0);
  });

  it('элемент, который не строка, отвергается', async () => {
    await expect(service().getScoreBatch([{ evil: 1 }] as never, USER)).rejects.toThrow(/должен быть строкой/u);
    await expect(service().getScoreBatch('org-1' as never, USER)).rejects.toThrow(/массивом/u);
  });

  it('обычный пакет по-прежнему работает и форма ответа не изменилась', async () => {
    const result = await service().getScoreBatch(['org-1', 'org-2'], USER);
    expect(Object.keys(result).sort()).toEqual(['org-1', 'org-2']);
    expect(result['org-1']).toHaveProperty('tier');
    expect(JSON.parse(JSON.stringify(result))['org-2']).toHaveProperty('orgId', 'org-2');
  });

  it('граница тенанта не тронута', async () => {
    await expect(service().getScoreBatch(['org-1'], { ...USER, tenantId: undefined } as RequestUser))
      .rejects.toThrow();
  });
});
