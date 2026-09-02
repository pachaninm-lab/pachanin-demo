import { RoleEligibilityRegistrySyncService } from './role-eligibility-registry-sync.service';
import { EligibilitySourceError, type RegistryAdapterFetchResult, type RegistryGeneration } from './role-eligibility.types';

function payload(): RegistryAdapterFetchResult {
  return {
    source: 'CBR',
    sourceName: 'CBR test',
    origin: 'https://www.cbr.ru/',
    publishedAt: new Date(),
    checkedAt: new Date(),
    parserVersion: 'test-parser-v1',
    schemaVersion: 'test-schema-v1',
    contentSha256: 'a'.repeat(64),
    records: [{
      sourceRecordId: '1',
      subjectInn: null,
      subjectOgrn: '1027700132195',
      recordType: 'CREDIT_ORGANIZATION',
      normalizedPayload: { active: true },
      validFrom: null,
      validUntil: null,
    }],
  };
}

function generation(status: RegistryGeneration['status']): RegistryGeneration {
  const fetched = payload();
  return {
    id: 'gen-1',
    source: 'CBR',
    generation: '2026:test',
    publishedAt: fetched.publishedAt,
    downloadedAt: fetched.checkedAt,
    contentSha256: fetched.contentSha256,
    recordCount: 1n,
    parserVersion: fetched.parserVersion,
    schemaVersion: fetched.schemaVersion,
    status,
    freshUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

describe('RoleEligibilityRegistrySyncService retry contract', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function service(fetchGeneration: jest.Mock) {
    const registry = {
      auditSourceEvent: jest.fn().mockResolvedValue(undefined),
      stage: jest.fn().mockResolvedValue(generation('STAGING')),
      validateAndActivate: jest.fn().mockResolvedValue(generation('ACTIVE')),
      reject: jest.fn().mockResolvedValue(undefined),
    };
    const health = {
      assertFetchAllowed: jest.fn().mockResolvedValue(undefined),
      success: jest.fn().mockResolvedValue(undefined),
      failure: jest.fn().mockResolvedValue(undefined),
    };
    const cbr = { source: 'CBR', fetchGeneration };
    const unavailable = (source: 'FNS' | 'FGIS_GRAIN' | 'ROSACCREDITATION') => ({
      source,
      fetchGeneration: jest.fn().mockRejectedValue(new EligibilitySourceError(source, `${source}_NOT_PROVEN`, 'UNAVAILABLE')),
    });
    return {
      instance: new RoleEligibilityRegistrySyncService(
        cbr as never,
        unavailable('FGIS_GRAIN') as never,
        unavailable('FNS') as never,
        unavailable('ROSACCREDITATION') as never,
        registry as never,
        health as never,
      ),
      registry,
      health,
    };
  }

  it('retries transient source failures with a bounded attempt count and can recover', async () => {
    const fetchGeneration = jest.fn()
      .mockRejectedValueOnce(new EligibilitySourceError('CBR', 'CBR_TIMEOUT', 'UNAVAILABLE'))
      .mockRejectedValueOnce(new EligibilitySourceError('CBR', 'CBR_HTTP_503', 'UNAVAILABLE'))
      .mockResolvedValueOnce(payload());
    const { instance, health } = service(fetchGeneration);

    const pending = instance.sync('CBR');
    await jest.runAllTimersAsync();
    const result = await pending;

    expect(fetchGeneration).toHaveBeenCalledTimes(3);
    expect(result.fetchAttempts).toBe(3);
    expect(health.success).toHaveBeenCalledTimes(1);
    expect(health.failure).not.toHaveBeenCalled();
  });

  it('does not retry schema drift', async () => {
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('CBR', 'CBR_EXPECTED_SCHEMA_HEADERS_CHANGED', 'SCHEMA_CHANGED'),
    );
    const { instance, health } = service(fetchGeneration);

    await expect(instance.sync('CBR')).rejects.toMatchObject({ code: 'CBR_EXPECTED_SCHEMA_HEADERS_CHANGED' });
    expect(fetchGeneration).toHaveBeenCalledTimes(1);
    expect(health.failure).toHaveBeenCalledWith('CBR', 'SCHEMA_CHANGED', 'CBR_EXPECTED_SCHEMA_HEADERS_CHANGED');
  });

  it('does not retry an unproven machine contract', async () => {
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('CBR', 'CBR_MACHINE_CONTRACT_NOT_PROVEN', 'UNAVAILABLE'),
    );
    const { instance } = service(fetchGeneration);

    await expect(instance.sync('CBR')).rejects.toMatchObject({ code: 'CBR_MACHINE_CONTRACT_NOT_PROVEN' });
    expect(fetchGeneration).toHaveBeenCalledTimes(1);
  });

  it('stops after three transient failures and reports deterministic source failure', async () => {
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('CBR', 'CBR_TIMEOUT', 'UNAVAILABLE'),
    );
    const { instance, health } = service(fetchGeneration);

    const pending = instance.sync('CBR');
    await jest.runAllTimersAsync();
    await expect(pending).rejects.toMatchObject({ code: 'CBR_TIMEOUT' });
    expect(fetchGeneration).toHaveBeenCalledTimes(3);
    expect(health.failure).toHaveBeenCalledTimes(1);
  });
});
