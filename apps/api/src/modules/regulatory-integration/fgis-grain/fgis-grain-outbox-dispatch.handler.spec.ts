import { getFgisGrainBusinessOperation } from './fgis-grain-1.0.23.contract';
import {
  FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
  FGIS_GRAIN_OUTBOX_EVENT_TYPE,
  FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
  FGIS_GRAIN_SIGNING_POLICY_VERSION,
  FgisGrainCanonicalizationPort,
  FgisGrainDispatchError,
  FgisGrainImmutablePayloadStorePort,
  FgisGrainProviderConfigurationPort,
  FgisGrainSignedEnvelopeAssemblerPort,
  FgisGrainSigningProviderPort,
  FgisGrainSoapTransportPort,
} from './fgis-grain-1.0.23.dispatch.contract';
import { FGIS_GRAIN_1_0_23_SIGNING_POLICY } from './fgis-grain-1.0.23.signing-policy.generated';
import { buildGovernedUnsignedFgisGrainSoapEnvelope } from './fgis-grain-1.0.23.xml-policy';
import { FgisGrainOutboxDispatchHandler } from './fgis-grain-outbox-dispatch.handler';
import type {
  ClaimedOutboxEntry,
  DurableOutboxWorker,
} from '../../integration-events/durable-outbox.worker';

const MESSAGE_ID = 'f47ac10b-58cc-11cf-a447-001122334455';
const REFERENCE_MESSAGE_ID = 'd9428888-122b-11e1-b85c-61cd3cbb3210';
const UNSIGNED_REFERENCE = 'object-store://fgis/test/unsigned-1.xml';

function createBusinessPayload(): string {
  const operation = getFgisGrainBusinessOperation('CREATE_SDIZ');
  if (!operation) throw new Error('CREATE_SDIZ operation missing');
  const closing = operation.requestQName.indexOf('}');
  const namespace = operation.requestQName.slice(1, closing);
  const localName = operation.requestQName.slice(closing + 1);
  return `<biz:${localName} xmlns:biz="${namespace}"><biz:payload/></biz:${localName}>`;
}

function createAuthority() {
  const unsigned = buildGovernedUnsignedFgisGrainSoapEnvelope({
    transportOperation: 'SendRequest',
    businessOperationCode: 'CREATE_SDIZ',
    businessPayloadXml: createBusinessPayload(),
    messageId: MESSAGE_ID,
    referenceMessageId: REFERENCE_MESSAGE_ID,
    messageDataId: 'message-data-dispatch-1',
    testMessage: true,
  });
  const payload = {
    schemaVersion: FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
    adapterCode: 'FGIS_ZERNO',
    apiVersion: '1.0.23',
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
    signingPolicyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
    tenantId: 'tenant-1',
    organizationId: 'organization-1',
    commandId: 'command-1',
    transportOperation: 'SendRequest',
    businessOperationCode: 'CREATE_SDIZ',
    messageId: MESSAGE_ID,
    referenceMessageId: REFERENCE_MESSAGE_ID,
    messageDataId: 'message-data-dispatch-1',
    unsignedEnvelopeReference: UNSIGNED_REFERENCE,
    unsignedEnvelopeSha256: unsigned.unsignedEnvelopeSha256,
    unsignedEnvelopeSizeBytes: unsigned.unsignedEnvelopeBytes.byteLength,
    messageDataSha256: unsigned.messageDataSha256,
    providerConfigurationReference: 'config://fgis/test/provider-1',
    correlationId: 'correlation-1',
    causationId: null,
  } as const;
  const entry: ClaimedOutboxEntry = {
    id: 'outbox-1',
    type: FGIS_GRAIN_OUTBOX_EVENT_TYPE,
    dealId: null,
    payload,
    retryCount: 0,
    maxRetries: 5,
    correlationId: payload.correlationId,
    idempotencyKey: 'fgis-dispatch-idempotency-1',
    leaseToken: 'lease-token-1',
  };
  return { unsigned, payload, entry };
}

function createHarness(overrides: {
  storedBytes?: Uint8Array;
  transportResult?: {
    delivered: boolean;
    responseCode: 'success' | 'accepted' | 'queue-is-empty' | 'ignored' | null;
    providerMessageId: string | null;
    responseBodySha256: string | null;
    httpStatus: number | null;
    durationMs: number;
    faultCode: string | null;
    retryable: boolean;
  };
} = {}) {
  const authority = createAuthority();
  const handlers = new Map<string, (entry: ClaimedOutboxEntry) => Promise<void>>();
  const worker = {
    registerHandler: jest.fn((type: string, handler: (entry: ClaimedOutboxEntry) => Promise<void>) => {
      handlers.set(type, handler);
    }),
  } as unknown as DurableOutboxWorker;
  const configurationPort = {
    resolve: jest.fn(async () => ({
      schemaVersion: FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
      adapterCode: 'FGIS_ZERNO',
      apiVersion: '1.0.23',
      mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
      signingPolicyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
      environment: 'SANDBOX',
      activationState: 'TEST_APPROVED',
      endpointReference: 'config://fgis/test/endpoint',
      tlsPolicyReference: 'tls://fgis/test/tls-policy',
      credentialReference: 'credential://fgis/test/credential-1',
      signingKeyReference: 'signing-key://fgis/test/key-1',
      payloadStoreReference: 'object-store://fgis/test',
      productionAttestationReference: null,
    })),
  } as unknown as FgisGrainProviderConfigurationPort;
  const bytes = overrides.storedBytes ?? authority.unsigned.unsignedEnvelopeBytes;
  const payloadStorePort = {
    load: jest.fn(async () => ({
      objectReference: UNSIGNED_REFERENCE,
      bytes,
      sha256: authority.payload.unsignedEnvelopeSha256,
      sizeBytes: authority.payload.unsignedEnvelopeSizeBytes,
      mediaType: 'application/xml' as const,
      immutable: true as const,
      encryptedAtRest: true as const,
    })),
  } as unknown as FgisGrainImmutablePayloadStorePort;
  const canonicalizationPort = {
    canonicalize: jest.fn(async () => ({
      canonicalizedObjectReference: 'object-store://fgis/test/canonical-1.xml',
      canonicalizedSha256: 'c'.repeat(64),
      canonicalizedSizeBytes: 512,
      canonicalizationAlgorithm:
        FGIS_GRAIN_1_0_23_SIGNING_POLICY.algorithms.canonicalizationAlgorithmUri,
      transformAlgorithm:
        FGIS_GRAIN_1_0_23_SIGNING_POLICY.algorithms.transformAlgorithmUri,
      policyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
    })),
  } as unknown as FgisGrainCanonicalizationPort;
  const signingProviderPort = {
    sign: jest.fn(async () => ({
      signatureObjectReference: 'object-store://fgis/test/signature-1.p7s',
      signatureSha256: 'd'.repeat(64),
      signatureSizeBytes: 1024,
      signatureAlgorithm:
        FGIS_GRAIN_1_0_23_SIGNING_POLICY.algorithms.signatureAlgorithmUri,
      digestAlgorithm:
        FGIS_GRAIN_1_0_23_SIGNING_POLICY.algorithms.digestAlgorithmUri,
      signerCertificateReference: 'signing-key://fgis/test/certificate-1',
      signingPolicyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
    })),
  } as unknown as FgisGrainSigningProviderPort;
  const assemblerPort = {
    assemble: jest.fn(async () => ({
      signedEnvelopeReference: 'object-store://fgis/test/signed-1.xml',
      signedEnvelopeSha256: 'e'.repeat(64),
      signedEnvelopeSizeBytes: 4096,
      signatureReferenceUri: '#message-data-dispatch-1',
    })),
  } as unknown as FgisGrainSignedEnvelopeAssemblerPort;
  const transportPort = {
    send: jest.fn(async () => overrides.transportResult ?? ({
      delivered: true,
      responseCode: 'accepted' as const,
      providerMessageId: 'provider-message-1',
      responseBodySha256: 'f'.repeat(64),
      httpStatus: 200,
      durationMs: 25,
      faultCode: null,
      retryable: false,
    })),
  } as unknown as FgisGrainSoapTransportPort;
  const handler = new FgisGrainOutboxDispatchHandler(
    worker,
    configurationPort,
    payloadStorePort,
    canonicalizationPort,
    signingProviderPort,
    assemblerPort,
    transportPort,
  );
  return {
    ...authority,
    handlers,
    handler,
    configurationPort,
    payloadStorePort,
    canonicalizationPort,
    signingProviderPort,
    assemblerPort,
    transportPort,
  };
}

describe('FGIS Grain canonical outbox dispatch handler', () => {
  it('registers one type-specific handler without replacing the generic fallback', () => {
    const harness = createHarness();
    harness.handler.onModuleInit();
    expect(harness.handlers.size).toBe(1);
    expect(harness.handlers.has(FGIS_GRAIN_OUTBOX_EVENT_TYPE)).toBe(true);
  });

  it('executes the governed reference/hash pipeline and accepts only transport acceptance', async () => {
    const harness = createHarness();
    await harness.handler.dispatch(harness.entry);

    expect(harness.configurationPort.resolve).toHaveBeenCalledWith(
      harness.payload.providerConfigurationReference,
    );
    expect(harness.payloadStorePort.load).toHaveBeenCalledWith(
      UNSIGNED_REFERENCE,
    );
    expect(harness.canonicalizationPort.canonicalize).toHaveBeenCalledWith(
      expect.objectContaining({
        messageDataSha256: harness.payload.messageDataSha256,
        signingPolicyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
      }),
    );
    expect(harness.signingProviderPort.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        signingKeyReference: 'signing-key://fgis/test/key-1',
        credentialReference: 'credential://fgis/test/credential-1',
      }),
    );
    const assemblyRequest = (harness.assemblerPort.assemble as jest.Mock).mock.calls[0][0];
    expect(assemblyRequest.signatureInsertionStartByteOffset).toBeGreaterThan(0);
    expect(assemblyRequest.signatureInsertionEndByteOffset)
      .toBe(assemblyRequest.signatureInsertionStartByteOffset);
    const transportRequest = (harness.transportPort.send as jest.Mock).mock.calls[0][0];
    expect(transportRequest).toEqual(expect.objectContaining({
      signedEnvelopeReference: 'object-store://fgis/test/signed-1.xml',
      signedEnvelopeSha256: 'e'.repeat(64),
      idempotencyKey: harness.entry.idempotencyKey,
    }));
    expect(Object.keys(transportRequest)).not.toEqual(expect.arrayContaining([
      'bytes',
      'rawXml',
      'privateKey',
      'certificateBytes',
      'signatureBytes',
    ]));
  });

  it('rejects byte tampering before canonicalization or signing', async () => {
    const authority = createAuthority();
    const tampered = Buffer.from(authority.unsigned.unsignedEnvelopeBytes);
    tampered[tampered.length - 1] ^= 1;
    const harness = createHarness({ storedBytes: tampered });

    await expect(harness.handler.dispatch(harness.entry)).rejects.toMatchObject({
      code: 'PAYLOAD_INTEGRITY_MISMATCH',
      retryable: false,
    });
    expect(harness.canonicalizationPort.canonicalize).not.toHaveBeenCalled();
    expect(harness.signingProviderPort.sign).not.toHaveBeenCalled();
    expect(harness.transportPort.send).not.toHaveBeenCalled();
  });

  it.each([
    {
      delivered: true,
      responseCode: 'ignored' as const,
      providerMessageId: null,
      responseBodySha256: null,
      httpStatus: 200,
      durationMs: 10,
      faultCode: null,
      retryable: false,
    },
    {
      delivered: false,
      responseCode: null,
      providerMessageId: null,
      responseBodySha256: null,
      httpStatus: 503,
      durationMs: 10,
      faultCode: 'TEMPORARY_UNAVAILABLE',
      retryable: true,
    },
  ])('rejects non-accepted transport result %#', async (transportResult) => {
    const harness = createHarness({ transportResult });
    try {
      await harness.handler.dispatch(harness.entry);
      throw new Error('expected transport rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(FgisGrainDispatchError);
      expect(error).toMatchObject({
        code: 'TRANSPORT_REJECTED',
        retryable: transportResult.retryable,
      });
    }
  });
});
