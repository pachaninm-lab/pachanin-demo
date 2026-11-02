// @vitest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/public-platform-assistant/attachments/route';
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

// Real stored ZIP records with CRC-32, not a mocked archive/extractor.
function docx(body: string, prefix = 'w'): Buffer {
  const name = Buffer.from('word/document.xml');
  const q = prefix ? `${prefix}:` : '';
  const namespace = prefix ? `xmlns:${prefix}` : 'xmlns';
  const data = Buffer.from(`<${q}document ${namespace}="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><${q}body>${body.replace(/w:/gu, q)}</${q}body></${q}document>`);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  name.copy(central, 46);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length + data.length, 16);
  return Buffer.concat([local, data, central, end]);
}

async function upload(body: string, prefix = 'w') {
  const form = new FormData();
  form.append('files', new File([new Uint8Array(docx(body, prefix))], 'synthetic.docx'));
  const response = await POST(new NextRequest('http://localhost/api/public-platform-assistant/attachments', {
    method: 'POST', body: form,
  }));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.rejected).toEqual([]);
  return result.documents[0] as { text: string; truncated: boolean };
}

const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

describe('public assistant real DOCX text fidelity', () => {
  it('preserves literal comparison signs without treating text as markup', async () => {
    const { text } = await upload(paragraph('Сумма &lt; 5000 и &gt; 1000. A &lt; B и C &gt; D.'));
    expect(text).toBe('Сумма < 5000 и > 1000. A < B и C > D.');
  });
  it('decodes numeric XML entities exactly once', async () => {
    const { text } = await upload(paragraph('Влажность &#60; 14; белок &#x3E; 12. &amp;lt;tag&amp;gt; &quot;овёс&quot;'));
    expect(text).toBe('Влажность < 14; белок > 12. &lt;tag&gt; "овёс"');
  });
  it('preserves a word split across formatting runs', async () => {
    const { text } = await upload('<w:p><w:r><w:t>Пше</w:t></w:r><w:r><w:t>ница</w:t></w:r></w:p>');
    expect(text).toBe('Пшеница');
  });
  it('keeps paragraph and table-cell boundaries', async () => {
    const { text } = await upload('<w:tbl><w:tr><w:tc>' + paragraph('Цена') + '</w:tc><w:tc>' + paragraph('18000') + '</w:tc></w:tr></w:tbl>' + paragraph('Итого'));
    expect(text).toMatch(/Цена\s+18000\s+Итого/u);
  });
  it.each([
    ['del', 'Удалено'], ['ins', 'Вставлено'],
    ['moveFrom', 'Перенесено из'], ['moveTo', 'Перенесено в'],
  ])('distinguishes %s tracked text from ordinary contract text', async (tag, label) => {
    const textTag = tag === 'del' ? 'delText' : 't';
    const changed = `<w:${tag} w:id="1"><w:r><w:${textTag}>Цена 20000</w:${textTag}></w:r></w:${tag}>`;
    const { text } = await upload(paragraph('Цена 18000') + changed);
    expect(text).toContain('правки');
    expect(text).toContain(`[${label} (правка)]Цена 20000[Конец правки]`);
    expect(text).toContain('не подтверждает принятие изменений');
    expect(text).toContain('Цена 18000');
  });
  it('does not turn a self-closing revision property into a text wrapper', async () => {
    const { text } = await upload('<w:p><w:pPr><w:rPr><w:del w:id="2"/></w:rPr></w:pPr><w:r><w:t>Цена 18000</w:t></w:r></w:p>');
    expect(text).toBe('Цена 18000');
  });
  it.each(['d', ''])('resolves tracked text through the namespace URI with prefix %s', async (prefix) => {
    const { text } = await upload(paragraph('Цена 18000') + '<w:del w:id="1"><w:r><w:delText>Цена 20000</w:delText></w:r></w:del>', prefix);
    expect(text).toContain('[Удалено (правка)]Цена 20000[Конец правки]');
    expect(text).toContain('не подтверждает принятие изменений');
  });
  it('ignores pretty printing outside text nodes but preserves intentional spaces inside them', async () => {
    const { text } = await upload('<w:p>\n  <w:r><w:t>Пше</w:t></w:r>\n  <w:r><w:t>ница</w:t></w:r>\n  <w:r><w:t xml:space="preserve"> и овёс</w:t></w:r>\n</w:p>');
    expect(text).toBe('Пшеница и овёс');
  });
  it('does not interpret a rebound foreign prefix as Word text or a revision', async () => {
    const { text } = await upload(paragraph('Цена 18000') + '<w:del xmlns:w="urn:foreign"><w:r><w:t>NOT_WORD</w:t></w:r></w:del>');
    expect(text).toBe('Цена 18000');
  });
  it('does not read a namespace-like string inside an author attribute as a declaration', async () => {
    const { text } = await upload(paragraph('Цена 18000') + `<w:del w:id="1" w:author="Alice xmlns:w='urn:foreign'"><w:r><w:delText>Цена 20000</w:delText></w:r></w:del>`);
    expect(text).toContain('[Удалено (правка)]Цена 20000[Конец правки]');
    expect(text).toContain('не подтверждает принятие изменений');
  });
  it('keeps CDATA literal and does not expand entities again', async () => {
    const { text } = await upload('<w:p><w:r><w:t><![CDATA[<5000 &amp; >1000]]></w:t></w:r></w:p>');
    expect(text).toBe('<5000 &amp; >1000');
  });
  it('keeps the 18000-character ceiling and reports partial extraction', async () => {
    const { text, truncated } = await upload(paragraph('Данные '.repeat(4000)));
    expect(text.length).toBe(18000);
    expect(truncated).toBe(true);
  });
});
