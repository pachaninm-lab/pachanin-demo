import {
  assertCsvBounds,
  assertJsonDepth,
  assertXlsxBounds,
  assertXmlSafe,
  fetchOfficialSource,
  inspectZipArchive,
} from './role-eligibility-security';

type FakeZipEntry = {
  name: string;
  flags?: number;
  method?: number;
  compressed?: number;
  decompressed?: number;
};

function fakeZip(entries: FakeZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = entries.map((entry) => ({ ...entry, bytes: encoder.encode(entry.name) }));
  const centralSize = encoded.reduce((sum, entry) => sum + 46 + entry.bytes.length, 0);
  const bytes = new Uint8Array(centralSize + 22);
  const view = new DataView(bytes.buffer);
  let cursor = 0;
  for (const entry of encoded) {
    view.setUint32(cursor, 0x02014b50, true);
    view.setUint16(cursor + 4, 20, true);
    view.setUint16(cursor + 6, 20, true);
    view.setUint16(cursor + 8, entry.flags ?? 0, true);
    view.setUint16(cursor + 10, entry.method ?? 8, true);
    view.setUint32(cursor + 20, entry.compressed ?? 10, true);
    view.setUint32(cursor + 24, entry.decompressed ?? 10, true);
    view.setUint16(cursor + 28, entry.bytes.length, true);
    view.setUint32(cursor + 42, 0, true);
    bytes.set(entry.bytes, cursor + 46);
    cursor += 46 + entry.bytes.length;
  }
  const eocd = centralSize;
  view.setUint32(eocd, 0x06054b50, true);
  view.setUint16(eocd + 8, entries.length, true);
  view.setUint16(eocd + 10, entries.length, true);
  view.setUint32(eocd + 12, centralSize, true);
  view.setUint32(eocd + 16, 0, true);
  return bytes;
}

describe('Role Eligibility source security', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('rejects non-HTTPS and non-allowlisted source URLs before network access', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(fetchOfficialSource('http://www.cbr.ru/test', {
      source: 'CBR', allowedHosts: ['www.cbr.ru'], maxResponseBytes: 1024,
      connectTimeoutMs: 100, readTimeoutMs: 100, acceptedContentTypes: ['text/plain'],
    })).rejects.toThrow('CBR_HTTPS_REQUIRED');
    await expect(fetchOfficialSource('https://example.com/test', {
      source: 'CBR', allowedHosts: ['www.cbr.ru'], maxResponseBytes: 1024,
      connectTimeoutMs: 100, readTimeoutMs: 100, acceptedContentTypes: ['text/plain'],
    })).rejects.toThrow('CBR_HOST_NOT_ALLOWLISTED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('enforces a connect/TLS/headers timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal;
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const promise = fetchOfficialSource('https://www.cbr.ru/test', {
      source: 'CBR', allowedHosts: ['www.cbr.ru'], maxResponseBytes: 1024,
      connectTimeoutMs: 100, readTimeoutMs: 100, acceptedContentTypes: ['text/plain'],
    });
    await jest.advanceTimersByTimeAsync(101);
    await expect(promise).rejects.toThrow('CBR_CONNECT_TIMEOUT');
  });

  it('enforces an idle body read timeout', async () => {
    jest.useFakeTimers();
    const body = new ReadableStream<Uint8Array>({ start() { /* deliberately silent */ } });
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    }));
    const promise = fetchOfficialSource('https://www.cbr.ru/test', {
      source: 'CBR', allowedHosts: ['www.cbr.ru'], maxResponseBytes: 1024,
      connectTimeoutMs: 100, readTimeoutMs: 100, acceptedContentTypes: ['text/plain'],
    });
    await jest.advanceTimersByTimeAsync(101);
    await expect(promise).rejects.toThrow('CBR_READ_TIMEOUT');
  });

  it('rejects XML external entities, excessive JSON depth and oversized CSV', () => {
    expect(() => assertXmlSafe('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>', 'FNS'))
      .toThrow('FNS_XML_EXTERNAL_ENTITY_FORBIDDEN');
    let nested: unknown = 'leaf';
    for (let i = 0; i < 30; i += 1) nested = { child: nested };
    expect(() => assertJsonDepth(nested, 12, 100)).toThrow('JSON_DEPTH_LIMIT');
    expect(() => assertCsvBounds('a;b\nc;d\ne;f', 1, 4, 10)).toThrow('CSV_ROW_LIMIT');
  });

  it('rejects truncated ZIP, encryption, path traversal and bomb ratios before extraction', () => {
    expect(() => inspectZipArchive(new Uint8Array([1, 2, 3]))).toThrow('ZIP_TRUNCATED');
    expect(() => inspectZipArchive(fakeZip([{ name: 'safe.xml', flags: 1 }]))).toThrow('ZIP_ENCRYPTION_FORBIDDEN');
    expect(() => inspectZipArchive(fakeZip([{ name: '../escape.xml' }]))).toThrow('ZIP_ENTRY_PATH_TRAVERSAL');
    expect(() => inspectZipArchive(fakeZip([{
      name: 'bomb.xml', compressed: 100, decompressed: 2 * 1024 * 1024,
    }]))).toThrow('ZIP_COMPRESSION_RATIO_LIMIT');
  });

  it('applies XLSX structure and external-link limits without extracting the archive', () => {
    const safe = fakeZip([
      { name: '[Content_Types].xml' },
      { name: '_rels/.rels' },
      { name: 'xl/workbook.xml' },
      { name: 'xl/worksheets/sheet1.xml' },
    ]);
    expect(assertXlsxBounds(safe).length).toBe(4);

    const external = fakeZip([
      { name: '[Content_Types].xml' },
      { name: '_rels/.rels' },
      { name: 'xl/workbook.xml' },
      { name: 'xl/externalLinks/externalLink1.xml' },
    ]);
    expect(() => assertXlsxBounds(external)).toThrow('XLSX_EXTERNAL_LINKS_FORBIDDEN');
  });
});
