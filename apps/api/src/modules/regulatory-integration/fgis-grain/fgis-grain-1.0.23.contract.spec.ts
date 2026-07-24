import {
  FGIS_GRAIN_1_0_23_CATALOG_SHA256,
  FGIS_GRAIN_1_0_23_PACKAGE_SHA256,
  FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS,
} from './fgis-grain-1.0.23.generated';
import { FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS } from './fgis-grain-1.0.23.operations.generated';
import {
  FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  FgisGrain1023ContractCatalog,
  FgisGrain1023ContractError,
  assertFgisGrain1023AckEnvelope,
  assertFgisGrain1023BusinessEnvelope,
  assertFgisGrain1023FaultQName,
  assertFgisGrain1023RuntimeEndpointCandidate,
} from './fgis-grain-1.0.23.contract';

const MESSAGE_ID = '123e4567-e89b-12d3-a456-426614174000';
const RESPONSE_ID = '123e4567-e89b-12d3-a456-426614174001';

function requestEnvelope() {
  const operation = FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS[0]!;
  return {
    adapterCode: 'FGIS_ZERNO',
    apiVersion: '1.0.23',
    packageSha256: FGIS_GRAIN_1_0_23_PACKAGE_SHA256,
    catalogSha256: FGIS_GRAIN_1_0_23_CATALOG_SHA256,
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    direction: 'REQUEST',
    operationCode: operation.code,
    family: operation.family,
    elementQName: operation.requestQName,
    transportOperation: 'SendRequest',
    messageId: MESSAGE_ID,
    correlationId: 'fgis:correlation:001',
    causationId: null,
    contentSha256: 'a'.repeat(64),
    signatureMetadata: {
      algorithm: 'GOST-2012',
      keyReference: 'vault:fgis:key:1',
      keyVersion: '1',
      signatureVersion: '1',
      verificationPolicyVersion: 'fgis-1.0.23',
    },
  };
}

function expectCode(work: () => unknown, code: string): void {
  try {
    work();
    throw new Error('expected contract error');
  } catch (error) {
    expect(error).toBeInstanceOf(FgisGrain1023ContractError);
    expect((error as FgisGrain1023ContractError).code).toBe(code);
  }
}

describe('FGIS Grain API 1.0.23 contract authority', () => {
  it('exposes only pinned adapter-ready metadata and exact cardinalities', () => {
    const catalog = new FgisGrain1023ContractCatalog();
    expect(catalog.adapterCode).toBe('FGIS_ZERNO');
    expect(catalog.apiVersion).toBe('1.0.23');
    expect(catalog.operationalStatus).toBe('NOT_ATTESTED');
    expect(catalog.honestStatus).toBe('ADAPTER_READY');
    expect(catalog.liveConnection).toBe(false);
    expect(catalog.credentialsPresent).toBe(false);
    expect(catalog.runtimeEndpointAllowed).toBe(false);
    expect(FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS.map((row) => row.name).sort())
      .toEqual(['Ack', 'SendRequest', 'SendResponse']);
    expect(catalog.listOperations()).toHaveLength(57);
    expect(new Set(catalog.listOperations().map((row) => row.code)).size).toBe(57);
    expect(new Set(catalog.listOperations().map((row) => row.family)).size).toBe(8);
  });

  it('accepts exact request and response envelopes', () => {
    const request = assertFgisGrain1023BusinessEnvelope(requestEnvelope());
    expect(request.direction).toBe('REQUEST');
    expect(request.transportOperation).toBe('SendRequest');
    const operation = FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS[0]!;
    const response = assertFgisGrain1023BusinessEnvelope({
      ...requestEnvelope(),
      direction: 'RESPONSE',
      elementQName: operation.responseQName,
      transportOperation: 'SendResponse',
      messageId: RESPONSE_ID,
      causationId: 'fgis:request:001',
      signatureMetadata: null,
    });
    expect(response.direction).toBe('RESPONSE');
    expect(response.transportOperation).toBe('SendResponse');
  });

  it('rejects operation, family, QName and transport substitution', () => {
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({ ...requestEnvelope(), operationCode: 'UNKNOWN' }),
      'OPERATION_UNKNOWN',
    );
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({ ...requestEnvelope(), family: 'SDIZ' }),
      'FAMILY_MISMATCH',
    );
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({ ...requestEnvelope(), elementQName: '{urn:wrong}Request' }),
      'QNAME_MISMATCH',
    );
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({ ...requestEnvelope(), transportOperation: 'Ack' }),
      'TRANSPORT_OPERATION_MISMATCH',
    );
  });

  it('rejects package, catalog, mapping and content hash drift', () => {
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({ ...requestEnvelope(), packageSha256: '0'.repeat(64) }),
      'PACKAGE_HASH_MISMATCH',
    );
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({ ...requestEnvelope(), catalogSha256: '0'.repeat(64) }),
      'CATALOG_HASH_MISMATCH',
    );
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({ ...requestEnvelope(), mappingVersion: 'mutable-latest' }),
      'MAPPING_VERSION_MISMATCH',
    );
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({ ...requestEnvelope(), contentSha256: 'ABC' }),
      'CONTENT_HASH_INVALID',
    );
  });

  it('rejects client authority and secret/signature payload fields', () => {
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({ ...requestEnvelope(), tenantId: 'attacker' }),
      'CLIENT_AUTHORITY_FIELD_FORBIDDEN',
    );
    expectCode(
      () => assertFgisGrain1023BusinessEnvelope({
        ...requestEnvelope(),
        signatureMetadata: {
          ...requestEnvelope().signatureMetadata,
          signatureBytes: 'secret',
        },
      }),
      'INPUT_INVALID',
    );
  });

  it('validates Ack separately from business acceptance', () => {
    const ack = assertFgisGrain1023AckEnvelope({
      adapterCode: 'FGIS_ZERNO',
      apiVersion: '1.0.23',
      catalogSha256: FGIS_GRAIN_1_0_23_CATALOG_SHA256,
      transportOperation: 'Ack',
      messageId: MESSAGE_ID,
      correlationId: 'fgis:correlation:ack',
      responseMessageId: RESPONSE_ID,
    });
    expect(ack.transportOperation).toBe('Ack');
    expectCode(
      () => assertFgisGrain1023AckEnvelope({ ...ack, transportOperation: 'SendResponse' }),
      'TRANSPORT_OPERATION_MISMATCH',
    );
  });

  it('accepts only generated fault QNames', () => {
    const qname = FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS[0]!.faultQName;
    expect(assertFgisGrain1023FaultQName(qname)).toBe(qname);
    expectCode(
      () => assertFgisGrain1023FaultQName('{urn:wrong}Fault'),
      'FAULT_QNAME_UNKNOWN',
    );
  });

  it('forbids the localhost placeholder and every runtime endpoint in this slice', () => {
    expectCode(
      () => assertFgisGrain1023RuntimeEndpointCandidate('http://localhost/api/ws/1.0.23'),
      'PLACEHOLDER_ENDPOINT_FORBIDDEN',
    );
    expectCode(
      () => assertFgisGrain1023RuntimeEndpointCandidate('https://example.invalid/api/ws/1.0.23'),
      'RUNTIME_ENDPOINT_OUT_OF_SCOPE',
    );
  });
});
