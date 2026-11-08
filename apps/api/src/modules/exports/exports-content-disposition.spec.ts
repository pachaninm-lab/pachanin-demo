import { ExportsController } from './exports.controller';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * ASVS 5.0 V5.4.1 и V5.4.2, привязка к маршрутам.
 *
 * Сборщик заголовка существовал и был правильным; дефект был в том, что эти
 * маршруты собирали значение сами. Поэтому проверяется именно вызов из
 * контроллера, а не поведение сборщика — оно проверено отдельно. Тест на
 * сборщике прошёл бы и тогда, когда его никто не зовёт.
 */

const ADMIN: RequestUser = {
  id: 'u-1',
  orgId: 'org-1',
  role: Role.ADMIN,
  email: 'exports@example.test',
  // См. #4839: без тенанта экспорт отказывает, поэтому фикстура его несёт.
  tenantId: 'tenant-1',
};

function makeResponse() {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader: (name: string, value: string) => headers.set(name, value),
    send: () => undefined,
  };
}

function makeController() {
  const exports = {
    exportDealsCsv: jest.fn().mockResolvedValue('id\n'),
    exportLedgerCsv: jest.fn().mockResolvedValue('id\n'),
    exportRegulatoryReport: jest.fn().mockResolvedValue({
      format: 'csv',
      filename: 'rosstat-29sx-1.csv',
      content: 'id\n',
    }),
  };
  return { controller: new ExportsController(exports as never), exports };
}

describe('ExportsController — имя файла в заголовке', () => {
  it('не даёт dealId открыть второй параметр filename', async () => {
    // dealId не отвергается: exportLedgerCsv ловит ошибку запроса и отдаёт
    // пустой CSV, поэтому произвольная строка доходит до заголовка.
    const { controller } = makeController();
    const res = makeResponse();

    await controller.exportLedger('x"; filename="ledger.csv.exe', ADMIN, res as never);

    const value = res.headers.get('Content-Disposition') ?? '';
    expect(value.match(/filename="/gu) ?? []).toHaveLength(1);
    expect(value).toContain("filename*=UTF-8''");
  });

  it('кодирует кириллический dealId', async () => {
    const { controller } = makeController();
    const res = makeResponse();

    await controller.exportLedger('сделка-№1', ADMIN, res as never);

    const value = res.headers.get('Content-Disposition') ?? '';
    expect(value).toMatch(/filename="[ -~]*"/u);
    expect(decodeURIComponent(value.split("filename*=UTF-8''")[1])).toContain('сделка-№1');
  });

  it('ставит обе формы и на маршрутах без пользовательского ввода', async () => {
    const { controller } = makeController();

    const dealsRes = makeResponse();
    await controller.exportDeals(ADMIN, undefined, undefined, undefined, dealsRes as never);
    expect(dealsRes.headers.get('Content-Disposition')).toContain("filename*=UTF-8''deals-");

    const regulatoryRes = makeResponse();
    await controller.regulatoryReport({ type: 'rosstat' }, ADMIN, regulatoryRes as never);
    expect(regulatoryRes.headers.get('Content-Disposition')).toContain(
      "filename*=UTF-8''rosstat-29sx-1.csv",
    );
  });
});
