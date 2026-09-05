import {
  INTEGRATION_BINDING_TYPES,
  INTEGRATION_CAPABILITY_MATURITIES,
  assessIntegrationCapability,
  type IntegrationCapabilityEvidenceFact,
} from '../../../../../packages/domain-core/src';
import {
  IntegrationBindingValidationError,
  assertIntegrationBindingReplay,
  integrationBindingCommandFingerprint,
  type IntegrationBindingCommand,
} from './integration-binding.contract';

const NOW = new Date('2026-09-04T23:30:00.000Z');

function fact(
  maturity: IntegrationCapabilityEvidenceFact['maturity'],
  overrides: Partial<IntegrationCapabilityEvidenceFact> = {},
): IntegrationCapabilityEvidenceFact {
  return {
    maturity,
    evidenceReference: `evidence:${maturity}`,
    evidenceIssuer: 'EXTERNAL_AUTHORITY',
    externalReceiptId: maturity === 'LIVE_ACCEPTED' ? 'external-receipt-1' : null,
    checkedAt: '2026-09-04T22:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

function command(
  overrides: Partial<Extract<IntegrationBindingCommand, { action: 'UPSERT' }>> = {},
): Extract<IntegrationBindingCommand, { action: 'UPSERT' }> {
  return {
    bindingKey: 'edo-primary',
    action: 'UPSERT',
    providerCapabilityId: 'provider-cap-1234567890abcdef1234567890abcdef',
    capabilityCode: 'DOCUMENT_TRANSMISSION',
    transportType: 'REST',
    environment: 'SANDBOX',
    endpointReference: 'endpoint:edo:sandbox',
    credentialReference: 'secret:edo:sandbox',
    commandId: 'command.binding.001',
    idempotencyKey: 'idem.binding.001',
    correlationId: 'corr.binding.001',
    expectedVersion: '0',
    reason: 'Configure the declared document transport binding.',
    ...overrides,
  };
}

describe('integration binding contract', () => {
  it('pins the exact eight transport types and eleven maturity states from the specification', () => {
    expect(INTEGRATION_BINDING_TYPES).toEqual([
      'REST', 'WEBHOOK', '1C', 'SFTP', 'FILE', 'DEEPLINK', 'PLATFORM_UI', 'MANUAL',
    ]);
    expect(INTEGRATION_CAPABILITY_MATURITIES).toEqual([
      'DISCOVERED', 'PUBLIC_SPEC_VERIFIED', 'CONTRACT_MAPPED',
      'ADAPTER_IMPLEMENTED', 'CONTRACT_TESTED', 'EXTERNAL_ACCESS_PENDING',
      'CONTRACT_PENDING', 'LIVE_TESTING', 'LIVE_ACCEPTED', 'DEGRADED', 'SUSPENDED',
    ]);
  });

  it('starts at DISCOVERED and refuses to skip missing evidence stages', () => {
    expect(assessIntegrationCapability('PENDING_VERIFICATION', [], NOW)).toMatchObject({
      maturity: 'DISCOVERED',
      nextRequired: 'PUBLIC_SPEC_VERIFIED',
      mayCarryRealTraffic: false,
    });
    expect(assessIntegrationCapability(
      'ACTIVE',
      [fact('PUBLIC_SPEC_VERIFIED'), fact('ADAPTER_IMPLEMENTED')],
      NOW,
    )).toMatchObject({
      maturity: 'PUBLIC_SPEC_VERIFIED',
      nextRequired: 'CONTRACT_MAPPED',
      mayCarryRealTraffic: false,
    });
  });

  it('admits real traffic only with a contiguous chain and an external LIVE_ACCEPTED receipt', () => {
    const chain = INTEGRATION_CAPABILITY_MATURITIES.slice(1, 9).map((maturity) => fact(maturity));
    expect(assessIntegrationCapability('ACTIVE', chain, NOW)).toMatchObject({
      maturity: 'LIVE_ACCEPTED',
      nextRequired: null,
      mayCarryRealTraffic: true,
    });
    const ownReceipt = chain.map((item) => item.maturity === 'LIVE_ACCEPTED'
      ? fact('LIVE_ACCEPTED', { evidenceIssuer: 'PC_CROP' })
      : item);
    expect(assessIntegrationCapability('ACTIVE', ownReceipt, NOW)).toMatchObject({
      maturity: 'LIVE_TESTING',
      nextRequired: 'LIVE_ACCEPTED',
      mayCarryRealTraffic: false,
    });
  });

  it('lets current operational degradation or withdrawal override positive history', () => {
    expect(assessIntegrationCapability(
      'ACTIVE',
      [fact('PUBLIC_SPEC_VERIFIED'), fact('DEGRADED', { checkedAt: '2026-09-04T23:00:00.000Z' })],
      NOW,
    )).toMatchObject({ maturity: 'DEGRADED', mayCarryRealTraffic: false });
    expect(assessIntegrationCapability('WITHDRAWN', [], NOW)).toMatchObject({
      maturity: 'SUSPENDED',
      mayCarryRealTraffic: false,
    });
  });

  it('binds idempotency to the normalized payload and rejects secret-shaped query strings', () => {
    const original = command();
    const fingerprint = integrationBindingCommandFingerprint(original);
    expect(integrationBindingCommandFingerprint(command({
      reason: ` ${original.reason} `,
      endpointReference: ` ${original.endpointReference} `,
    }))).toBe(fingerprint);
    expect(() => assertIntegrationBindingReplay(fingerprint, command({ transportType: 'SFTP' })))
      .toThrow(IntegrationBindingValidationError);
    expect(() => integrationBindingCommandFingerprint(command({
      credentialReference: 'token=raw-secret',
    }))).toThrow(expect.objectContaining({ code: 'REFERENCE_INVALID' }));
    expect(() => integrationBindingCommandFingerprint(command({
      credentialReference: 'raw-secret-token',
    }))).toThrow(expect.objectContaining({ code: 'REFERENCE_INVALID' }));
  });

  it.each([
    { checkedAt: '2026-09-04T23:30:00.001Z' },
    { checkedAt: 'not-a-timestamp' },
    { expiresAt: '2026-09-04T23:30:00.000Z' },
    { expiresAt: 'not-a-timestamp' },
  ])('rejects a live receipt outside its valid observation window: %j', (overrides) => {
    const chain = INTEGRATION_CAPABILITY_MATURITIES.slice(1, 8).map((maturity) => fact(maturity));
    expect(assessIntegrationCapability('ACTIVE', [...chain, fact('LIVE_ACCEPTED', overrides)], NOW))
      .toMatchObject({ maturity: 'LIVE_TESTING', mayCarryRealTraffic: false });
  });

  it('fails closed when the assessment clock is invalid', () => {
    const chain = INTEGRATION_CAPABILITY_MATURITIES.slice(1, 9).map((maturity) => fact(maturity));
    expect(assessIntegrationCapability('ACTIVE', chain, new Date('invalid')))
      .toMatchObject({ mayCarryRealTraffic: false });
  });

  it.each(['DEGRADED', 'SUSPENDED'] as const)(
    'does not clear %s with a newer intermediate fact or an unqualified receipt',
    (maturity) => {
      const chain = INTEGRATION_CAPABILITY_MATURITIES.slice(1, 9).map((stage) => fact(stage));
      const incident = fact(maturity, { checkedAt: '2026-09-04T23:00:00.000Z' });
      for (const later of [
        fact('CONTRACT_TESTED', { checkedAt: '2026-09-04T23:10:00.000Z' }),
        fact('LIVE_ACCEPTED', { checkedAt: '2026-09-04T23:10:00.000Z', evidenceIssuer: 'PLATFORM' }),
        fact('LIVE_ACCEPTED', { checkedAt: '2026-09-04T23:10:00.000Z', externalReceiptId: null }),
        fact('LIVE_ACCEPTED', { checkedAt: '2026-09-05T00:00:00.000Z' }),
      ]) {
        expect(assessIntegrationCapability('ACTIVE', [...chain, incident, later], NOW))
          .toMatchObject({ maturity, mayCarryRealTraffic: false });
      }
    },
  );

  it('requires a strictly newer external receipt to recover from an incident', () => {
    const chain = INTEGRATION_CAPABILITY_MATURITIES.slice(1, 9).map((stage) => fact(stage));
    const incident = fact('DEGRADED', { checkedAt: '2026-09-04T23:00:00.000Z' });
    const tiedReceipt = fact('LIVE_ACCEPTED', { checkedAt: incident.checkedAt });
    for (const simultaneous of [[incident, tiedReceipt], [tiedReceipt, incident]]) {
      expect(assessIntegrationCapability('ACTIVE', [...chain, ...simultaneous], NOW))
        .toMatchObject({ maturity: 'DEGRADED', mayCarryRealTraffic: false });
    }
    expect(assessIntegrationCapability('ACTIVE', [
      ...chain, incident, fact('LIVE_ACCEPTED', { checkedAt: '2026-09-04T23:10:00.000Z' }),
    ], NOW)).toMatchObject({ maturity: 'LIVE_ACCEPTED', mayCarryRealTraffic: true });
  });

  it('resolves simultaneous operational facts conservatively regardless of input order', () => {
    const degraded = fact('DEGRADED');
    const suspended = fact('SUSPENDED');
    for (const evidence of [[degraded, suspended], [suspended, degraded]]) {
      expect(assessIntegrationCapability('ACTIVE', evidence, NOW))
        .toMatchObject({ maturity: 'SUSPENDED', mayCarryRealTraffic: false });
    }
  });
});
