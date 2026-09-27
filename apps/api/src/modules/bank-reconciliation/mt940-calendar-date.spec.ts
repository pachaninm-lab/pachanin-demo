import { BankReconciliationService } from './bank-reconciliation.service';
import { RequestUser, Role } from '../../common/types/request-user';

const user = { id: 'u1', role: Role.ADMIN, organizationId: 'o1', tenantId: 't1' } as unknown as RequestUser;

function build() {
  const created: Array<Record<string, unknown>> = [];
  const prisma = {
    bankStatementEntry: {
      create: async (args: { data: Record<string, unknown> }) => { created.push(args.data); return args.data; },
      findUnique: async () => null,
      findMany: async () => [],
      update: async (a: unknown) => a,
    },
    bankOperation: { findFirst: async () => null },
    deal: { findUnique: async () => null },
    reconciliationRun: { create: async () => ({ id: 'run-1' }), findMany: async () => [] },
    reconciliationCursor: { upsert: async (a: unknown) => a, findUnique: async () => null },
  };
  return { service: new BankReconciliationService(prisma as never), created };
}

const statement = (yymmdd: string, ref: string) => [
  ':60F:260101',
  `:61:${yymmdd}C100,00NREF${ref}`,
  ':86:Плательщик: ООО Ромашка ИНН: 7701234567',
].join('\n');

describe('MT940: шесть цифр — ещё не дата', () => {
  it('невозможная дата больше не даёт Invalid Date в записи', async () => {
    // Замерено до исправления: строка импортировалась с valueDate = Invalid Date,
    // а запись такой даты в колонку DateTime — отказ БД, то есть 500 на выписке.
    const { service, created } = build();
    const result = await service.importMT940(statement('269999', 'REF-BAD'), user);
    expect(result.rejected).toBe(1);
    expect(result.imported).toBe(0);
    expect(created).toHaveLength(0);
  });

  it('30 февраля больше не превращается молча во 2 марта', async () => {
    // Замерено до исправления: 260230 давало valueDate 2026-03-02 без единой
    // ошибки. Сверка идёт в том числе по датам, и строка уезжала на два дня.
    const { service, created } = build();
    const result = await service.importMT940(statement('260230', 'REF-ROLL'), user);
    expect(result.rejected).toBe(1);
    expect(created).toHaveLength(0);
  });

  it('31 апреля и нулевые месяц/день отвергаются', async () => {
    for (const bad of ['260431', '260001', '260100', '261301']) {
      const { service } = build();
      const result = await service.importMT940(statement(bad, `REF-${bad}`), user);
      expect(result.rejected).toBe(1);
    }
  });

  it('настоящая дата проходит и записывается ровно такой, какой пришла', async () => {
    const { service, created } = build();
    const result = await service.importMT940(statement('260115', 'REF-OK'), user);
    expect(result.rejected).toBe(0);
    expect(result.imported).toBe(1);
    expect((created[0].valueDate as Date).toISOString().slice(0, 10)).toBe('2026-01-15');
  });

  it('29 февраля високосного года — законная дата, а не ошибка', async () => {
    const { service, created } = build();
    const result = await service.importMT940(statement('240229', 'REF-LEAP'), user);
    expect(result.rejected).toBe(0);
    expect((created[0].valueDate as Date).toISOString().slice(0, 10)).toBe('2024-02-29');
  });

  it('29 февраля невисокосного года отвергается', async () => {
    const { service } = build();
    expect((await service.importMT940(statement('260229', 'REF-NOLEAP'), user)).rejected).toBe(1);
  });

  it('отвергнутые строки видны в результате, а не пропадают молча', async () => {
    const { service } = build();
    const mixed = [
      ':60F:260101',
      ':61:269999C100,00NREFREF-BAD',
      ':86:Плательщик: A',
      ':61:260115C200,00NREFREF-OK',
      ':86:Плательщик: B',
    ].join('\n');
    const result = await service.importMT940(mixed, user);
    expect(result).toMatchObject({ imported: 1, rejected: 1 });
  });

  it('непригодная дата в :60F: не затирает уже установленную дату выписки', async () => {
    const { service, created } = build();
    const mixed = [
      ':60F:260101',
      ':60M:269999',
      ':61:260115C100,00NREFREF-OK',
      ':86:Плательщик: A',
    ].join('\n');
    await service.importMT940(mixed, user);
    expect((created[0].statementDate as Date).toISOString().slice(0, 10)).toBe('2026-01-01');
  });
});

describe('Ручная привязка: идентификаторы', () => {
  it('пустой идентификатор строки отклоняется сервисом, а не уходит в запрос к БД', async () => {
    const { service } = build();
    await expect(service.manualMatch('', 'deal-1', user)).rejects.toThrow('идентификатор строки');
  });

  it('пустой идентификатор сделки отклоняется так же', async () => {
    const { service } = build();
    await expect(service.manualMatch('entry-1', '', user)).rejects.toThrow('идентификатор сделки');
  });

  it('нестроковые идентификаторы отклоняются до обращения к БД', async () => {
    const { service } = build();
    await expect(service.manualMatch({ $ne: null } as unknown as string, 'deal-1', user)).rejects.toThrow();
    await expect(service.manualMatch('entry-1', 123 as unknown as string, user)).rejects.toThrow();
  });
});
