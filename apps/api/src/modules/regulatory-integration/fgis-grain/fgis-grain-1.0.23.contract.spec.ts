import {
  FGIS_GRAIN_ADAPTER_CODE,
  FGIS_GRAIN_ADAPTER_IDENTITY,
  FGIS_GRAIN_CATALOG_STATUS,
  FGIS_GRAIN_OPERATIONAL_STATUS,
  FGIS_GRAIN_BUSINESS_OPERATIONS,
  getFgisGrainBusinessOperation,
  toFgisGrainOutboundEnvelopeMetadata,
  toRegulatoryInboundEnvelope,
  validateFgisGrainContractEnvelope,
  validateFgisGrainRuntimeEndpoint,
  type FgisGrainContractEnvelopeMetadata,
} from './fgis-grain-1.0.23.contract';
import {
  FGIS_GRAIN_1_0_23_BUSINESS_FAMILIES,
  FGIS_GRAIN_1_0_23_DOCUMENTATION_ENDPOINT,
  FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  FGIS_GRAIN_1_0_23_PACKAGE_SHA256,
  FGIS_GRAIN_1_0_23_SDIZ_IDENTIFIER_FIELDS,
  FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS,
} from './fgis-grain-1.0.23.generated';
import { FgisGrainContractCatalogService } from './fgis-grain-contract-catalog.service';

function envelope(
  overrides: Partial<FgisGrainContractEnvelopeMetadata> = {},
): FgisGrainContractEnvelopeMetadata {
  const operation = getFgisGrainBusinessOperation('GET_LIST_SDIZ');
  if (!operation) throw new Error('fixture operation missing');
  return {
    adapterCode: FGIS_GRAIN_ADAPTER_CODE,
    apiVersion: '1.0.23',
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    direction: 'INBOUND_RESPONSE',
    transportOperation: 'SendResponse',
    businessOperationCode: 'GET_LIST_SDIZ',
    payloadQName: operation.responseQName,
    messageId: 'f47ac10b-58cc-11cf-a447-001122334455',
    referenceMessageId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
    occurredAt: '2026-07-24T10:00:00.000Z',
    rawBodySha256: 'a'.repeat(64),
    signature: {
      algorithm: 'GOST-2012-256',
      keyReference: 'certificate-registry:fgis-zerno:test:1',
      keyVersion: '1',
      signatureVersion: 'XMLDSig-1',
      verificationPolicyVersion: 'fgis-zerno-1.0.23-signature.v1',
    },
    responseCode: 'success',
    ...overrides,
  };
}

describe('FGIS Grain API 1.0.23 generated contract authority', () => {
  it('pins the accepted package and complete operation graph', () => {
    expect(FGIS_GRAIN_1_0_23_PACKAGE_SHA256).toBe(
      '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7',
    );
    expect(FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS.map((row) => row.name))
      .toEqual(['Ack', 'SendRequest', 'SendResponse']);
    expect(FGIS_GRAIN_BUSINESS_OPERATIONS).toHaveLength(57);
    expect(new Set(FGIS_GRAIN_BUSINESS_OPERATIONS.map((row) => row.code)).size)
      .toBe(57);
    expect(FGIS_GRAIN_1_0_23_BUSINESS_FAMILIES).toContain('SDIZ');
  });

  it('preserves exact SDIZ request/response QNames and identifiers', () => {
    const create = getFgisGrainBusinessOperation('CREATE_SDIZ');
    expect(create).toEqual(expect.objectContaining({
      family: 'SDIZ',
      classification: 'MUTATION',
      requestQName: '{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/sdiz/1.0.23}RequestCreateSDIZ',
      responseQName: '{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/sdiz/1.0.23}ResponseCreateSDIZ',
    }));
    expect(FGIS_GRAIN_1_0_23_SDIZ_IDENTIFIER_FIELDS).toEqual(expect.arrayContaining([
      'MessageID',
      'ReferenceMessageID',
      'lotNumber',
      'sdizID',
      'sdizNumber',
      'SDIZNumber',
      'extinctionId',
      'extinctionRefusalId',
    ]));
  });

  it('maps a validated provider response into the canonical durable inbox envelope', () => {
    const candidate = envelope();
    expect(validateFgisGrainContractEnvelope(candidate)).toEqual({
      valid: true,
      operation: getFgisGrainBusinessOperation('GET_LIST_SDIZ'),
    });
    expect(toRegulatoryInboundEnvelope(candidate)).toEqual({
      provider: 'FGIS_ZERNO',
      externalEventId: candidate.messageId,
      schemaVersion: '1.0.23',
      mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
      occurredAt: candidate.occurredAt,
      rawBodySha256: candidate.rawBodySha256,
      signature: candidate.signature,
      correlationId: candidate.referenceMessageId,
      causationId: candidate.referenceMessageId,
    });
  });

  const invalidCases: ReadonlyArray<readonly [
    Partial<FgisGrainContractEnvelopeMetadata>,
    string,
  ]> = [
    [{ apiVersion: '1.0.22' as never }, 'IDENTITY_MISMATCH'],
    [{ businessOperationCode: 'UNKNOWN' as never }, 'UNSUPPORTED_OPERATION'],
    [{ transportOperation: 'Ack' }, 'TRANSPORT_OPERATION_MISMATCH'],
    [{ payloadQName: '{urn:wrong}ResponseGetListSDIZ' }, 'PAYLOAD_QNAME_MISMATCH'],
    [{ messageId: 'f47ac10b-58cc-41cf-a447-001122334455' }, 'MESSAGE_ID_INVALID'],
    [{ referenceMessageId: 'invalid' }, 'REFERENCE_MESSAGE_ID_INVALID'],
    [{ occurredAt: '2026-07-24T10:00:00' }, 'OCCURRED_AT_INVALID'],
    [{ rawBodySha256: 'abc' }, 'CONTENT_HASH_INVALID'],
    [{ signature: null }, 'SIGNATURE_REFERENCE_REQUIRED'],
    [{ responseCode: undefined }, 'RESPONSE_CODE_REQUIRED'],
    [{ responseCode: 'unknown' as never }, 'RESPONSE_CODE_UNSUPPORTED'],
  ];

  it.each(invalidCases)('fails closed for %o', (overrides, errorCode) => {
    expect(validateFgisGrainContractEnvelope(envelope(overrides)))
      .toEqual({ valid: false, errorCode });
  });

  it('prepares outbound metadata without serializing XML or calling the provider', () => {
    const operation = getFgisGrainBusinessOperation('CREATE_SDIZ');
    if (!operation) throw new Error('fixture operation missing');
    const outbound = envelope({
      direction: 'OUTBOUND_REQUEST',
      transportOperation: 'SendRequest',
      businessOperationCode: 'CREATE_SDIZ',
      payloadQName: operation.requestQName,
      responseCode: undefined,
    });
    expect(validateFgisGrainContractEnvelope(outbound).valid).toBe(true);
    expect(toFgisGrainOutboundEnvelopeMetadata(outbound)).toEqual({
      adapterIdentity: FGIS_GRAIN_ADAPTER_IDENTITY,
      schemaVersion: '1.0.23',
      mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
      transportOperation: 'SendRequest',
      businessOperationCode: 'CREATE_SDIZ',
      payloadQName: operation.requestQName,
      messageId: outbound.messageId,
      correlationId: outbound.referenceMessageId,
      rawBodySha256: outbound.rawBodySha256,
      signature: outbound.signature,
    });
    expect(validateFgisGrainContractEnvelope({ ...outbound, responseCode: 'accepted' }))
      .toEqual({ valid: false, errorCode: 'RESPONSE_CODE_FORBIDDEN' });
  });

  it('accepts only the official fault QName as inbound fault metadata', () => {
    const faultQName = FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS
      .find((row) => row.name === 'SendRequest')?.faultQName;
    if (!faultQName) throw new Error('fault QName missing');
    const fault = envelope({
      direction: 'INBOUND_FAULT',
      transportOperation: 'SendRequest',
      payloadQName: faultQName,
      responseCode: undefined,
    });
    expect(validateFgisGrainContractEnvelope(fault).valid).toBe(true);
    expect(validateFgisGrainContractEnvelope({ ...fault, payloadQName: '{urn:wrong}ZernoFault' }))
      .toEqual({ valid: false, errorCode: 'FAULT_QNAME_MISMATCH' });
  });

  it('never promotes the documented localhost address into runtime configuration', () => {
    expect(FGIS_GRAIN_1_0_23_DOCUMENTATION_ENDPOINT).toEqual({
      url: 'http://localhost/api/ws/1.0.23',
      placeholder: true,
      runtimeAllowed: false,
    });
    expect(validateFgisGrainRuntimeEndpoint(FGIS_GRAIN_1_0_23_DOCUMENTATION_ENDPOINT.url))
      .toEqual({ valid: false, errorCode: 'ENDPOINT_HTTPS_REQUIRED' });
    expect(validateFgisGrainRuntimeEndpoint('https://localhost/api/ws/1.0.23'))
      .toEqual({ valid: false, errorCode: 'ENDPOINT_PLACEHOLDER_FORBIDDEN' });
    expect(validateFgisGrainRuntimeEndpoint('https://user:secret@example.test/api'))
      .toEqual({ valid: false, errorCode: 'ENDPOINT_CREDENTIALS_FORBIDDEN' });
    expect(validateFgisGrainRuntimeEndpoint('https://integration.example.test/api/ws/1.0.23'))
      .toEqual({ valid: true, normalizedUrl: 'https://integration.example.test/api/ws/1.0.23' });
  });

  it('exposes read-only adapter metadata through the module service', () => {
    const service = new FgisGrainContractCatalogService();
    expect(service.identity).toEqual(FGIS_GRAIN_ADAPTER_IDENTITY);
    expect(service.operationCount).toBe(57);
    expect(service.catalogStatus).toBe(FGIS_GRAIN_CATALOG_STATUS);
    expect(service.operationalStatus).toBe(FGIS_GRAIN_OPERATIONAL_STATUS);
    expect(service.operationalStatus).not.toBe('CONFIRMED_LIVE');
  });
});
