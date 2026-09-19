import {
  FGIS_GRAIN_PROVIDER_ATTESTATION_SCHEMA_VERSION,
  FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
  FgisGrainProviderContractError,
  assertFgisGrainProviderAttestationInput,
  assertFgisGrainProviderConfigurationDraft,
  assertTestActivationAllowed,
} from './fgis-grain-provider-attestation.contract';

function draft(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
    adapterCode: 'FGIS_ZERNO',
    apiVersion: '1.0.23',
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
    signingPolicyVersion: 'fgis-zerno-1.0.23-signing-policy.v1',
    environment: 'PRE_PRODUCTION',
    endpointReference: 'endpoint://fgis-zerno/pre-production',
    tlsPolicyReference: 'tls://fgis-zerno/pre-production-v1',
    credentialReference: 'credential://vault/fgis-zerno/pre-production',
    signingKeyReference: 'signing-key://vault/fgis-zerno/pre-production',
    payloadStoreReference: 'object-store://fgis-zerno/pre-production',
    ...overrides,
  };
}

function attestation(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: FGIS_GRAIN_PROVIDER_ATTESTATION_SCHEMA_VERSION,
    gate: 'SECURITY',
    decision: 'APPROVED',
    justification: 'Security review completed against the governed evidence package.',
    evidenceReference: 'evidence://fgis-zerno/security-review-1',
    validUntil: '2026-07-30T12:00:00.000Z',
    configurationVersion: '3',
    ...overrides,
  };
}

function expectContractError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('expected contract error');
  } catch (error) {
    expect(error).toBeInstanceOf(FgisGrainProviderContractError);
    expect((error as FgisGrainProviderContractError).code).toBe(code);
  }
}

describe('FGIS Grain provider configuration and attestation contracts', () => {
  it('accepts only reference-based PRE_PRODUCTION configuration', () => {
    expect(assertFgisGrainProviderConfigurationDraft(draft())).toEqual(draft());
  });

  it.each([
    ['localhost placeholder', { endpointReference: 'endpoint://localhost/fgis' }, 'INLINE_SECRET_OR_ENDPOINT_FORBIDDEN'],
    ['raw userinfo', { credentialReference: 'credential://user@vault/fgis' }, 'INLINE_SECRET_OR_ENDPOINT_FORBIDDEN'],
    ['malformed token-bearing reference', { credentialReference: 'credential://vault/token=secret' }, 'REFERENCE_INVALID'],
    ['raw private key marker', { signingKeyReference: 'signing-key://vault/-----BEGIN' }, 'INLINE_SECRET_OR_ENDPOINT_FORBIDDEN'],
    ['unexpected field', { password: 'secret' }, 'MALFORMED_CONFIGURATION'],
    ['wrong API pin', { apiVersion: '1.0.22' }, 'MALFORMED_CONFIGURATION'],
  ])('rejects %s', (_name, overrides, code) => {
    expectContractError(() => assertFgisGrainProviderConfigurationDraft(draft(overrides)), code);
  });

  it('allows production configuration to be drafted but never activated in this slice', () => {
    const production = assertFgisGrainProviderConfigurationDraft(
      draft({ environment: 'PRODUCTION' }),
    );
    expect(production.environment).toBe('PRODUCTION');
    expectContractError(
      () => assertTestActivationAllowed(production.environment),
      'PRODUCTION_ACTIVATION_FORBIDDEN',
    );
  });

  it('validates gate, justification, evidence, TTL and configuration version', () => {
    const now = new Date('2026-07-24T12:00:00.000Z');
    expect(assertFgisGrainProviderAttestationInput(attestation(), now)).toEqual(
      attestation(),
    );
    expectContractError(
      () => assertFgisGrainProviderAttestationInput(
        attestation({ validUntil: '2026-07-24T12:04:59.000Z' }),
        now,
      ),
      'ATTESTATION_TTL_INVALID',
    );
    expectContractError(
      () => assertFgisGrainProviderAttestationInput(
        attestation({ validUntil: '2026-09-01T12:00:00.000Z' }),
        now,
      ),
      'ATTESTATION_TTL_INVALID',
    );
    expectContractError(
      () => assertFgisGrainProviderAttestationInput(
        attestation({ configurationVersion: '-1' }),
        now,
      ),
      'ATTESTATION_VERSION_INVALID',
    );
    expectContractError(
      () => assertFgisGrainProviderAttestationInput(
        attestation({ evidenceReference: '<soap:Envelope/>' }),
        now,
      ),
      'REFERENCE_INVALID',
    );
  });

  it('permits only the four governed independent gates', () => {
    const now = new Date('2026-07-24T12:00:00.000Z');
    for (const gate of ['OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS'] as const) {
      expect(assertFgisGrainProviderAttestationInput(attestation({ gate }), now).gate)
        .toBe(gate);
    }
    expectContractError(
      () => assertFgisGrainProviderAttestationInput(attestation({ gate: 'FINANCE' }), now),
      'MALFORMED_ATTESTATION',
    );
  });
});
