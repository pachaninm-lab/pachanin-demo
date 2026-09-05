import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FNS_EGRUL_COVERAGE_AUTHORITY,
  FnsEgrulFileImportService,
  type FnsEgrulFullSnapshotImportInput,
  type FnsEgrulSnapshotManifest,
} from './fns-egrul-file-import.service';

const NOW = new Date('2026-09-05T03:00:00.000Z');
const FRESH_UNTIL = new Date('2026-09-06T00:00:00.000Z');

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

function coverageProof(manifest: FnsEgrulSnapshotManifest) {
  return {
    authority: FNS_EGRUL_COVERAGE_AUTHORITY,
    capturedAt: NOW,
    publishedAt: manifest.publishedAt,
    contentSha256: manifest.contentSha256,
    fileCount: manifest.fileCount,
    recordCount: manifest.recordCount,
  };
}

async function importWithCoverage(
  service: FnsEgrulFileImportService,
  input: Omit<FnsEgrulFullSnapshotImportInput, 'coverageProof'>,
) {
  const manifest = await service.inspectFullSnapshot(input.directory, input.format);
  return service.importFullSnapshot({ ...input, coverageProof: coverageProof(manifest) });
}

function activeGeneration(input: {
  id?: string;
  contentSha256?: string;
  recordCount?: bigint;
  publishedAt?: Date;
  freshUntil?: Date;
} = {}) {
  return {
    id: input.id ?? 'elg-test',
    source: 'FNS',
    generation: '2026-09-05T00:00:00.000Z:0123456789abcdef',
    publishedAt: input.publishedAt ?? new Date('2026-09-05T00:00:00.000Z'),
    downloadedAt: NOW,
    contentSha256: input.contentSha256 ?? 'a'.repeat(64),
    recordCount: input.recordCount ?? 1n,
    parserVersion: 'fns-egrul-v1',
    schemaVersion: 'EGRUL_408',
    status: 'ACTIVE',
    freshUntil: input.freshUntil ?? FRESH_UNTIL,
  };
}

function generationRow(input: {
  id?: string;
  status?: 'STAGING' | 'VALIDATED' | 'ACTIVE';
  recordCount?: bigint;
  contentSha256?: string;
  publishedAt?: Date;
  freshUntil?: Date;
} = {}) {
  const publishedAt = input.publishedAt ?? new Date('2026-09-05T00:00:00.000Z');
  return {
    id: input.id ?? 'elg-test',
    source: 'FNS',
    generation: `${publishedAt.toISOString()}:0123456789abcdef`,
    published_at: publishedAt,
    downloaded_at: NOW,
    content_sha256: input.contentSha256 ?? 'a'.repeat(64),
    record_count: input.recordCount ?? 1n,
    parser_version: 'fns-egrul-v1',
    schema_version: 'EGRUL_408',
    status: input.status ?? 'STAGING',
    fresh_until: input.freshUntil ?? FRESH_UNTIL,
  };
}

function activationRow(input: Parameters<typeof generationRow>[0] = {}, fresh = true) {
  return { ...generationRow(input), fresh_at_activation: fresh };
}

function ingestMock() {
  return {
    begin: jest.fn().mockResolvedValue({
      id: 'elg-test',
      generation: '2026-09-05T00:00:00.000Z:0123456789abcdef',
      alreadyActive: false,
    }),
    append: jest.fn().mockImplementation(async (_id: string, records: unknown[]) => ({ inserted: records.length, replayed: 0 })),
    activate: jest.fn().mockResolvedValue(activeGeneration()),
  };
}

function prismaMock(
  recordCount = 1n,
  actualCount = recordCount,
  options: {
    freshUntil?: Date;
    contentSha256?: string;
    activePublishedAt?: Date;
    duplicateRecords?: bigint;
    freshAtActivation?: boolean;
  } = {},
) {
  const staging = generationRow({
    recordCount,
    freshUntil: options.freshUntil,
    contentSha256: options.contentSha256,
  });
  const activationStaging = {
    ...staging,
    fresh_at_activation: options.freshAtActivation ?? true,
  };
  const activated = {
    ...generationRow({
      status: 'ACTIVE',
      recordCount,
      freshUntil: options.freshUntil,
      contentSha256: options.contentSha256,
    }),
    fresh_at_activation: true,
  };
  const queryRaw = jest.fn()
    .mockResolvedValueOnce([staging])
    .mockResolvedValueOnce([{ record_count: recordCount, actual_count: actualCount }]);
  const txQueryRaw = jest.fn()
    .mockResolvedValueOnce([{ locked: true }])
    .mockResolvedValueOnce([activationStaging])
    .mockResolvedValueOnce(options.activePublishedAt ? [generationRow({
      id: 'elg-current',
      status: 'ACTIVE',
      publishedAt: options.activePublishedAt,
      recordCount,
    })] : [])
    .mockResolvedValueOnce([{ count: recordCount, duplicate_records: options.duplicateRecords ?? 0n }])
    .mockResolvedValueOnce([{ activate_registry_generation: 'elg-test' }])
    .mockResolvedValueOnce([activated]);
  const txExecuteRaw = jest.fn().mockResolvedValue(1);
  const transaction = jest.fn(async (task: (tx: { $queryRaw: typeof txQueryRaw; $executeRaw: typeof txExecuteRaw }) => Promise<unknown>) => (
    task({ $queryRaw: txQueryRaw, $executeRaw: txExecuteRaw })
  ));
  return {
    $queryRaw: queryRaw,
    $transaction: transaction,
    txQueryRaw,
    txExecuteRaw,
  };
}

function registryMock(active: unknown = null) {
  return {
    active: jest.fn().mockResolvedValue(active),
    auditSourceEvent: jest.fn().mockResolvedValue(undefined),
  };
}

function healthMock() {
  return {
    success: jest.fn().mockResolvedValue(undefined),
    failure: jest.fn().mockResolvedValue(undefined),
  };
}

function serviceWith(
  ingest = ingestMock(),
  prisma = prismaMock(),
  registry = registryMock(),
  health = healthMock(),
) {
  return {
    service: new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any),
    ingest,
    prisma,
    registry,
    health,
  };
}

describe('FnsEgrulFileImportService', () => {
  let root: string;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    root = await mkdtemp(join(tmpdir(), 'fns-egrul-import-'));
  });

  afterEach(async () => {
    jest.useRealTimers();
    await rm(root, { recursive: true, force: true });
  });

  it('builds a deterministic manifest, activates a bounded snapshot, then records success metadata inside the activation transaction', async () => {
    await mkdir(join(root, 'archive-b'));
    await mkdir(join(root, 'archive-a'));
    await writeFile(join(root, 'archive-b', 'b.xml'), entityXml('7812345675', '1047796045770', 'OOO BETA'));
    await writeFile(join(root, 'archive-a', 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));

    const ingest = ingestMock();
    const prisma = prismaMock(2n);
    const registry = registryMock();
    const health = healthMock();
    const service = new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any);
    const manifest = await service.inspectFullSnapshot(root, '4.08');

    expect(manifest.fileCount).toBe(2);
    expect(manifest.recordCount).toBe(2);
    expect(manifest.files.map((entry) => entry.relativePath)).toEqual(['archive-a/a.xml', 'archive-b/b.xml']);
    expect(manifest.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.publishedAt.toISOString()).toBe('2026-09-05T00:00:00.000Z');

    const result = await service.importFullSnapshot({
      directory: root,
      format: '4.08',
      downloadedAt: NOW,
      freshUntil: FRESH_UNTIL,
      coverageProof: coverageProof(manifest),
    });

    expect(result).toMatchObject({ fileCount: 2, recordCount: 2, inserted: 2, replayed: 0, alreadyActive: false });
    expect(ingest.begin).toHaveBeenCalledWith(expect.objectContaining({
      format: '4.08',
      contentSha256: manifest.contentSha256,
      publishedAt: new Date('2026-09-05T00:00:00.000Z'),
    }));
    expect(ingest.append).toHaveBeenCalledTimes(2);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.txExecuteRaw).toHaveBeenCalledTimes(3);
    expect(ingest.activate).not.toHaveBeenCalled();
    expect(health.success).not.toHaveBeenCalled();
    expect(registry.auditSourceEvent).toHaveBeenCalledWith(
      'ROLE_ELIGIBILITY_SOURCE_FETCH_STARTED',
      'FNS',
      'fns-egrul-file-import:elg-test',
      expect.objectContaining({
        mode: 'FULL_SNAPSHOT_AUTHORIZED_FILE_IMPORT',
        recordCount: 2,
        coverageAuthority: FNS_EGRUL_COVERAGE_AUTHORITY,
        coverageCapturedAt: NOW.toISOString(),
      }),
    );
    expect(JSON.stringify(registry.auditSourceEvent.mock.calls)).not.toContain(root);
  });

  it('refuses an internally valid tiny snapshot when no independent coverage proof is supplied', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    const { service } = serviceWith(ingest);

    await expect(service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
    } as unknown as FnsEgrulFullSnapshotImportInput)).rejects.toThrow(
      'FNS_EGRUL_IMPORT_COVERAGE_PROOF_AUTHORITY_INVALID',
    );
    expect(ingest.begin).not.toHaveBeenCalled();
  });

  it('rejects a mismatched independent coverage proof before opening a database generation', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    const { service } = serviceWith(ingest);
    const manifest = await service.inspectFullSnapshot(root, '4.08');

    await expect(service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: { ...coverageProof(manifest), fileCount: manifest.fileCount + 1 },
    })).rejects.toThrow('FNS_EGRUL_IMPORT_COVERAGE_PROOF_MISMATCH');
    expect(ingest.begin).not.toHaveBeenCalled();
  });

  it('rejects future coverage-capture metadata before opening a database generation', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    const { service } = serviceWith(ingest);
    const manifest = await service.inspectFullSnapshot(root, '4.08');

    await expect(service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: {
        ...coverageProof(manifest),
        capturedAt: new Date('2026-09-05T03:00:01.000Z'),
      },
    })).rejects.toThrow('FNS_EGRUL_IMPORT_COVERAGE_PROOF_CAPTURED_AT_INVALID');
    expect(ingest.begin).not.toHaveBeenCalled();
  });

  it('rejects stale and overlong freshness windows before opening a database generation', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    const { service } = serviceWith(ingest);

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: new Date('2026-09-05T02:59:59.000Z'),
    })).rejects.toThrow('FNS_EGRUL_IMPORT_SNAPSHOT_STALE');

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: new Date('2026-10-11T00:00:00.000Z'),
    })).rejects.toThrow('FNS_EGRUL_IMPORT_FRESHNESS_CEILING_EXCEEDED');

    expect(ingest.begin).not.toHaveBeenCalled();
  });

  it('rejects a future-dated official snapshot before opening a database generation', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA', '2026-09-06'));
    const ingest = ingestMock();
    const { service } = serviceWith(ingest);

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: new Date('2026-09-07T00:00:00.000Z'),
    })).rejects.toThrow('FNS_EGRUL_IMPORT_PUBLICATION_DATE_IN_FUTURE');
    expect(ingest.begin).not.toHaveBeenCalled();
  });

  it('rejects mixed publication dates before opening a database generation', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA', '2026-09-05'));
    await writeFile(join(root, 'b.xml'), entityXml('7812345675', '1047796045770', 'OOO BETA', '2026-09-04'));

    const ingest = ingestMock();
    const { service } = serviceWith(ingest);
    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
    })).rejects.toThrow('FNS_EGRUL_SNAPSHOT_PUBLICATION_DATE_MISMATCH');
    expect(ingest.begin).not.toHaveBeenCalled();
  });

  it('normalizes unavailable directory errors and rejects non-XML archive residue', async () => {
    const { service } = serviceWith();
    const missing = join(root, 'protected-missing-path');
    await expect(service.inspectFullSnapshot(missing, '4.08')).rejects.toMatchObject({
      message: 'FNS_EGRUL_IMPORT_DIRECTORY_UNAVAILABLE',
    });

    await expect(service.inspectFullSnapshot(root, '4.08')).rejects.toThrow('FNS_EGRUL_IMPORT_EMPTY_DIRECTORY');
    await writeFile(join(root, 'README.txt'), 'unexpected');
    await expect(service.inspectFullSnapshot(root, '4.08')).rejects.toThrow('FNS_EGRUL_IMPORT_NON_XML_FILE');
  });

  it('normalizes nested directory traversal errors instead of exposing protected paths', async () => {
    if (process.platform === 'win32') return;
    const nested = join(root, 'protected');
    await mkdir(nested);
    await chmod(nested, 0o000);
    try {
      await expect(serviceWith().service.inspectFullSnapshot(root, '4.08')).rejects.toMatchObject({
        message: 'FNS_EGRUL_IMPORT_DIRECTORY_READ_FAILED',
      });
    } finally {
      await chmod(nested, 0o700);
    }
  });

  it('detects source-file drift after staging and records a stable failed import event', async () => {
    const file = join(root, 'a.xml');
    await writeFile(file, entityXml('7707083893', '1027700132195', 'OOO ALPHA'));

    const ingest = ingestMock();
    ingest.begin.mockImplementationOnce(async () => {
      await writeFile(file, entityXml('7812345675', '1047796045770', 'OOO BETA'));
      return {
        id: 'elg-test',
        generation: '2026-09-05T00:00:00.000Z:0123456789abcdef',
        alreadyActive: false,
      };
    });
    const prisma = prismaMock();
    const registry = registryMock();
    const health = healthMock();
    const { service } = serviceWith(ingest, prisma, registry, health);

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
    })).rejects.toThrow('FNS_EGRUL_FILE_CHANGED_AFTER_MANIFEST');
    expect(ingest.append).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_EGRUL_FILE_CHANGED_AFTER_MANIFEST');
    expect(registry.auditSourceEvent).toHaveBeenCalledWith(
      'ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED',
      'FNS',
      'fns-egrul-file-import:elg-test',
      expect.objectContaining({ errorCode: 'FNS_EGRUL_FILE_CHANGED_AFTER_MANIFEST' }),
    );
    expect(JSON.stringify(registry.auditSourceEvent.mock.calls)).not.toContain(root);
  });

  it('rejects a file added after the initial manifest before activating the snapshot', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    ingest.append.mockImplementationOnce(async (_id: string, records: unknown[]) => {
      await writeFile(join(root, 'b.xml'), entityXml('7812345675', '1047796045770', 'OOO BETA'));
      return { inserted: records.length, replayed: 0 };
    });
    const prisma = prismaMock();
    const { service } = serviceWith(ingest, prisma);

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
    })).rejects.toThrow('FNS_EGRUL_IMPORT_DIRECTORY_CHANGED_AFTER_MANIFEST');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a resumed staging generation whose persisted freshness has already expired', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const prisma = prismaMock(1n, 1n, { freshUntil: new Date('2026-09-05T02:00:00.000Z') });
    const registry = registryMock();
    const health = healthMock();
    const { service, ingest } = serviceWith(ingestMock(), prisma, registry, health);

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
    })).rejects.toThrow('FNS_EGRUL_IMPORT_STORED_SNAPSHOT_STALE');
    expect(ingest.append).not.toHaveBeenCalled();
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_EGRUL_IMPORT_STORED_SNAPSHOT_STALE');
  });

  it('rejects a resumed staging generation when the requested and persisted freshness differ', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const prisma = prismaMock(1n, 1n, { freshUntil: new Date('2026-09-05T20:00:00.000Z') });
    const { service, ingest } = serviceWith(ingestMock(), prisma);

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
    })).rejects.toThrow('FNS_EGRUL_IMPORT_STORED_FRESHNESS_MISMATCH');
    expect(ingest.append).not.toHaveBeenCalled();
  });

  it('rechecks stored freshness transactionally immediately before activation', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const prisma = prismaMock(1n, 1n, { freshAtActivation: false });
    const registry = registryMock();
    const health = healthMock();
    const { service } = serviceWith(ingestMock(), prisma, registry, health);

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
    })).rejects.toThrow('FNS_EGRUL_IMPORT_STORED_SNAPSHOT_STALE_AT_ACTIVATION');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.txQueryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.txExecuteRaw).not.toHaveBeenCalled();
    expect(health.failure).toHaveBeenCalledWith(
      'FNS',
      'UNAVAILABLE',
      'FNS_EGRUL_IMPORT_STORED_SNAPSHOT_STALE_AT_ACTIVATION',
    );
    expect(registry.auditSourceEvent).toHaveBeenCalledWith(
      'ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED',
      'FNS',
      'fns-egrul-file-import:elg-test',
      expect.objectContaining({ errorCode: 'FNS_EGRUL_IMPORT_STORED_SNAPSHOT_STALE_AT_ACTIVATION' }),
    );
  });

  it('refuses to replace a newer active FNS generation without degrading its healthy source state', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const prisma = prismaMock(1n, 1n, { activePublishedAt: new Date('2026-09-06T00:00:00.000Z') });
    const registry = registryMock();
    const health = healthMock();
    const { service } = serviceWith(ingestMock(), prisma, registry, health);

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
    })).rejects.toThrow('FNS_EGRUL_IMPORT_ACTIVE_GENERATION_NEWER_OR_EQUAL');
    expect(prisma.txExecuteRaw).not.toHaveBeenCalled();
    expect(health.failure).not.toHaveBeenCalled();
    expect(registry.auditSourceEvent).toHaveBeenCalledWith(
      'ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED',
      'FNS',
      'fns-egrul-file-import:elg-test',
      expect.objectContaining({ errorCode: 'FNS_EGRUL_IMPORT_ACTIVE_GENERATION_NEWER_OR_EQUAL' }),
    );
  });

  it('treats concurrent identical activation during append as a locked successful exact replay', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    ingest.append.mockRejectedValueOnce(new Error('FNS_EGRUL_GENERATION_NOT_STAGING'));
    const prisma = prismaMock();
    const registry = registryMock();
    const health = healthMock();
    const service = new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any);
    const manifest = await service.inspectFullSnapshot(root, '4.08');
    prisma.txQueryRaw.mockReset();
    prisma.txExecuteRaw.mockReset().mockResolvedValue(1);
    prisma.txQueryRaw
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([activationRow({ status: 'ACTIVE', contentSha256: manifest.contentSha256, recordCount: 1n })]);

    const result = await service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: coverageProof(manifest),
    });

    expect(result).toMatchObject({ inserted: 0, replayed: 1, alreadyActive: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.txExecuteRaw).toHaveBeenCalledTimes(2);
    expect(health.failure).not.toHaveBeenCalled();
    expect(health.success).not.toHaveBeenCalled();
  });

  it('treats identical generation that becomes active before cardinality validation as a locked successful replay', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    const prisma = prismaMock();
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw
      .mockResolvedValueOnce([generationRow({ recordCount: 1n })])
      .mockResolvedValueOnce([{ record_count: 1n, actual_count: 1n }]);
    const registry = registryMock();
    const health = healthMock();
    const service = new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any);
    const manifest = await service.inspectFullSnapshot(root, '4.08');
    prisma.txQueryRaw.mockReset();
    prisma.txExecuteRaw.mockReset().mockResolvedValue(1);
    prisma.txQueryRaw
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([activationRow({ status: 'ACTIVE', contentSha256: manifest.contentSha256, recordCount: 1n })]);

    const result = await service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: coverageProof(manifest),
    });

    expect(result).toMatchObject({ inserted: 0, replayed: 1, alreadyActive: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.txExecuteRaw).toHaveBeenCalledTimes(2);
    expect(health.failure).not.toHaveBeenCalled();
    expect(health.success).not.toHaveBeenCalled();
  });

  it('does not let a superseded older replay overwrite success metadata for a newer active generation', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    ingest.begin.mockResolvedValueOnce({
      id: 'elg-test',
      generation: '2026-09-05T00:00:00.000Z:0123456789abcdef',
      alreadyActive: true,
    });
    const prisma = prismaMock();
    const registry = registryMock();
    const health = healthMock();
    const service = new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any);
    const manifest = await service.inspectFullSnapshot(root, '4.08');
    prisma.txQueryRaw.mockReset();
    prisma.txExecuteRaw.mockReset().mockResolvedValue(1);
    prisma.txQueryRaw
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([activationRow({
        status: 'VALIDATED',
        contentSha256: manifest.contentSha256,
        recordCount: 1n,
        publishedAt: manifest.publishedAt,
      })])
      .mockResolvedValueOnce([generationRow({
        id: 'elg-newer',
        status: 'ACTIVE',
        publishedAt: new Date('2026-09-06T00:00:00.000Z'),
        recordCount: 1n,
      })]);

    await expect(service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: coverageProof(manifest),
    })).rejects.toThrow('FNS_EGRUL_IMPORT_ACTIVE_GENERATION_NEWER_OR_EQUAL');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.txExecuteRaw).not.toHaveBeenCalled();
    expect(health.success).not.toHaveBeenCalled();
    expect(health.failure).not.toHaveBeenCalled();
    expect(registry.auditSourceEvent).toHaveBeenCalledWith(
      'ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED',
      'FNS',
      'fns-egrul-file-import:elg-test',
      expect.objectContaining({ errorCode: 'FNS_EGRUL_IMPORT_ACTIVE_GENERATION_NEWER_OR_EQUAL' }),
    );
  });

  it('rejects an exact duplicate OGRN across snapshot files before activation', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    await writeFile(join(root, 'b.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));

    const ingest = ingestMock();
    ingest.append
      .mockResolvedValueOnce({ inserted: 1, replayed: 0 })
      .mockResolvedValueOnce({ inserted: 0, replayed: 1 });
    const prisma = prismaMock(1n, 1n);
    const { service } = serviceWith(ingest, prisma);

    await expect(importWithCoverage(service, {
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
    })).rejects.toThrow('FNS_EGRUL_IMPORT_UNIQUE_OGRN_CARDINALITY_MISMATCH');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale exact already-active replay instead of restoring healthy status', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    ingest.begin.mockResolvedValueOnce({
      id: 'elg-active',
      generation: '2026-09-05T00:00:00.000Z:0123456789abcdef',
      alreadyActive: true,
    });
    const prisma = prismaMock();
    const registry = registryMock();
    const health = healthMock();
    const service = new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any);
    const manifest = await service.inspectFullSnapshot(root, '4.08');
    prisma.txQueryRaw.mockReset();
    prisma.txQueryRaw
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([activationRow({
        id: 'elg-active',
        status: 'ACTIVE',
        contentSha256: manifest.contentSha256,
        recordCount: 1n,
        freshUntil: new Date('2026-09-05T02:59:59.000Z'),
      }, false)]);

    await expect(service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: coverageProof(manifest),
    })).rejects.toThrow('FNS_EGRUL_IMPORT_ACTIVE_SNAPSHOT_STALE');
    expect(prisma.txExecuteRaw).not.toHaveBeenCalled();
    expect(health.success).not.toHaveBeenCalled();
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_EGRUL_IMPORT_ACTIVE_SNAPSHOT_STALE');
  });

  it('rejects an exact already-active replay when persisted cardinality no longer matches the manifest', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    ingest.begin.mockResolvedValueOnce({
      id: 'elg-active',
      generation: '2026-09-05T00:00:00.000Z:0123456789abcdef',
      alreadyActive: true,
    });
    const prisma = prismaMock();
    const registry = registryMock();
    const health = healthMock();
    const service = new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any);
    const manifest = await service.inspectFullSnapshot(root, '4.08');
    prisma.txQueryRaw.mockReset();
    prisma.txQueryRaw
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([activationRow({
        id: 'elg-active',
        status: 'ACTIVE',
        contentSha256: manifest.contentSha256,
        recordCount: 2n,
      })]);

    await expect(service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: coverageProof(manifest),
    })).rejects.toThrow('FNS_EGRUL_IMPORT_ACTIVE_GENERATION_MISMATCH');
    expect(health.success).not.toHaveBeenCalled();
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_EGRUL_IMPORT_ACTIVE_GENERATION_MISMATCH');
  });

  it('repairs source success metadata on an exact already-active replay while the activation lock is held', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    ingest.begin.mockResolvedValueOnce({
      id: 'elg-active',
      generation: '2026-09-05T00:00:00.000Z:0123456789abcdef',
      alreadyActive: true,
    });
    const prisma = prismaMock();
    const registry = registryMock();
    const health = healthMock();
    const service = new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any);
    const manifest = await service.inspectFullSnapshot(root, '4.08');
    prisma.txQueryRaw.mockReset();
    prisma.txExecuteRaw.mockReset().mockResolvedValue(1);
    prisma.txQueryRaw
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([activationRow({
        id: 'elg-active',
        status: 'ACTIVE',
        contentSha256: manifest.contentSha256,
        recordCount: 1n,
      })]);

    const result = await service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: coverageProof(manifest),
    });

    expect(result).toMatchObject({ inserted: 0, replayed: 1, alreadyActive: true });
    expect(ingest.append).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.txExecuteRaw).toHaveBeenCalledTimes(2);
    expect(health.success).not.toHaveBeenCalled();
    expect(health.failure).not.toHaveBeenCalled();
  });

  it('retries transient P2034 and 40001 serialization collisions before completing an exact active replay', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    ingest.begin.mockResolvedValueOnce({
      id: 'elg-active',
      generation: '2026-09-05T00:00:00.000Z:0123456789abcdef',
      alreadyActive: true,
    });
    const prisma = prismaMock();
    const registry = registryMock();
    const health = healthMock();
    const service = new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any);
    const manifest = await service.inspectFullSnapshot(root, '4.08');
    prisma.txQueryRaw.mockReset();
    prisma.txExecuteRaw.mockReset().mockResolvedValue(1);
    prisma.txQueryRaw
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([activationRow({
        id: 'elg-active',
        status: 'ACTIVE',
        contentSha256: manifest.contentSha256,
        recordCount: 1n,
      })]);
    prisma.$transaction
      .mockRejectedValueOnce(Object.assign(new Error('write conflict'), { code: 'P2034' }))
      .mockRejectedValueOnce(Object.assign(new Error('serialization failure'), { code: '40001' }));

    const result = await service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: coverageProof(manifest),
    });

    expect(result).toMatchObject({ inserted: 0, replayed: 1, alreadyActive: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.txExecuteRaw).toHaveBeenCalledTimes(2);
    expect(health.failure).not.toHaveBeenCalled();
  });

  it('audits retry exhaustion without downgrading a valid FNS source to unavailable', async () => {
    await writeFile(join(root, 'a.xml'), entityXml('7707083893', '1027700132195', 'OOO ALPHA'));
    const ingest = ingestMock();
    ingest.begin.mockResolvedValueOnce({
      id: 'elg-active',
      generation: '2026-09-05T00:00:00.000Z:0123456789abcdef',
      alreadyActive: true,
    });
    const prisma = prismaMock();
    const registry = registryMock();
    const health = healthMock();
    const service = new FnsEgrulFileImportService(ingest as any, prisma as any, registry as any, health as any);
    const manifest = await service.inspectFullSnapshot(root, '4.08');
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('could not serialize access due to concurrent update'), { code: 'P2034' }));

    await expect(service.importFullSnapshot({
      directory: root,
      format: '4.08',
      freshUntil: FRESH_UNTIL,
      coverageProof: coverageProof(manifest),
    })).rejects.toThrow('FNS_EGRUL_IMPORT_SERIALIZATION_RETRIES_EXHAUSTED');

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(health.failure).not.toHaveBeenCalled();
    expect(registry.auditSourceEvent).toHaveBeenCalledWith(
      'ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED',
      'FNS',
      'fns-egrul-file-import:elg-active',
      expect.objectContaining({ errorCode: 'FNS_EGRUL_IMPORT_SERIALIZATION_RETRIES_EXHAUSTED' }),
    );
  });
});
