import {
  FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
  FGIS_GRAIN_OPERATIONAL_STATUS,
  FGIS_GRAIN_OUTBOX_EVENT_TYPE,
  FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
  FGIS_GRAIN_SIGNING_POLICY_VERSION,
  FgisGrainDispatchError,
  validateFgisGrainOutboundDispatchPayload,
  validateFgisGrainProviderConfiguration,
} from './fgis-grain-1.0.23.dispatch.contract';
import {
  FailClosedFgisGrainCanonicalizationPort,
  FailClosedFgisGrainImmutablePayloadStorePort,
  FailClosedFgisGrainProviderConfigurationPort,
  FailClosedFgisGrainSignedEnvelopeAssemblerPort,
  FailClosedFgisGrainSigningProviderPort,
  FailClosedFgisGrainSoapTransportPort,
} from './fgis-grain-1.0.23.dispatch.fail-closed';
import { FGIS_GRAIN_1_0_23_SIGNING_POLICY } from './fgis-grain-1.0.23.signing-policy.generated';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function payload() {
  return {
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
    messageId: 'f47ac10b-58cc-11cf-a447-001122334455',
    referenceMessageId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
    messageDataId: 'message-data-1',
    unsignedEnvelopeReference: 'object-store://fgis/test/unsigned-1.xml',
    unsignedEnvelopeSha256: SHA_A,
    unsignedEnvelopeSizeBytes: 1024,
    messageDataSha256: SHA_B,
    providerConfigurationReference: 'config://fgis/test/provider-1',
    correlationId: 'correlation-1',
    causationId: null,
  } as const;
}

function configuration() {
  return {
    schemaVersion: FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
    adapterCode: 'FGIS_ZERNO',
    apiVersion: '1.0.23',
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
    signingPolicyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
    environment: 'SANDBOX',
    activationState: 'TEST_APPROVED',
    endpointReference: 'config://fgis/test/endpoint',
    tlsPolicyReference: 'tls://fgis/test/policy',
    credentialReference: 'credential://fgis/test/service-account',
    signingKeyReference: 'signing-key://fgis/test/key-1',
    payloadStoreReference: 'object-store://fgis/test',
    productionAttestationReference: null,
  } as const;
}

describe('FGIS Grain API 1.0.23 dispatch contracts', () => {
  it('keeps the adapter non-live and binds the exact official policy', () => {
    expect(FGIS_GRAIN_OUTBOX_EVENT_TYPE)
      .toBe('FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED');
    expect(FGIS_GRAIN_OPERATIONAL_STATUS).toBe('NOT_ATTESTED');
    expect(FGIS_GRAIN_1_0_23_SIGNING_POLICY).toEqual(expect.objectContaining({
      policyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
      implementationStatus: 'PORTS_ONLY',
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
      algorithms: {
        digestAlgorithmUri:
          'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34112012-256',
        signatureAlgorithmUri:
          'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256',
        canonicalizationAlgorithmUri:
          'http://www.w3.org/2001/10/xml-exc-c14n#',
        transformAlgorithmUri: 'urn://smev-gov-ru/xmldsig/transform',
      },
    }));
    expect(Object.values(FGIS_GRAIN_1_0_23_SIGNING_POLICY.boundaries))
      .toEqual(expect.arrayContaining([false]));
  });

  it('accepts only a reference-only, versioned outbox payload', () => {
    expect(validateFgisGrainOutboundDispatchPayload(payload())).toEqual({
      valid: true,
      payload: payload(),
    });
    expect(validateFgisGrainOutboundDispatchPayload({
      ...payload(),
      rawXml: '<secret/>',
    })).toEqual({
      valid: false,
      errorCode: 'RAW_XML_OR_SECRET_FIELD_FORBIDDEN',
    });
    expect(validateFgisGrainOutboundDispatchPayload({
      ...payload(),
      privateKey: 'inline-private-key',
    })).toEqual({
      valid: false,
      errorCode: 'RAW_XML_OR_SECRET_FIELD_FORBIDDEN',
    });
    expect(validateFgisGrainOutboundDispatchPayload({
      ...payload(),
      unsignedEnvelopeSha256: 'not-a-hash',
    })).toEqual({
      valid: false,
      errorCode: 'INVALID_CONTENT_HASH',
    });
    expect(validateFgisGrainOutboundDispatchPayload({
      ...payload(),
      transportOperation: 'Ack',
      businessOperationCode: 'CREATE_SDIZ',
    })).toEqual({
      valid: false,
      errorCode: 'BUSINESS_OPERATION_FORBIDDEN',
    });
  });

  it('accepts server-side references and rejects inline endpoints/secrets', () => {
    expect(validateFgisGrainProviderConfiguration(configuration())).toEqual({
      valid: true,
      configuration: configuration(),
    });
    expect(validateFgisGrainProviderConfiguration({
      ...configuration(),
      endpointReference: 'https://provider.example/ws',
    })).toEqual({
      valid: false,
      errorCode: 'INLINE_ENDPOINT_OR_SECRET_FORBIDDEN',
    });
    expect(validateFgisGrainProviderConfiguration({
      ...configuration(),
      password: 'inline-password',
    })).toEqual({
      valid: false,
      errorCode: 'PROVIDER_CONFIG_MALFORMED',
    });
    expect(validateFgisGrainProviderConfiguration({
      ...configuration(),
      activationState: 'DISABLED',
    })).toEqual({
      valid: false,
      errorCode: 'PROVIDER_CONFIG_DISABLED',
    });
  });

  it('requires a separate production attestation reference', () => {
    expect(validateFgisGrainProviderConfiguration({
      ...configuration(),
      environment: 'PRODUCTION',
      activationState: 'PRODUCTION_APPROVED',
      productionAttestationReference: null,
    })).toEqual({
      valid: false,
      errorCode: 'PRODUCTION_ATTESTATION_REQUIRED',
    });
    expect(validateFgisGrainProviderConfiguration({
      ...configuration(),
      environment: 'PRODUCTION',
      activationState: 'PRODUCTION_APPROVED',
      productionAttestationReference:
        'policy://fgis/production/attestation-2026-07',
    })).toEqual({
      valid: true,
      configuration: expect.objectContaining({
        environment: 'PRODUCTION',
        activationState: 'PRODUCTION_APPROVED',
      }),
    });
  });

  it('binds every production worker port to a fail-closed default', async () => {
    const actions = [
      () => new FailClosedFgisGrainProviderConfigurationPort()
        .resolve('config://fgis/test/provider'),
      () => new FailClosedFgisGrainImmutablePayloadStorePort()
        .load('object-store://fgis/test/payload'),
      () => new FailClosedFgisGrainCanonicalizationPort()
        .canonicalize({} as never),
      () => new FailClosedFgisGrainSigningProviderPort().sign({} as never),
      () => new FailClosedFgisGrainSignedEnvelopeAssemblerPort()
        .assemble({} as never),
      () => new FailClosedFgisGrainSoapTransportPort().send({} as never),
    ];
    for (const action of actions) {
      await expect(action()).rejects.toBeInstanceOf(FgisGrainDispatchError);
      await expect(action()).rejects.not.toMatchObject({
        message: expect.stringMatching(/private|password|token|certificate bytes/iu),
      });
    }
  });
});
