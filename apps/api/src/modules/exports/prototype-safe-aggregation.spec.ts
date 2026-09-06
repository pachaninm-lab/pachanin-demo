/**
 * Накопители, ключ которых приходит из данных.
 *
 * Замерено ДО правки на настоящем `exportRegulatoryReport`. Культура сделки
 * приходит свободным текстом — create-deal.dto ограничивает её только
 * @IsString, тогда как тот же смысл у лота ограничен списком через @IsIn, — и
 * попадает ключом в объектный литерал государственной формы 29-СХ:
 *
 *   норма         → Пшеница 150, Ячмень 20
 *   '__proto__'   → строки нет вовсе, 500 тонн исчезли из отчёта
 *   'constructor' → constructor,"function Object() { [native code] }500"
 *   'toString'    → то же с исходником функции
 *   'valueOf'     → то же
 *
 * Причин две, и они складываются. Чтение `acc[c] ?? 0` для унаследованного
 * ключа возвращает не undefined, а член прототипа, поэтому вместо сложения
 * получается склейка. Запись `acc['__proto__'] = …` у литерала собственного
 * свойства не создаёт вовсе, поэтому строка пропадает из отчёта.
 *
 * Тест гоняет НАСТОЯЩИЙ сервис со стабом prisma. Копия логики рядом с сервисом
 * проходила бы и после того, как сервис вернут к литералу.
 */
import { ExportsService } from './exports.service';
import { RequestUser, Role } from '../../common/types/request-user';

const user = { id: 'u1', role: Role.ADMIN, tenantId: 't1' } as unknown as RequestUser;
const PROTOTYPE_KEYS = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'];

function serviceReturning(deals: Array<Record<string, unknown>>) {
  const prisma = { deal: { findMany: async () => deals } };
  return new ExportsService(prisma as never);
}

function closedDeal(culture: string | null, volumeTons: number) {
  return { id: 'd', status: 'CLOSED', culture, volumeTons, totalRub: 0, createdAt: new Date(), closedAt: new Date() };
}

/** Строки блока «Культура,Объём (т)» из готового отчёта. */
function cultureRows(content: string): Array<[string, string]> {
  const marker = 'Культура,Объём (т)\n';
  const index = content.indexOf(marker);
  if (index === -1) return [];
  return content
    .slice(index + marker.length)
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => splitCsvLine(line) as [string, string]);
}

/** Разбор строки CSV с учётом кавычек: csvRow экранирует каждую ячейку. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; continue; }
      if (char === '"') { quoted = false; continue; }
      cell += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { cells.push(cell); cell = ''; continue; }
    cell += char;
  }
  cells.push(cell);
  return cells;
}

describe('форма 29-СХ: агрегация по культуре в настоящем сервисе', () => {
  it('нормальные культуры суммируются', async () => {
    const service = serviceReturning([
      closedDeal('Пшеница', 100),
      closedDeal('Пшеница', 50),
      closedDeal('Ячмень', 20),
    ]);
    const report = await service.exportRegulatoryReport(user, { type: 'rosstat' });
    expect(report.format).toBe('csv');
    expect(cultureRows(report.content)).toEqual([['Пшеница', '150'], ['Ячмень', '20']]);
  });

  it.each(PROTOTYPE_KEYS)('объём не теряется и не портится при культуре %s', async (culture) => {
    const service = serviceReturning([closedDeal('Пшеница', 100), closedDeal(culture, 500)]);
    const report = await service.exportRegulatoryReport(user, { type: 'rosstat' });
    const rows = cultureRows(report.content);

    // Строка обязана присутствовать: молчаливая потеря объёма — это ложное
    // донесение регулятору, а не косметика.
    const row = rows.find(([name]) => name === culture);
    expect(row).toBeDefined();
    expect(Number(row?.[1])).toBe(500);

    // Сумма по отчёту обязана сойтись с суммой по сделкам.
    expect(rows.reduce((sum, [, value]) => sum + Number(value), 0)).toBe(600);

    // И ни в одной ячейке не должно оказаться исходника функции.
    expect(report.content).not.toContain('native code');
    for (const [, value] of rows) expect(Number.isFinite(Number(value))).toBe(true);
  });

  it('отсутствующая культура по-прежнему сводится в одну строку', async () => {
    const service = serviceReturning([closedDeal(null, 10), closedDeal(null, 5)]);
    const report = await service.exportRegulatoryReport(user, { type: 'rosstat' });
    expect(cultureRows(report.content)).toEqual([['Не указана', '15']]);
  });

  it('прежняя реализация действительно теряла — иначе проверять нечего', () => {
    // Литерал воспроизводится здесь только чтобы показать дефект, который
    // сервис больше не содержит.
    const before = Object.entries(
      [
        { culture: 'Пшеница', volumeTons: 100 },
        { culture: '__proto__', volumeTons: 500 },
      ].reduce((acc, d) => {
        const c = d.culture ?? 'Не указана';
        acc[c] = (acc[c] ?? 0) + (d.volumeTons ?? 0);
        return acc;
      }, {} as Record<string, number>),
    );
    expect(before.find(([name]) => name === '__proto__')).toBeUndefined();
    expect(before.reduce((sum, [, value]) => sum + Number(value), 0)).toBe(100);
  });

  it('Object.fromEntries сохраняет унаследованные имена собственным свойством', () => {
    // На этом держится возврат compliance и integration-events: форма ответа
    // остаётся объектом, но данные больше не проваливаются в прототип.
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

describe('статистика адаптеров: форма ответа API сохранена, данные не теряются', () => {
  it('имя адаптера, совпадающее с членом прототипа, остаётся отдельной записью', async () => {
    // Настоящий сервис, не копия: возврат идёт через Object.fromEntries, и это
    // единственное, что удерживает форму ответа объектом при ключе __proto__.
    const { ComplianceService } = await import('../compliance/compliance.service');
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
