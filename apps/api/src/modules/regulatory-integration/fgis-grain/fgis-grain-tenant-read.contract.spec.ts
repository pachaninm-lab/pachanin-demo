import { FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS } from './fgis-grain-1.0.23.operations.generated';
import {
  FGIS_GRAIN_READ_OPERATION_CODES,
  FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
  FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
  FgisGrainTenantReadContractError,
  assertFgisGrainReadOperation,
  assertFgisGrainTenantReadAttestationInput,
  assertFgisGrainTenantReadAuthorizationInput,
  assertFgisGrainTenantReadRequestInput,
} from './fgis-grain-tenant-read.contract';

const NOW = new Date('2026-07-30T10:00:00.000Z');
const future = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

describe('FGIS Grain tenant-authorized read contract', () => {
  it('derives exactly the accepted 19 READ operations from API 1.0.23', () => {
    const expected = FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS
      .filter((row) => row[3] === 'READ')
      .map((row) => row[0]);
    expect(FGIS_GRAIN_READ_OPERATION_CODES).toEqual(expected);
    expect(FGIS_GRAIN_READ_OPERATION_CODES).toHaveLength(19);
    for (const code of expected) expect(assertFgisGrainReadOperation(code)).toBe(code);
  });

  it('rejects every mutation operation before transport', () => {
    const writes = FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS
      .filter((row) => row[3] !== 'READ')
      .map((row) => row[0]);
    expect(writes.length).toBeGreaterThan(0);
    for (const code of writes) {
      expect(() => assertFgisGrainReadOperation(code)).toThrow(
        expect.objectContaining({ code: 'MUTATION_OPERATION_FORBIDDEN' }),
      );
    }
  });

  it('accepts a strict bounded authorization and sorts the allow-list', () => {
    const value = assertFgisGrainTenantReadAuthorizationInput({
      schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
      configurationId: 'config-fgis-001',
      configurationVersion: '3',
      allowedOperations: ['GET_LIST_SDIZ', 'DICTIONARIES'],
      authorizationReference: 'authorization://tenant/org/read-001',
      validUntil: future(60),
      reason: 'Tenant owner approved the exact read-only operation set.',
    }, NOW);
    expect(value.allowedOperations).toEqual(['DICTIONARIES', 'GET_LIST_SDIZ']);
    expect(Object.isFrozen(value)).toBe(true);
  });

  it('rejects client-controlled extra fields and secret-like references', () => {
    expect(() => assertFgisGrainTenantReadAuthorizationInput({
      schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
      configurationId: 'config-fgis-001',
      configurationVersion: '3',
      allowedOperations: ['DICTIONARIES'],
      authorizationReference: 'vault://user:password@host/key',
      validUntil: future(60),
      reason: 'Tenant owner approved the exact read-only operation set.',
      tenantId: 'client-selected',
    }, NOW)).toThrow(FgisGrainTenantReadContractError);
  });

  it('requires bounded external evidence for attestation', () => {
    expect(assertFgisGrainTenantReadAttestationInput({
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: 'authorization-001',
      authorizationVersion: '0',
      evidenceReference: 'evidence://fgis-grain/read-e2e-001',
      validUntil: future(60),
      justification: 'Independent external read evidence passed without writes.',
    }, NOW)).toMatchObject({ authorizationId: 'authorization-001' });

    expect(() => assertFgisGrainTenantReadAttestationInput({
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: 'authorization-001',
      authorizationVersion: '0',
      evidenceReference: 'evidence://fgis-grain/read-e2e-001',
      validUntil: future(60 * 24 * 31),
      justification: 'Independent external read evidence passed without writes.',
    }, NOW)).toThrow(expect.objectContaining({ code: 'ATTESTATION_TTL_INVALID' }));
  });

  it('accepts only fingerprinted referenced read requests', () => {
    const value = assertFgisGrainTenantReadRequestInput({
      schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
      authorizationId: 'authorization-001',
      authorizationVersion: '1',
      operationCode: 'GET_LIST_SDIZ',
      requestReference: 'object-store://fgis-grain/requests/request-001.xml',
      requestSha256: 'a'.repeat(64),
      correlationId: 'corr-fgis-read-001',
      idempotencyKey: 'idem-fgis-read-001',
    });
    expect(value.operationCode).toBe('GET_LIST_SDIZ');

    expect(() => assertFgisGrainTenantReadRequestInput({
      ...value,
      operationCode: 'CREATE_SDIZ',
    })).toThrow(expect.objectContaining({ code: 'MUTATION_OPERATION_FORBIDDEN' }));
  });
});
