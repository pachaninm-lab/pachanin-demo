import { RoleEligibilityRegistrySyncService } from './role-eligibility-registry-sync.service';
import {
  EligibilitySourceError,
  type RegistryAdapterFetchResult,
  type RegistryGeneration,
  type SourceHealthSnapshot,
} from './role-eligibility.types';

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

function fnsGeneration(overrides: Partial<RegistryGeneration> = {}): RegistryGeneration {
  return {
    id: 'fns-egrul-generation-1',
    source: 'FNS',
    generation: '2026-09-05T00:00:00.000Z:bbbbbbbbbbbbbbbb',
    publishedAt: new Date(Date.now() - 60 * 60 * 1000),
    downloadedAt: new Date(Date.now() - 30 * 60 * 1000),
    contentSha256: 'b'.repeat(64),
    recordCount: 2n,
    parserVersion: 'fns-egrul-v1',
    schemaVersion: 'EGRUL_408',
    status: 'ACTIVE',
    freshUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

function fnsHealth(active: RegistryGeneration, overrides: Partial<SourceHealthSnapshot> = {}): SourceHealthSnapshot {
  return {
    source: 'FNS',
    status: 'HEALTHY',
    circuitState: 'CLOSED',
    activeGeneration: active.generation,
    parserVersion: active.parserVersion,
    schemaVersion: active.schemaVersion,
    lastSuccessAt: new Date(Date.now() - 30 * 60 * 1000),
    lastFailureAt: null,
    checkedAt: new Date(Date.now() - 30 * 60 * 1000),
    freshUntil: active.freshUntil,
    consecutiveFailures: 0,
    lastErrorCode: null,
    ...overrides,
  };
}

function unavailable(source: 'CBR' | 'FNS' | 'FGIS_GRAIN' | 'ROSACCREDITATION') {
  return {
    source,
    fetchGeneration: jest.fn().mockRejectedValue(
      new EligibilitySourceError(source, `${source}_NOT_PROVEN`, 'UNAVAILABLE'),
    ),
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
      active: jest.fn().mockResolvedValue(null),
    };
    const health = {
      assertFetchAllowed: jest.fn().mockResolvedValue(undefined),
      success: jest.fn().mockResolvedValue(undefined),
      failure: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
    };
    const cbr = { source: 'CBR', fetchGeneration };
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

  function fnsService(
    fetchGeneration: jest.Mock,
    active: RegistryGeneration | null,
    sourceHealth: SourceHealthSnapshot | null,
  ) {
    const registry = {
      auditSourceEvent: jest.fn().mockResolvedValue(undefined),
      stage: jest.fn(),
      validateAndActivate: jest.fn(),
      reject: jest.fn().mockResolvedValue(undefined),
      active: jest.fn().mockResolvedValue(active),
    };
    const health = {
      assertFetchAllowed: jest.fn().mockResolvedValue(undefined),
      success: jest.fn().mockResolvedValue(undefined),
      failure: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(sourceHealth),
    };
    const fns = { source: 'FNS', fetchGeneration };
    return {
      instance: new RoleEligibilityRegistrySyncService(
        unavailable('CBR') as never,
        unavailable('FGIS_GRAIN') as never,
        fns as never,
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
    const rejection = expect(pending).rejects.toMatchObject({ code: 'CBR_TIMEOUT' });
    await jest.runAllTimersAsync();
    await rejection;
    expect(fetchGeneration).toHaveBeenCalledTimes(3);
    expect(health.failure).toHaveBeenCalledTimes(1);
  });

  it('preserves a fresh exact file-backed EGRUL authority when only the FNS machine contract is unproven', async () => {
    const active = fnsGeneration();
    const snapshot = fnsHealth(active);
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('FNS', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN', 'UNAVAILABLE'),
    );
    const { instance, registry, health } = fnsService(fetchGeneration, active, snapshot);

    await expect(instance.sync('FNS')).rejects.toMatchObject({ code: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN' });

    expect(fetchGeneration).toHaveBeenCalledTimes(1);
    expect(registry.active).toHaveBeenCalledWith('FNS');
    expect(health.get).toHaveBeenCalledWith('FNS');
    expect(health.success).not.toHaveBeenCalled();
    expect(health.failure).not.toHaveBeenCalled();
    expect(registry.auditSourceEvent).toHaveBeenLastCalledWith(
      'ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED',
      'FNS',
      expect.stringContaining('registry-sync:FNS:'),
      expect.objectContaining({
        errorCode: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN',
        healthPreserved: true,
        preservedGeneration: active.generation,
        preservedContentSha256: active.contentSha256,
        preservedParserVersion: 'fns-egrul-v1',
        preservedSchemaVersion: 'EGRUL_408',
        preservedFreshUntil: active.freshUntil.toISOString(),
      }),
    );
  });

  it('does not preserve an untyped error that merely copies the FNS contract code', async () => {
    const active = fnsGeneration();
    const snapshot = fnsHealth(active);
    const fetchGeneration = jest.fn().mockRejectedValue(
      new Error('FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN'),
    );
    const { instance, registry, health } = fnsService(fetchGeneration, active, snapshot);

    await expect(instance.sync('FNS')).rejects.toMatchObject({ code: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN' });
    expect(registry.active).not.toHaveBeenCalled();
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN');
    expect(health.success).not.toHaveBeenCalled();
  });

  it('does not preserve an exact code carried by a typed error from another source', async () => {
    const active = fnsGeneration();
    const snapshot = fnsHealth(active);
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('CBR', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN', 'UNAVAILABLE'),
    );
    const { instance, registry, health } = fnsService(fetchGeneration, active, snapshot);

    await expect(instance.sync('FNS')).rejects.toMatchObject({ code: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN' });
    expect(registry.active).not.toHaveBeenCalled();
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN');
    expect(health.success).not.toHaveBeenCalled();
  });

  it('does not preserve the exact FNS contract code when its health classification is contradictory', async () => {
    const active = fnsGeneration();
    const snapshot = fnsHealth(active);
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('FNS', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN', 'SCHEMA_CHANGED'),
    );
    const { instance, registry, health } = fnsService(fetchGeneration, active, snapshot);

    await expect(instance.sync('FNS')).rejects.toMatchObject({
      code: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN',
      health: 'SCHEMA_CHANGED',
    });
    expect(registry.active).not.toHaveBeenCalled();
    expect(health.failure).toHaveBeenCalledWith(
      'FNS',
      'SCHEMA_CHANGED',
      'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN',
    );
    expect(health.success).not.toHaveBeenCalled();
  });

  it('degrades FNS instead of preserving HEALTHY when the preservation audit cannot be persisted', async () => {
    const active = fnsGeneration();
    const snapshot = fnsHealth(active);
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('FNS', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN', 'UNAVAILABLE'),
    );
    const { instance, registry, health } = fnsService(fetchGeneration, active, snapshot);
    registry.auditSourceEvent
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('audit-write-failed'));

    await expect(instance.sync('FNS')).rejects.toMatchObject({
      code: 'FNS_EGRUL_PRESERVATION_AUDIT_FAILED',
      health: 'UNAVAILABLE',
    });
    expect(health.failure).toHaveBeenCalledWith(
      'FNS',
      'UNAVAILABLE',
      'FNS_EGRUL_PRESERVATION_AUDIT_FAILED',
    );
    expect(health.success).not.toHaveBeenCalled();
  });

  it('fails closed when the file-backed EGRUL generation is stale', async () => {
    const active = fnsGeneration({ freshUntil: new Date(Date.now() - 1) });
    const snapshot = fnsHealth(active);
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('FNS', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN', 'UNAVAILABLE'),
    );
    const { instance, health } = fnsService(fetchGeneration, active, snapshot);

    await expect(instance.sync('FNS')).rejects.toMatchObject({ code: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN' });
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN');
  });

  it('fails closed when no active FNS generation exists', async () => {
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('FNS', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN', 'UNAVAILABLE'),
    );
    const { instance, health } = fnsService(fetchGeneration, null, null);

    await expect(instance.sync('FNS')).rejects.toMatchObject({ code: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN' });
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN');
  });

  it('fails closed when active generation and source-health provenance do not match', async () => {
    const active = fnsGeneration();
    const snapshot = fnsHealth(active, { activeGeneration: 'different-generation' });
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('FNS', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN', 'UNAVAILABLE'),
    );
    const { instance, health } = fnsService(fetchGeneration, active, snapshot);

    await expect(instance.sync('FNS')).rejects.toMatchObject({ code: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN' });
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN');
  });

  it('never preserves a generic non-EGRUL FNS generation', async () => {
    const active = fnsGeneration({ schemaVersion: 'FNS_GENERIC_V1' });
    const snapshot = fnsHealth(active);
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('FNS', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN', 'UNAVAILABLE'),
    );
    const { instance, health } = fnsService(fetchGeneration, active, snapshot);

    await expect(instance.sync('FNS')).rejects.toMatchObject({ code: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN' });
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN');
  });

  it('never preserves an EGRUL-labelled generation from an untrusted parser', async () => {
    const active = fnsGeneration({ parserVersion: 'unknown-parser-v99' });
    const snapshot = fnsHealth(active);
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('FNS', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN', 'UNAVAILABLE'),
    );
    const { instance, health } = fnsService(fetchGeneration, active, snapshot);

    await expect(instance.sync('FNS')).rejects.toMatchObject({ code: 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN' });
    expect(health.failure).toHaveBeenCalledWith('FNS', 'UNAVAILABLE', 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN');
    expect(health.success).not.toHaveBeenCalled();
  });

  it('does not preserve unrelated FNS failures even with a fresh coherent EGRUL authority', async () => {
    const active = fnsGeneration();
    const snapshot = fnsHealth(active);
    const fetchGeneration = jest.fn().mockRejectedValue(
      new EligibilitySourceError('FNS', 'FNS_EXPECTED_SCHEMA_HEADERS_CHANGED', 'SCHEMA_CHANGED'),
    );
    const { instance, health } = fnsService(fetchGeneration, active, snapshot);

    await expect(instance.sync('FNS')).rejects.toMatchObject({ code: 'FNS_EXPECTED_SCHEMA_HEADERS_CHANGED' });
    expect(health.failure).toHaveBeenCalledWith('FNS', 'SCHEMA_CHANGED', 'FNS_EXPECTED_SCHEMA_HEADERS_CHANGED');
  });
});
