import {
  FGIS_GRAIN_SDIZ_MAX_BATCH_SIZE,
  FGIS_GRAIN_SDIZ_PROJECTION_COMMAND_SCHEMA,
  FgisGrainSdizProjectionContractError,
  computeFgisGrainSdizBatchFingerprint,
  normalizeFgisGrainSdizProjectionCommand,
  normalizeFgisGrainSdizRecord,
} from './fgis-grain-sdiz-projection.contract';

const occurredAt = '2026-07-24T12:00:00.000Z';

function record(overrides: Record<string, unknown> = {}) {
  return {
    sdizID: 'sdiz-1',
    sdizNumber: 'SDIZ-0001',
    status: 'CREATED',
    lotNumber: 'LOT-1',
    ...overrides,
  };
}

function command(records: readonly unknown[], overrides: Record<string, unknown> = {}) {
  const canonicalRecords = records.map(normalizeFgisGrainSdizRecord)
    .sort((left, right) => left.sdizId.localeCompare(right.sdizId));
  const fingerprint = computeFgisGrainSdizBatchFingerprint({
    providerMessageId: 'message-1',
    providerReferenceMessageId: 'reference-1',
    rawBodySha256: 'a'.repeat(64),
    providerOccurredAt: occurredAt,
    records: canonicalRecords,
  });
  return {
    schemaVersion: FGIS_GRAIN_SDIZ_PROJECTION_COMMAND_SCHEMA,
    inboxEntryId: 'inbox-1',
    workerId: 'worker-1',
    expectedInboxVersion: '7',
    providerMessageId: 'message-1',
    providerReferenceMessageId: 'reference-1',
    rawBodySha256: 'a'.repeat(64),
    providerOccurredAt: occurredAt,
    batchFingerprint: fingerprint,
    records,
    correlationId: 'correlation-1',
    idempotencyKey: 'idempotency-1',
    reason: 'Применение проверенной проекции СДИЗ из ФГИС Зерно',
    ...overrides,
  };
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('expected projection contract rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(FgisGrainSdizProjectionContractError);
    expect(error).toMatchObject({ code });
  }
}

describe('FGIS Grain SDIZ projection contract', () => {
  it('normalizes aliases, exact identifiers and deterministic ordering', () => {
    const result = normalizeFgisGrainSdizProjectionCommand(command([
      record({ sdizID: 'sdiz-2', sdizNumber: undefined, SDIZNumber: 'SDIZ-0002', status: 'SUBSCRIBED' }),
      record({ correctedBySDIZNumber: 'SDIZ-OLD', correctedSDIZNumber: 'SDIZ-CORRECTED', extinctionId: 'ext-1' }),
    ]));
    expect(result.records.map((item) => item.sdizId)).toEqual(['sdiz-1', 'sdiz-2']);
    expect(result.records[0]).toMatchObject({
      sdizNumber: 'SDIZ-0001',
      correctedBySdizNumber: 'SDIZ-OLD',
      correctedSdizNumber: 'SDIZ-CORRECTED',
      extinctionId: 'ext-1',
    });
    expect(result.records[1]).toMatchObject({ sdizNumber: 'SDIZ-0002', status: 'SUBSCRIBED' });
    expect(result.batchFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rejects SDIZ number alias disagreement', () => {
    expectCode(
      () => normalizeFgisGrainSdizRecord(record({ SDIZNumber: 'ANOTHER-NUMBER' })),
      'SDIZ_NUMBER_ALIAS_CONFLICT',
    );
  });

  it('rejects unsupported provider fields and raw XML', () => {
    expectCode(
      () => normalizeFgisGrainSdizRecord({ ...record(), rawXml: '<sdiz />' }),
      'MALFORMED_RECORD',
    );
  });

  it('accepts only official SDIZ statuses', () => {
    expectCode(
      () => normalizeFgisGrainSdizRecord(record({ status: 'APPROVED' })),
      'UNSUPPORTED_STATUS',
    );
  });

  it('rejects duplicate SDIZ identifiers and numbers', () => {
    expectCode(
      () => normalizeFgisGrainSdizProjectionCommand(command([
        record(),
        record({ sdizNumber: 'SDIZ-0002' }),
      ])),
      'DUPLICATE_SDIZ_ID',
    );
    expectCode(
      () => normalizeFgisGrainSdizProjectionCommand(command([
        record(),
        record({ sdizID: 'sdiz-2' }),
      ])),
      'DUPLICATE_SDIZ_NUMBER',
    );
  });

  it('rejects oversized batches', () => {
    const records = Array.from({ length: FGIS_GRAIN_SDIZ_MAX_BATCH_SIZE + 1 }, (_, index) =>
      record({ sdizID: `sdiz-${index}`, sdizNumber: `SDIZ-${index}` }));
    expectCode(
      () => normalizeFgisGrainSdizProjectionCommand(command(records)),
      'BATCH_LIMIT_EXCEEDED',
    );
  });

  it('rejects a batch fingerprint not bound to the exact records', () => {
    expectCode(
      () => normalizeFgisGrainSdizProjectionCommand(command([record()], { batchFingerprint: 'b'.repeat(64) })),
      'BATCH_FINGERPRINT_MISMATCH',
    );
  });
});
