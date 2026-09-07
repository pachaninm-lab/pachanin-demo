import { ComplianceService } from './compliance.service';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * V1.3.3: журнал аудита выгружался в контекст, который его исполняет.
 *
 * exportAuditCsv собирал ячейку вручную и удваивал кавычки — по RFC 4180
 * строка получалась корректной. Второй задачи это не решало: ячейка,
 * начинающаяся с =, +, - или @, трактуется Excel и LibreOffice как формула.
 * Файл при этом безупречен; исполнение происходит в читателе, а не в парсере.
 *
 * Значение здесь не абстрактное. Поле reason объявлено в
 * compliance.controller.ts инлайновым телом `{ reason: string }`, которое
 * ValidationPipe не проверяет, то есть это свободный текст вызывающего. Он
 * попадает в строку аудита, а оттуда — в CSV, который открывает ДРУГОЙ
 * человек: комплаенс-офицер или регулятор. Привилегированная запись и
 * непривилегированное чтение — это и есть пересекаемая граница.
 *
 * Тесты гоняют настоящий сервис со стабом prisma. Возврат ручной сборки
 * роняет проверки формул; копия логики рядом прошла бы и после отката.
 */

const OFFICER: RequestUser = {
  id: 'user-1',
  role: Role.COMPLIANCE_OFFICER,
  orgId: 'org-1',
  tenantId: 'tenant-1',
} as RequestUser;

function auditEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    action: 'DEAL_APPROVED',
    actorUserId: 'user-9',
    actorRole: 'ADMIN',
    objectType: 'Deal',
    objectId: 'deal-1',
    outcome: 'SUCCESS',
    reason: 'плановая проверка',
    hash: 'abc123',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function serviceReturning(events: unknown[]): ComplianceService {
  const prisma = {
    auditEvent: { findMany: async () => events },
  };
  return new ComplianceService(prisma as never, {} as never, {} as never);
}

/** Разбор с учётом кавычек: сравнивать нужно значение ячейки, а не её запись. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') { cell += '"'; index += 1; continue; }
      if (character === '"') { quoted = false; continue; }
      cell += character;
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character === ',') { cells.push(cell); cell = ''; continue; }
    cell += character;
  }
  cells.push(cell);
  return cells;
}

async function exportRows(events: unknown[]): Promise<string[][]> {
  const content = await serviceReturning(events).exportAuditCsv(OFFICER);
  return content.split('\n').slice(1).filter(Boolean).map(splitCsvLine);
}

describe('выгрузка журнала аудита не исполняется в программе, которая её открывает', () => {
  const REASON_INDEX = 7;

  for (const payload of ['=cmd|\'/c calc\'!A1', '+1+1', '-2+3', '@SUM(A1)']) {
    it(`обезвреживает reason, начинающийся с ${payload[0]}`, async () => {
      const [row] = await exportRows([auditEvent({ reason: payload })]);
      expect(row[REASON_INDEX]).toBe(`'${payload}`);
      expect(row[REASON_INDEX].startsWith(payload[0])).toBe(false);
    });
  }

  it('обезвреживает и action, а не только замеченное поле', async () => {
    const [row] = await exportRows([auditEvent({ action: '=HYPERLINK("http://evil","click")' })]);
    expect(row[1]).toBe('\'=HYPERLINK("http://evil","click")');
  });

  it('обычное значение не трогает: кавычка не появляется там, где её не было', async () => {
    const [row] = await exportRows([auditEvent()]);
    expect(row[REASON_INDEX]).toBe('плановая проверка');
    expect(row[1]).toBe('DEAL_APPROVED');
  });

  it('кавычку в значении сохраняет, а не съедает, и форму строки не меняет', async () => {
    const [row] = await exportRows([auditEvent({ reason: 'причина: "срочно", далее' })]);
    expect(row).toHaveLength(10);
    expect(row[REASON_INDEX]).toBe('причина: "срочно", далее');
  });

  it('запятая в значении не создаёт новых колонок', async () => {
    const [row] = await exportRows([auditEvent({ reason: 'a,b,c' })]);
    expect(row).toHaveLength(10);
    expect(row[REASON_INDEX]).toBe('a,b,c');
  });

  it('отсутствующее значение остаётся пустым полем, а не текстом null', async () => {
    const [row] = await exportRows([auditEvent({ objectType: null, objectId: null })]);
    expect(row[4]).toBe('');
    expect(row[5]).toBe('');
  });

  it('заголовок и число колонок не изменились', async () => {
    const content = await serviceReturning([auditEvent()]).exportAuditCsv(OFFICER);
    const header = content.split('\n')[0];
    expect(header).toBe('id,action,actorUserId,actorRole,objectType,objectId,outcome,reason,hash,createdAt');
    expect(splitCsvLine(header)).toHaveLength(10);
  });

  it('роль по-прежнему проверяется до всякой выгрузки', async () => {
    const service = serviceReturning([auditEvent()]);
    await expect(service.exportAuditCsv({ ...OFFICER, role: Role.BUYER } as RequestUser)).rejects.toThrow();
  });
});
