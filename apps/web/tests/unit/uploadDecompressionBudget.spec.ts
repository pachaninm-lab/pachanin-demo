import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  DecompressionBudgetError,
  MAX_ARCHIVE_ENTRIES,
  MAX_DECLARED_COMPRESSION_RATIO,
  MAX_INFLATED_ENTRY_BYTES,
  MAX_REQUEST_INFLATED_BYTES,
  assertArchiveDeclared,
  assertArchiveEntryCount,
  assertDeclaredEntry,
  createInflateBudget,
  inflateWithinBudget,
  assertArchiveInflatesWithinBudget,
  inflatePdfStream,
  isArchiveExtension,
  readArchiveEntry,
} from '../../lib/uploads/decompression-budget';

/**
 * ASVS V5.2.3. Предел размера файла ограничивает вход, а не выход распаковщика:
 * DEFLATE даёт около 1032:1, поэтому фикстуры ниже — килобайты, а объявляют и
 * разжимают мегабайты. Маршрут, на котором это выполняется, аутентификации не
 * требует.
 */

/** Строка из нулей сжимается почти идеально — это и есть бомба в миниатюре. */
function bomb(uncompressedBytes: number, raw = true): Buffer {
  const payload = Buffer.alloc(uncompressedBytes, 0);
  return raw ? deflateRawSync(payload) : deflateSync(payload);
}

/**
 * Минимальный zip с одной записью. `declaredSize` задаётся отдельно от
 * настоящего размера — именно потому, что отправитель может в нём соврать, и
 * проверка объявленного не может быть единственной.
 */
function zip(
  name: string,
  compressed: Buffer,
  declaredSize: number,
  options: { entries?: number; method?: number } = {},
): Buffer {
  const method = options.method ?? 8;
  const nameBytes = Buffer.from(name, 'utf8');

  const local = Buffer.alloc(30 + nameBytes.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(declaredSize, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(local, 30);

  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(declaredSize, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  nameBytes.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(options.entries ?? 1, 8);
  eocd.writeUInt16LE(options.entries ?? 1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length + compressed.length, 16);

  return Buffer.concat([local, compressed, central, eocd]);
}

/** PDF с одним FlateDecode-потоком. */
function pdfWithStreams(streams: Buffer[]): Buffer {
  const parts = streams.map((stream) =>
    Buffer.concat([
      Buffer.from('<< /Filter /FlateDecode >>\nstream\n', 'latin1'),
      stream,
      Buffer.from('\nendstream\n', 'latin1'),
    ]),
  );
  return Buffer.concat([Buffer.from('%PDF-1.4\n', 'latin1'), ...parts]);
}

describe('decompression budget — V5.2.3', () => {
  it('refuses an entry whose declared size exceeds the per-entry ceiling before inflating', () => {
    const budget = createInflateBudget();
    expect(() =>
      assertDeclaredEntry(MAX_INFLATED_ENTRY_BYTES + 1, 1_000, budget, 'word/document.xml'),
    ).toThrow(DecompressionBudgetError);
    // Ни байта бюджета на отказ не потрачено.
    expect(budget.remaining).toBe(MAX_REQUEST_INFLATED_BYTES);
  });

  it('refuses a declared compression ratio no honest document reaches', () => {
    const budget = createInflateBudget();
    const compressed = 1_000;
    const declared = compressed * (MAX_DECLARED_COMPRESSION_RATIO + 1);
    expect(() => assertDeclaredEntry(declared, compressed, budget, 'entry')).toThrow(
      /ARCHIVE_COMPRESSION_RATIO_EXCEEDED/u,
    );
  });

  it('refuses an archive declaring more entries than the ceiling', () => {
    expect(() => assertArchiveEntryCount(MAX_ARCHIVE_ENTRIES + 1, 'docx')).toThrow(
      /ARCHIVE_TOO_MANY_ENTRIES/u,
    );
    expect(() => assertArchiveEntryCount(MAX_ARCHIVE_ENTRIES, 'docx')).not.toThrow();
  });

  it('stops a bomb that lied about its declared size', () => {
    // Объявление проходит проверку, содержимое — нет. Ровно тот случай, ради
    // которого исполняющая граница существует отдельно от проверки объявленного.
    const budget = createInflateBudget();
    const compressed = bomb(MAX_INFLATED_ENTRY_BYTES + 1_024);
    expect(() => inflateWithinBudget(compressed, budget, { raw: true, label: 'liar' })).toThrow(
      /ARCHIVE_INFLATED_TOO_LARGE/u,
    );
  });

  it('spends the request budget across files rather than per file', () => {
    const budget = createInflateBudget();
    const half = Math.floor(MAX_REQUEST_INFLATED_BYTES / 2) + 1_024;
    inflateWithinBudget(bomb(half), budget, { raw: true, label: 'first' });
    expect(budget.remaining).toBeLessThan(MAX_REQUEST_INFLATED_BYTES / 2);
    // Второй файл сам по себе в пределах нормы, но бюджет уже потрачен.
    expect(() => inflateWithinBudget(bomb(half), budget, { raw: true, label: 'second' })).toThrow(
      DecompressionBudgetError,
    );
  });

  it('reports a corrupt stream as an ordinary error, not a budget refusal', () => {
    // Различие несёт нагрузку: повреждение пропускается разбором PDF, отказ по
    // бюджету обязан его прервать.
    const budget = createInflateBudget();
    const error = (() => {
      try {
        inflateWithinBudget(Buffer.from('not deflate at all'), budget, {
          raw: false,
          label: 'corrupt',
        });
        return null;
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).not.toBeNull();
    expect(error).not.toBeInstanceOf(DecompressionBudgetError);
  });

  it('checks a whole archive from its directory before any decoder runs', () => {
    const budget = createInflateBudget();
    const declared = MAX_INFLATED_ENTRY_BYTES + 1;
    const archive = zip('xl/worksheets/sheet1.xml', bomb(64), declared);
    expect(() => assertArchiveDeclared('xlsx', archive, budget)).toThrow(/ARCHIVE_ENTRY_TOO_LARGE/u);
    expect(budget.remaining).toBe(MAX_REQUEST_INFLATED_BYTES);
  });

  it('refuses an archive whose directory cannot be read rather than passing it on', () => {
    const budget = createInflateBudget();
    expect(() => assertArchiveDeclared('xlsx', Buffer.alloc(64, 7), budget)).toThrow(
      /ARCHIVE_DIRECTORY_UNREADABLE/u,
    );
  });

  it('leaves formats that are not archives alone', () => {
    const budget = createInflateBudget();
    expect(isArchiveExtension('pdf')).toBe(false);
    expect(isArchiveExtension('docx')).toBe(true);
    expect(() => assertArchiveDeclared('png', Buffer.alloc(64, 7), budget)).not.toThrow();
  });
});

describe('archive and PDF decoders under the budget — V5.2.3', () => {
  it('refuses a docx whose document.xml is a bomb', () => {
    const budget = createInflateBudget();
    const payload = MAX_INFLATED_ENTRY_BYTES + 4_096;
    const archive = zip('word/document.xml', bomb(payload), payload);
    expect(() => readArchiveEntry(archive, 'word/document.xml', budget)).toThrow(
      DecompressionBudgetError,
    );
  });

  it('still reads an honest docx entry', () => {
    const budget = createInflateBudget();
    const body = Buffer.from('<w:p>договор</w:p>', 'utf8');
    const archive = zip('word/document.xml', deflateRawSync(body), body.length);
    expect(readArchiveEntry(archive, 'word/document.xml', budget).toString('utf8')).toBe(
      body.toString('utf8'),
    );
    expect(budget.remaining).toBe(MAX_REQUEST_INFLATED_BYTES - body.length);
  });

  it('refuses a stored entry that would overrun the request budget', () => {
    // Запись без сжатия распаковщика не проходит вовсе, но память занимает.
    const budget = createInflateBudget();
    budget.remaining = 8;
    const body = Buffer.alloc(4_096, 0x41);
    const archive = zip('word/document.xml', body, body.length, { method: 0 });
    expect(() => readArchiveEntry(archive, 'word/document.xml', budget)).toThrow(
      /ARCHIVE_REQUEST_BUDGET_EXCEEDED/u,
    );
  });

  it('raises a budget refusal from a PDF stream rather than reporting it as corruption', () => {
    // Без этого различия граница не значит ничего: отправитель кладёт в файл
    // много бомб, каждая читается как повреждение, пропускается, и разбор идёт
    // дальше.
    const budget = createInflateBudget();
    expect(() => inflatePdfStream(bomb(MAX_INFLATED_ENTRY_BYTES + 1_024, false), budget)).toThrow(
      DecompressionBudgetError,
    );
  });

  it('reports a merely corrupt PDF stream as a skip', () => {
    const budget = createInflateBudget();
    expect(inflatePdfStream(Buffer.from('corrupt', 'latin1'), budget)).toBeNull();
  });

  it('leaves the route no way to inflate outside the budget', () => {
    // Структурная гарантия, а не поведенческая, и заявлена именно так: маршрут
    // не импортирует zlib вовсе, поэтому распаковать что-либо мимо этого модуля
    // ему нечем. Тест сторожит именно это - вернуть в маршрут прямой импорт
    // распаковщика молча нельзя.
    const route = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        'app',
        'api',
        'public-platform-assistant',
        'attachments',
        'route.ts',
      ),
      'utf8',
    );
    expect(route).toContain('decompression-budget');
    expect(route).not.toMatch(/from 'node:zlib'/u);
    expect(route).not.toMatch(/inflate(Raw)?Sync/u);
  });
});

/**
 * Проверка самого маршрута, а не только модуля.
 *
 * Для docx и pdf обход бюджета невозможен структурно: маршрут не импортирует
 * распаковщик. Для xlsx такой гарантии нет — распаковывает ExcelJS, — поэтому
 * единственное, что держит предраспаковочную проверку на месте, это вызов в
 * `extract`. Убрать его молча можно; вот здесь и нельзя.
 */
describe('xlsx has no enforcing ceiling of its own — V5.2.3', () => {
  it('refuses an archive whose directory lied about the uncompressed size', () => {
    // Проверки объявленного мало: объявление пишет отправитель. ExcelJS через
    // JSZip сверяет размер уже после того, как данные получены, поэтому
    // подделанный на два байта каталог проходил бы предпроверку и разжимался
    // без потолка. Найдено ревью на #4833.
    const budget = createInflateBudget();
    const honestLooking = 4_096;
    const archive = zip(
      'xl/worksheets/sheet1.xml',
      bomb(MAX_INFLATED_ENTRY_BYTES + 4_096),
      honestLooking,
    );

    // Объявленному верят — предпроверка пропускает.
    expect(() => assertArchiveDeclared('xlsx', archive, budget)).not.toThrow();
    // Распаковка — нет.
    expect(() => assertArchiveInflatesWithinBudget('xlsx', archive, budget)).toThrow(
      /ARCHIVE_INFLATED_TOO_LARGE/u,
    );
  });

  it('debits the request budget by what actually inflated, across files', () => {
    // Раньше declaredTotal сверялся с остатком, но не списывался, и каждый
    // следующий архив видел полный бюджет заново. Найдено ревью на #4833.
    const budget = createInflateBudget();
    const body = Buffer.alloc(2 * 1024 * 1024, 0x41);
    const archive = zip('xl/worksheets/sheet1.xml', deflateRawSync(body), body.length);

    assertArchiveInflatesWithinBudget('xlsx', archive, budget);
    expect(budget.remaining).toBe(MAX_REQUEST_INFLATED_BYTES - body.length);

    assertArchiveInflatesWithinBudget('xlsx', archive, budget);
    expect(budget.remaining).toBe(MAX_REQUEST_INFLATED_BYTES - 2 * body.length);
  });

  it('refuses once the shared budget is spent, however honest the archive', () => {
    const budget = createInflateBudget();
    budget.remaining = 1_024;
    const body = Buffer.alloc(64 * 1024, 0x41);
    const archive = zip('xl/worksheets/sheet1.xml', deflateRawSync(body), body.length);

    expect(() => assertArchiveInflatesWithinBudget('xlsx', archive, budget)).toThrow(
      DecompressionBudgetError,
    );
  });

  it('leaves a format that this module does decompress itself alone', () => {
    // Для pdf проверять нечего: у него нет каталога, и его потоки разжимает
    // этот же модуль под тем же бюджетом.
    const budget = createInflateBudget();
    expect(() => assertArchiveInflatesWithinBudget('pdf', Buffer.alloc(64, 7), budget)).not.toThrow();
    expect(budget.remaining).toBe(MAX_REQUEST_INFLATED_BYTES);
  });
});

describe('POST /api/public-platform-assistant/attachments — V5.2.3 wiring', () => {
  async function post(files: Array<{ name: string; bytes: Buffer }>) {
    const { POST } = await import(
      '../../app/api/public-platform-assistant/attachments/route'
    );
    const form = new FormData();
    for (const file of files) {
      form.append('files', new File([new Uint8Array(file.bytes)], file.name));
    }
    const request = new Request('https://example.invalid/api/public-platform-assistant/attachments', {
      method: 'POST',
      body: form,
    });
    const response = await POST(request as never);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it('rejects an xlsx whose directory declares a bomb, through the route itself', async () => {
    const declared = MAX_INFLATED_ENTRY_BYTES + 1;
    const archive = zip('xl/worksheets/sheet1.xml', bomb(64), declared);
    const { status, body } = await post([{ name: 'ledger.xlsx', bytes: archive }]);

    expect(status).toBe(422);
    expect(JSON.stringify(body)).toMatch(/ARCHIVE_ENTRY_TOO_LARGE/u);
  });

  it('rejects an xlsx that forged its declared sizes, through the route itself', async () => {
    const archive = zip(
      'xl/worksheets/sheet1.xml',
      bomb(MAX_INFLATED_ENTRY_BYTES + 4_096),
      4_096,
    );
    const { status, body } = await post([{ name: 'forged.xlsx', bytes: archive }]);

    expect(status).toBe(422);
    expect(JSON.stringify(body)).toMatch(/ARCHIVE_INFLATED_TOO_LARGE/u);
  });

  it('rejects a docx bomb through the route itself', async () => {
    const payload = MAX_INFLATED_ENTRY_BYTES + 4_096;
    const archive = zip('word/document.xml', bomb(payload), payload);
    const { status, body } = await post([{ name: 'contract.docx', bytes: archive }]);

    expect(status).toBe(422);
    expect(JSON.stringify(body)).toMatch(/ARCHIVE_(ENTRY_TOO_LARGE|COMPRESSION_RATIO_EXCEEDED)/u);
  });
});
