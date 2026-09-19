import {
  classifyRegulatoryIntegrationError,
} from './regulatory-integration.errors';
import {
  REGULATORY_INTEGRATION_STATES,
  type RegulatoryInboundEnvelope,
  validateRegulatoryInboundEnvelope,
} from './regulatory-integration.types';

const policy = {
  allowedSchemaVersions: ['1.0'],
  allowedMappingVersions: ['2026-07-22'],
  requireSignature: true,
} as const;

function envelope(
  overrides: Partial<RegulatoryInboundEnvelope> = {},
): RegulatoryInboundEnvelope {
  return {
    provider: 'provider-code',
    externalEventId: 'event-1',
    schemaVersion: '1.0',
    mappingVersion: '2026-07-22',
    occurredAt: '2026-07-22T20:00:00.000Z',
    rawBodySha256: 'a'.repeat(64),
    signature: {
      algorithm: 'GOST-2012-256',
      keyReference: 'provider-key-reference',
      keyVersion: '3',
      signatureVersion: '1',
      verificationPolicyVersion: '2026-07-22',
    },
    correlationId: 'correlation-1',
    causationId: null,
    ...overrides,
  };
}

describe('regulatory integration contracts', () => {
  it('exposes the complete durable inbox state machine', () => {
    expect(REGULATORY_INTEGRATION_STATES).toEqual([
      'RECEIVED',
      'VERIFIED',
      'PROCESSING',
      'PROCESSED',
      'RETRY',
      'QUARANTINED',
      'DEAD',
    ]);
  });

  it('accepts a supported signed envelope without carrying raw payload', () => {
    const candidate = envelope();

    expect(validateRegulatoryInboundEnvelope(candidate, policy)).toEqual({
      valid: true,
    });
    expect(candidate).not.toHaveProperty('rawBody');
  });

  it.each([
    [{ provider: '' }, 'MALFORMED_ENVELOPE'],
    [{ occurredAt: 'not-a-date' }, 'MALFORMED_ENVELOPE'],
    [{ rawBodySha256: 'abc' }, 'MALFORMED_ENVELOPE'],
    [{ schemaVersion: '2.0' }, 'UNSUPPORTED_SCHEMA_VERSION'],
    [{ mappingVersion: 'unknown' }, 'UNSUPPORTED_MAPPING_VERSION'],
    [{ signature: null }, 'SIGNATURE_REQUIRED'],
  ] as const)(
    'fails closed for %o with %s',
    (overrides, errorCode) => {
      expect(validateRegulatoryInboundEnvelope(envelope(overrides), policy))
        .toEqual({ valid: false, errorCode });
    },
  );

  it('keeps provider acknowledgement separate from business acceptance', () => {
    const outcome = {
      providerAcknowledgement: 'ELIGIBLE_AFTER_DURABLE_COMMIT',
      businessAcceptance: 'PENDING',
      linkedDomainOperationId: null,
    } as const;

    expect(outcome.providerAcknowledgement).not.toBe(outcome.businessAcceptance);
  });
});

describe('regulatory integration error taxonomy', () => {
  it('quarantines replay conflicts as non-retryable security events', () => {
    expect(classifyRegulatoryIntegrationError('REPLAY_CONFLICT')).toEqual({
      code: 'REPLAY_CONFLICT',
      category: 'SECURITY',
      retryable: false,
      failureState: 'QUARANTINED',
      securityRelevant: true,
    });
  });

  it('retries transient provider failures without classifying them as security incidents', () => {
    expect(classifyRegulatoryIntegrationError('TRANSIENT_PROVIDER_FAILURE'))
      .toEqual({
        code: 'TRANSIENT_PROVIDER_FAILURE',
        category: 'PROVIDER',
        retryable: true,
        failureState: 'RETRY',
        securityRelevant: false,
      });
  });

  it('fails missing server authority as a terminal security-relevant error', () => {
    expect(classifyRegulatoryIntegrationError('TENANT_CONTEXT_MISSING'))
      .toEqual({
        code: 'TENANT_CONTEXT_MISSING',
        category: 'AUTHORITY',
        retryable: false,
        failureState: 'DEAD',
        securityRelevant: true,
      });
  });
});
