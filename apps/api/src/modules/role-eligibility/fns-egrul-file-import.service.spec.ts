import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FnsEgrulFileImportService } from './fns-egrul-file-import.service';

const NOW = new Date('2026-09-05T03:00:00.000Z');

function encodeWindows1251(value: string): Buffer {
  const bytes: number[] = [];
  for (const char of value) {
    const point = char.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes.push(point);
    else if (point >= 0x0410 && point <= 0x044f) bytes.push(point - 0x0350);
    else if (point === 0x0401) bytes.push(0xa8);
    else if (point === 0x0451) bytes.push(0xb8);
    else throw new Error(`TEST_CP1251_UNSUPPORTED_${point.toString(16)}`);
  }
  return Buffer.from(bytes);
}

function entityXml(inn: string, ogrn: string, name: string, published = '2026-09-05'): Buffer {
  return encodeWindows1251(
    `<?xml version="1.0" encoding="windows-1251"?>`
    + `<EGRUL ДатаВыг="${published}">`
    + `<СвЮЛ ИНН="${inn}" ОГРН="${ogrn}" ДатаОГРН="2002-08-15" ПолнНаимОПФ="${name}"></СвЮЛ>`
    + `</EGRUL>`,
  );
}

describe('FnsEgrulFileImportService validate-only authority boundary', () => {
  let root: string;
  let service: FnsEgrulFileImportService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    root = await mkdtemp(join(tmpdir(), 'fns-egrul-import-'));
    service = new FnsEgrulFileImportService();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await rm(root, { recursive: true, force: true });
  });

  it('validates a deterministic two-file local snapshot without any database or source authority', async () => {
    await mkdir(join(root, 'archive-b'));
    await mkdir(join(root, 'archive-a'));
    await writeFile(join(root, 'archive-b', 'b.xml'), entityXml('7812345675', '1047796045770', 'OOO BETA'));
    await writeFile(join(root, 'archive-a', 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));

    const result = await service.validateFullSnapshot({ directory: root, format: '4.08' });

    expect(result).toMatchObject({
      status: 'VALIDATED_LOCAL_STAGING',
      authority: false,
      databaseMutation: false,
      activated: false,
      sourceHealthChanged: false,
      registrationTouched: false,
      enforcementChanged: false,
    });
    expect(result.manifest.fileCount).toBe(2);
    expect(result.manifest.recordCount).toBe(2);
    expect(result.manifest.files.map((entry) => entry.relativePath)).toEqual([
      'archive-a/a.xml',
      'archive-b/b.xml',
    ]);
    expect(result.manifest.contentSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.manifest.publishedAt.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(JSON.stringify(result)).not.toContain(root);
    expect(JSON.stringify(result)).not.toContain('FNS_SUBSCRIBER_REMOTE_INVENTORY_V1');
  });

  it('replays local validation deterministically without creating an authority identity', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));

    const first = await service.validateFullSnapshot({ directory: root, format: '4.08' });
    const second = await service.validateFullSnapshot({ directory: root, format: '4.08' });

    expect(second.manifest).toEqual(first.manifest);
    expect(second.authority).toBe(false);
    expect(second.databaseMutation).toBe(false);
    expect(second.activated).toBe(false);
  });

  it('fails closed when a file changes between the two complete validation passes', async () => {
    const file = join(root, 'a.xml');
    await writeFile(file, entityXml('7707083893', '1027700132195', 'OOO ALPHA'));

    const original = service.inspectFullSnapshot.bind(service);
    let pass = 0;
    jest.spyOn(service, 'inspectFullSnapshot').mockImplementation(async (directory, format) => {
      const manifest = await original(directory, format);
      pass += 1;
      if (pass === 1) {
        await writeFile(file, entityXml('7812345675', '1047796045770', 'OOO BETA'));
      }
      return manifest;
    });

    await expect(service.validateFullSnapshot({ directory: root, format: '4.08' }))
      .rejects.toThrow('FNS_EGRUL_IMPORT_DIRECTORY_CHANGED_AFTER_MANIFEST');
  });

  it('fails closed when an XML file is added between the two complete validation passes', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));

    const original = service.inspectFullSnapshot.bind(service);
    let pass = 0;
    jest.spyOn(service, 'inspectFullSnapshot').mockImplementation(async (directory, format) => {
      const manifest = await original(directory, format);
      pass += 1;
      if (pass === 1) {
        await writeFile(join(root, 'b.xml'), entityXml('7812345675', '1047796045770', 'OOO BETA'));
      }
      return manifest;
    });

    await expect(service.validateFullSnapshot({ directory: root, format: '4.08' }))
      .rejects.toThrow('FNS_EGRUL_IMPORT_DIRECTORY_CHANGED_AFTER_MANIFEST');
  });

  it('fails closed when an XML file is removed between the two complete validation passes', async () => {
    const removed = join(root, 'b.xml');
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    await writeFile(removed, entityXml('7812345675', '1047796045770', 'OOO BETA'));

    const original = service.inspectFullSnapshot.bind(service);
    let pass = 0;
    jest.spyOn(service, 'inspectFullSnapshot').mockImplementation(async (directory, format) => {
      const manifest = await original(directory, format);
      pass += 1;
      if (pass === 1) {
        await rm(removed, { force: true });
      }
      return manifest;
    });

    await expect(service.validateFullSnapshot({ directory: root, format: '4.08' }))
      .rejects.toThrow('FNS_EGRUL_IMPORT_DIRECTORY_CHANGED_AFTER_MANIFEST');
  });

  it('rejects symlinks before reading a protected target', async () => {
    const outside = join(tmpdir(), `fns-egrul-outside-${Date.now()}.xml`);
    await writeFile(outside, entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    try {
      await symlink(outside, join(root, 'linked.xml'));
      await expect(service.validateFullSnapshot({ directory: root, format: '4.08' }))
        .rejects.toThrow('FNS_EGRUL_IMPORT_SYMLINK_FORBIDDEN');
    } finally {
      await rm(outside, { force: true });
    }
  });

  it('rejects a symlinked staging root before traversal', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const linkedRoot = join(tmpdir(), `fns-egrul-root-link-${process.pid}-${Date.now()}`);
    try {
      await symlink(root, linkedRoot, 'dir');
      await expect(service.validateFullSnapshot({ directory: linkedRoot, format: '4.08' }))
        .rejects.toThrow('FNS_EGRUL_IMPORT_SYMLINK_FORBIDDEN');
    } finally {
      await rm(linkedRoot, { force: true });
    }
  });

  it('rejects non-XML files instead of silently ignoring them', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    await writeFile(join(root, 'notes.txt'), 'not part of the governed snapshot');

    await expect(service.validateFullSnapshot({ directory: root, format: '4.08' }))
      .rejects.toThrow('FNS_EGRUL_IMPORT_NON_XML_FILE');
  });

  it('rejects mixed publication dates in one claimed snapshot', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA', '2026-09-05'));
    await writeFile(join(root, 'b.xml'), entityXml('7812345675', '1047796045770', 'OOO BETA', '2026-09-04'));

    await expect(service.validateFullSnapshot({ directory: root, format: '4.08' }))
      .rejects.toThrow('FNS_EGRUL_SNAPSHOT_PUBLICATION_DATE_MISMATCH');
  });

  it('rejects malformed XML through the strict EGRUL parser', async () => {
    await writeFile(
      join(root, 'broken.xml'),
      encodeWindows1251('<?xml version="1.0" encoding="windows-1251"?><EGRUL ДатаВыг="2026-09-05"><СвЮЛ>'),
    );

    await expect(service.validateFullSnapshot({ directory: root, format: '4.08' }))
      .rejects.toThrow('FNS_EGRUL_XML_STRUCTURE_INVALID');
  });

  it('rejects unsupported EGRUL formats', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));

    await expect(service.validateFullSnapshot({ directory: root, format: '5.00' as any }))
      .rejects.toThrow('FNS_EGRUL_FORMAT_UNSUPPORTED');
  });

  it('rejects invalid legal-entity identifiers', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('123', '1027700132195', 'OOO ALPHA'));

    await expect(service.validateFullSnapshot({ directory: root, format: '4.08' }))
      .rejects.toThrow('FNS_EGRUL_INN_INVALID');
  });

  it('requires an absolute staging root and never includes protected absolute paths in errors', async () => {
    await expect(service.validateFullSnapshot({ directory: 'relative/egrul', format: '4.08' }))
      .rejects.toThrow('FNS_EGRUL_IMPORT_DIR_MUST_BE_ABSOLUTE');

    await writeFile(join(root, 'bad.txt'), 'x');
    try {
      await service.validateFullSnapshot({ directory: root, format: '4.08' });
      throw new Error('TEST_EXPECTED_FAILURE');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('FNS_EGRUL_IMPORT_NON_XML_FILE');
      expect((error as Error).message).not.toContain(root);
    }
  });

  it('rejects a locally staged publication date from the future', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA', '2026-09-06'));

    await expect(service.validateFullSnapshot({ directory: root, format: '4.08' }))
      .rejects.toThrow('FNS_EGRUL_IMPORT_PUBLICATION_DATE_IN_FUTURE');
  });
});
