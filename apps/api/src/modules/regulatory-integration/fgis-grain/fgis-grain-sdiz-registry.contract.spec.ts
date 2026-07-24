import {
  FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION,
  FgisGrainSdizContractError,
  assertFgisGrainSdizApplicationCommand,
  computeFgisGrainSdizBatchFingerprint,
  type ValidatedFgisGrainSdizRecord,
} from './fgis-grain-sdiz-registry.contract';

const MESSAGE_ID = 'f47ac10b-58cc-11cf-a447-001122334455';
const REFERENCE_MESSAGE_ID = 'd9428888-122b-11e1-b85c-61cd3cbb3210';
const RAW_HASH = 'a'.repeat(64);

function rawRecord(overrides: Record<string, unknown> = {}) {
  return {
    providerSdizId: 'sdiz-id-1',
    sdizNumber: 'SDIZ-2026-0001',
    SDIZNumber: 'SDIZ-2026-0001',
    status: 'SUBSCRIBED',
    lotNumber: 'LOT-100',
    createLotNumber: 'CREATE-LOT-100',
    correctedBySDIZNumber: null,
    correctedSDIZNumber: null,
    extinctionId: null,
    extinctionRefusalId: null,
    providerOccurredAt: '2026-07-24T12:00:00.000Z',
    ...overrides,
  };
}

function fingerprint(records: Array<Record<string, unknown>>): string {
  const temporary = records.map((record) => {
    const command = {
      schemaVersion: FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION,
      sourceInboxEntryId: 'inbox-temp',
      workerId: 'worker-temp',
      rawBodySha256: RAW_HASH,
      messageId: MESSAGE_ID,
      referenceMessageId: REFERENCE_MESSAGE_ID,
      batchFingerprint: '0'.repeat(64),
      records: [record],
    };
    try {
      assertFgisGrainSdizApplicationCommand(command);
      throw new Error('expected fingerprint mismatch');
    } catch (error) {
      const normalized = (error as FgisGrainSdizContractError & {
        normalized?: ValidatedFgisGrainSdizRecord;
      }).normalized;
      if (normalized) return normalized;
    }
    const lower = String(record.sdizNumber ?? record.SDIZNumber);
    const normalized = {
      providerSdizId: String(record.providerSdizId),
      sdizNumber: lower,
      status: record.status,
      lotNumber: record.lotNumber,
      createLotNumber: record.createLotNumber,
      correctedBySdizNumber: record.correctedBySDIZNumber,
      correctedSdizNumber: record.correctedSDIZNumber,
      extinctionId: record.extinctionId,
      extinctionRefusalId: record.extinctionRefusalId,
      providerOccurredAt: new Date(String(record.providerOccurredAt)).toISOString(),
    };
    const crypto = require('node:crypto') as typeof import('node:crypto');
    const canonical = (value: unknown): string => {
      if (value === null || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
      const object = value as Record<string, unknown>;
      return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
    };
    return {
      ...normalized,
      recordFingerprint: crypto.createHash('sha256').update(canonical(normalized)).digest('hex'),
    } as ValidatedFgisGrainSdizRecord;
  }).sort((left, right) => left.providerSdizId.localeCompare(right.providerSdizId, 'en'));
  return computeFgisGrainSdizBatchFingerprint(temporary);
}

function command(
  records = [rawRecord()],
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION,
    sourceInboxEntryId: 'inbox-1',
    workerId: 'worker-1',
    rawBodySha256: RAW_HASH,
    messageId: MESSAGE_ID,
    referenceMessageId: REFERENCE_MESSAGE_ID,
    batchFingerprint: fingerprint(records),
    records,
    ...overrides,
  };
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('expected SDIZ contract error');
  } catch (error) {
    expect(error).toBeInstanceOf(FgisGrainSdizContractError);
    expect((error as FgisGrainSdizContractError).code).toBe(code);
  }
}

describe('FGIS Grain SDIZ registry contract', () => {
  it('normalizes aliases, sorts records and pins deterministic fingerprints', () => {
    const records = [
      rawRecord({ providerSdizId: 'sdiz-z', sdizNumber: null, SDIZNumber: 'SDIZ-Z' }),
      rawRecord({ providerSdizId: 'sdiz-a', sdizNumber: 'SDIZ-A', SDIZNumber: null }),
    ];
    const validated = assertFgisGrainSdizApplicationCommand(command(records));
    expect(validated.records.map((record) => record.providerSdizId))
      .toEqual(['sdiz-a', 'sdiz-z']);
    expect(validated.records.map((record) => record.sdizNumber))
      .toEqual(['SDIZ-A', 'SDIZ-Z']);
    expect(validated.batchFingerprint).toBe(fingerprint(records));
    expect(validated.records.every((record) => /^[a-f0-9]{64}$/u.test(record.recordFingerprint)))
      .toBe(true);
  });

  it.each([
    ['CREATED'],
    ['SUBSCRIBED'],
    ['CANCELED'],
    ['EXTINGUISHED'],
    ['SUBSCRIBED_CONFIRMED'],
  ])('accepts official SDIZ status %s', (status) => {
    expect(
      assertFgisGrainSdizApplicationCommand(
        command([rawRecord({ status })]),
      ).records[0]?.status,
    ).toBe(status);
  });

  it('rejects alias disagreement and missing SDIZ number', () => {
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(
        command([rawRecord({ SDIZNumber: 'OTHER' })]),
      ),
      'SDIZ_NUMBER_ALIAS_CONFLICT',
    );
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(
        command([rawRecord({ sdizNumber: null, SDIZNumber: null })]),
      ),
      'SDIZ_IDENTIFIER_INVALID',
    );
  });

  it('rejects duplicate IDs, unsupported status and malformed provider time', () => {
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(
        command([rawRecord(), rawRecord()]),
      ),
      'DUPLICATE_SDIZ_ID',
    );
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(
        command([rawRecord({ status: 'UNKNOWN' })]),
      ),
      'SDIZ_STATUS_UNSUPPORTED',
    );
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(
        command([rawRecord({ providerOccurredAt: '2026-07-24T12:00:00' })]),
      ),
      'PROVIDER_TIME_INVALID',
    );
  });

  it('rejects unknown fields, non-UUIDv1 messages and hash drift', () => {
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(
        command([rawRecord({ inventedProviderState: true })]),
      ),
      'MALFORMED_RECORD',
    );
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(
        command([rawRecord()], { messageId: 'f47ac10b-58cc-41cf-a447-001122334455' }),
      ),
      'MESSAGE_ID_INVALID',
    );
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(
        command([rawRecord()], { batchFingerprint: 'b'.repeat(64) }),
      ),
      'BATCH_FINGERPRINT_MISMATCH',
    );
  });

  it('enforces bounded non-empty batches', () => {
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(command([])),
      'BATCH_SIZE_INVALID',
    );
    expectCode(
      () => assertFgisGrainSdizApplicationCommand(
        command(Array.from({ length: 501 }, (_, index) => rawRecord({
          providerSdizId: `sdiz-${index}`,
          sdizNumber: `SDIZ-${index}`,
          SDIZNumber: `SDIZ-${index}`,
        }))),
      ),
      'BATCH_SIZE_INVALID',
    );
  });
});
