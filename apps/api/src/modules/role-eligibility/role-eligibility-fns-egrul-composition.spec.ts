import { RoleEligibilityFnsEgrulIngestRepository } from './role-eligibility-fns-egrul-ingest.repository';

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join('?') || String(query);
}

const BASE_ID = 'elg-base';
const TARGET_ID = 'elg-target';
const basePublishedAt = new Date('2026-09-04T00:00:00.000Z');
const targetPublishedAt = new Date('2026-09-05T00:00:00.000Z');

const base = {
  id: BASE_ID,
  source: 'FNS',
  status: 'ACTIVE',
  published_at: basePublishedAt,
  content_sha256: 'a'.repeat(64),
  parser_version: 'fns-egrul-v1',
  schema_version: 'EGRUL_408',
  record_count: 2n,
};
const target = {
  ...base,
  id: TARGET_ID,
  status: 'STAGING',
  published_at: targetPublishedAt,
  content_sha256: 'b'.repeat(64),
  record_count: 0n,
};
const record = {
  sourceRecordId: '1027700132195',
  subjectInn: '7707083893',
  subjectOgrn: '1027700132195',
  recordType: 'EGRUL_LEGAL_ENTITY' as const,
  normalizedPayload: {
    inn: '7707083893',
    ogrn: '1027700132195',
    kpp: '770101001',
    legalName: 'ООО РОМАШКА',
    active: true,
    status: 'ACTIVE' as const,
    primaryOkved: '01.11',
    additionalOkved: [] as string[],
    strongContradiction: false as const,
  },
  validFrom: new Date('2002-08-15T00:00:00.000Z'),
  validUntil: null,
};

function createRepository(queryResponses: unknown[][], executeResults: number[] = []) {
  const queryRaw = jest.fn();
  for (const response of queryResponses) queryRaw.mockResolvedValueOnce(response);
  const executeRaw = jest.fn();
  for (const result of executeResults) executeRaw.mockResolvedValueOnce(result);
  executeRaw.mockResolvedValue(1);
  const tx = { $queryRaw: queryRaw, $executeRaw: executeRaw };
  const transaction = jest.fn(async (task: (client: typeof tx) => Promise<unknown>) => task(tx));
  const registry = {
    validateAndActivate: jest.fn(),
    reject: jest.fn(),
  };
  const repository = new RoleEligibilityFnsEgrulIngestRepository(
    { $transaction: transaction } as any,
    registry as any,
  );
  return { repository, queryRaw, executeRaw, transaction };
}

describe('FNS EGRUL baseline plus daily-delta composition', () => {
  it('inherits the full active FNS generation into an empty newer staging generation', async () => {
    const { repository, queryRaw, executeRaw } = createRepository([[target], [base]], [2, 1]);

    await expect(repository.inheritActiveBase(TARGET_ID)).resolves.toEqual({
      baseGenerationId: BASE_ID,
      inherited: 2,
      replayed: false,
    });

    expect(sqlText(queryRaw.mock.calls[0][0])).toContain('FOR UPDATE');
    expect(sqlText(queryRaw.mock.calls[1][0])).toContain("source='FNS' AND status='ACTIVE'");
    expect(sqlText(executeRaw.mock.calls[0][0])).toContain('INSERT INTO eligibility.registry_records');
    expect(sqlText(executeRaw.mock.calls[0][0])).toContain('FROM eligibility.registry_records AS r');
    expect(sqlText(executeRaw.mock.calls[1][0])).toContain('SET record_count=?');
  });

  it('treats an exact inherited baseline replay as idempotent without copying records twice', async () => {
    const initialized = { ...target, record_count: 2n };
    const { repository, executeRaw } = createRepository([
      [initialized],
      [base],
      [{ count: 2n, unmatched: 0n }],
    ]);

    await expect(repository.inheritActiveBase(TARGET_ID)).resolves.toEqual({
      baseGenerationId: BASE_ID,
      inherited: 2,
      replayed: true,
    });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('fails closed when there is no active base or the delta is not newer', async () => {
    const noBase = createRepository([[target], []]);
    await expect(noBase.repository.inheritActiveBase(TARGET_ID))
      .rejects.toThrow('FNS_EGRUL_ACTIVE_BASE_REQUIRED');

    const staleTarget = { ...target, published_at: basePublishedAt };
    const notNewer = createRepository([[staleTarget], [base]]);
    await expect(notNewer.repository.inheritActiveBase(TARGET_ID))
      .rejects.toThrow('FNS_EGRUL_DELTA_NOT_NEWER_THAN_BASE');
  });

  it('replaces only matching OGRNs inside the staging target and keeps cardinality atomic', async () => {
    const inherited = { ...target, record_count: 2n };
    const changed = {
      ...record,
      normalizedPayload: {
        ...record.normalizedPayload,
        primaryOkved: '46.21',
      },
    };
    const { repository, executeRaw } = createRepository([[inherited], [base]], [1, 1, 1]);

    await expect(repository.applyDailyDelta(TARGET_ID, [changed])).resolves.toEqual({
      replaced: 1,
      inserted: 1,
    });

    const deleteSql = sqlText(executeRaw.mock.calls[0][0]);
    expect(deleteSql).toContain('DELETE FROM eligibility.registry_records');
    expect(deleteSql).toContain('generation_id=?');
    expect(deleteSql).toContain("source='FNS'");
    expect(deleteSql).toContain("record_type='EGRUL_LEGAL_ENTITY'");
    expect(sqlText(executeRaw.mock.calls[1][0])).toContain('INSERT INTO eligibility.registry_records');
    expect(sqlText(executeRaw.mock.calls[2][0])).toContain('SET record_count=?');
    expect((executeRaw.mock.calls[2][0] as { values?: unknown[] }).values).toContain(2n);
  });

  it('allows a genuinely new OGRN in a daily delta and increments effective snapshot cardinality', async () => {
    const inherited = { ...target, record_count: 2n };
    const newRecord = {
      ...record,
      sourceRecordId: '1047796045770',
      subjectInn: '7812345675',
      subjectOgrn: '1047796045770',
      normalizedPayload: {
        ...record.normalizedPayload,
        inn: '7812345675',
        ogrn: '1047796045770',
        legalName: 'ООО НОВОЕ',
      },
    };
    const { repository, executeRaw } = createRepository([[inherited], [base]], [0, 1, 1]);

    await expect(repository.applyDailyDelta(TARGET_ID, [newRecord])).resolves.toEqual({
      replaced: 0,
      inserted: 1,
    });
    expect((executeRaw.mock.calls[2][0] as { values?: unknown[] }).values).toContain(3n);
  });

  it('refuses delta application before the active baseline has been inherited', async () => {
    const partial = { ...target, record_count: 1n };
    const { repository, executeRaw } = createRepository([[partial], [base]]);

    await expect(repository.applyDailyDelta(TARGET_ID, [record]))
      .rejects.toThrow('FNS_EGRUL_DELTA_BASE_NOT_INHERITED');
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('keeps all composition mutations transaction-bound', async () => {
    const { repository, transaction } = createRepository([[target], [base]], [2, 1]);
    await repository.inheritActiveBase(TARGET_ID);
    expect(transaction).toHaveBeenCalledTimes(1);

    const inherited = { ...target, record_count: 2n };
    const delta = createRepository([[inherited], [base]], [1, 1, 1]);
    await delta.repository.applyDailyDelta(TARGET_ID, [record]);
    expect(delta.transaction).toHaveBeenCalledTimes(1);
  });
});
