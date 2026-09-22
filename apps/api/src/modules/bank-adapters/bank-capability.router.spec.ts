import type { BankCapability } from '../../../../../packages/domain-core/src/bank-capability';
import type {
  BankReferenceAdapter,
  BankProviderFamily,
} from './bank-adapter.port';
import { BankCapabilityRouter, type BankRoutingAuthority } from './bank-capability.router';
import { SberReferenceAdapter } from './sber-reference.adapter';
import { AlfaReferenceAdapter } from './alfa-reference.adapter';
import { TBankReferenceAdapter } from './tbank-reference.adapter';

const authority = (
  providerFamily: BankProviderFamily,
  overrides: Partial<BankRoutingAuthority> = {},
): BankRoutingAuthority => ({
  providerFamily,
  integrationBindingId: 'binding-1',
  bindingKey: 'bank-primary',
  providerId: 'provider-1',
  providerCapabilityId: 'provider-cap-1',
  capabilityCode: 'BANK',
  authorizedBankCapabilities: ['SAFE_DEAL_RESERVE_RELEASE', 'DIRECT_PAYMENT', 'BILLING', 'FINANCING_APPLICATION', 'STATEMENT_READ', 'STATUS_READ', 'AUTHENTICATED_CALLBACK', 'RECONCILIATION'],
  maturity: 'LIVE_ACCEPTED',
  bindingVersion: '7',
  configurationVersion: 'cfg-7',
  evidenceMode: 'SERVER_HELD',
  credentialReadiness: 'VERIFIED_CURRENT',
  callbackTrustReadiness: 'VERIFIED_CURRENT',
  productionEnvironmentConfirmed: true,
  mayCarryRealTraffic: true,
  ...overrides,
});

function liveTestAdapter(
  providerFamily: 'TEST_DOUBLE_A' | 'TEST_DOUBLE_B',
  capabilities: readonly BankCapability[],
): BankReferenceAdapter {
  return {
    providerFamily,
    capabilities,
    contractMode: 'REFERENCE_CONFORMANCE_ONLY',
    liveTransportImplemented: true,
    describeRequest: (input) => ({
      providerFamily,
      capability: capabilities[0]!,
      command: input.command,
      operationId: input.operationId,
      idempotencyKey: input.idempotencyKey,
      amountMinor: input.amountMinor,
      currency: input.currency,
      sourceVersion: input.sourceVersion,
      beneficiaryReference: input.beneficiaryReference,
      contractMode: 'REFERENCE_CONFORMANCE_ONLY',
      liveRequestReady: false,
    }),
    mapDispatchResponse: (response) => ({
      providerFamily,
      acknowledgement: 'ACCEPTED_NONFINAL',
      providerOperationId: response.providerOperationId,
      idempotencyKey: response.idempotencyKey,
      rawStatus: response.rawStatus,
      observedAt: response.observedAt,
      canonicalFinality: 'NOT_DECIDED_HERE',
      retryPolicy: 'RECONCILE_BEFORE_RETRY',
    }),
    mapReceiptResponse: (response) => ({
      providerFamily,
      operationId: response.operationId,
      providerOperationId: response.providerOperationId,
      idempotencyKey: response.idempotencyKey,
      providerEventId: response.providerEventId,
      externalReceiptId: response.externalReceiptId,
      authenticationAuthorityRef: response.authenticationAuthorityRef,
      authenticationEvidenceRef: response.authenticationEvidenceRef,
      payloadFingerprint: response.payloadFingerprint,
      amountMinor: response.amountMinor,
      currency: response.currency,
      evidenceState: 'SUCCESS_EVIDENCE',
      rawStatus: response.rawStatus,
      observedAt: response.observedAt,
      canonicalFinality: 'NOT_DECIDED_HERE',
    }),
  };
}

describe('bank capability router', () => {
  const router = new BankCapabilityRouter([
    new SberReferenceAdapter(),
    new AlfaReferenceAdapter(),
    new TBankReferenceAdapter(),
  ]);

  it('requires an exact server-held provider/binding authority', () => {
    expect(router.route(null, 'STATUS_READ')).toEqual({
      status: 'NOT_ACTIVATED',
      adapter: null,
      reason: 'SERVER_HELD_PROVIDER_BINDING_REQUIRED',
    });
    for (const broken of [
      { integrationBindingId: '' },
      { capabilityCode: '' },
    ] as const) {
      expect(router.route(
        authority('SBER', broken),
        'STATUS_READ',
      )).toMatchObject({
        status: 'CONTRADICTORY',
        reason: 'INCOMPLETE_SERVER_HELD_BINDING_AUTHORITY',
      });
    }
  });

  it('requires the server-held provider binding to authorize the exact capability', () => {
    expect(router.route(
      authority('T_BANK', { authorizedBankCapabilities: ['STATUS_READ'] }),
      'BILLING',
    )).toMatchObject({
      status: 'UNSUPPORTED',
      reason: 'SERVER_HELD_CAPABILITY_NOT_AUTHORIZED:BILLING',
    });
  });

  it('does not substitute one adapter capability for another', () => {
    for (const capability of ['BILLING', 'FINANCING_APPLICATION', 'STATEMENT_READ'] as const) {
      expect(router.route(authority('SBER'), capability)).toMatchObject({
        status: 'UNSUPPORTED',
        reason: `CAPABILITY_NOT_SUPPORTED:${capability}`,
      });
    }
  });

  it('ignores BANK_MODE/BANK_PROVIDER environment hints when server-held authority is absent', () => {
    const priorMode = process.env.BANK_MODE;
    const priorProvider = process.env.BANK_PROVIDER;
    process.env.BANK_MODE = 'production';
    process.env.BANK_PROVIDER = 'sber';
    try {
      expect(router.route(null, 'STATUS_READ')).toMatchObject({
        status: 'NOT_ACTIVATED',
        reason: 'SERVER_HELD_PROVIDER_BINDING_REQUIRED',
      });
    } finally {
      if (priorMode === undefined) delete process.env.BANK_MODE; else process.env.BANK_MODE = priorMode;
      if (priorProvider === undefined) delete process.env.BANK_PROVIDER; else process.env.BANK_PROVIDER = priorProvider;
    }
  });

  it('requires server-confirmed production environment before live routing', () => {
    expect(router.route(
      authority('T_BANK', { productionEnvironmentConfirmed: false }),
      'STATUS_READ',
    )).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'PRODUCTION_ENVIRONMENT_NOT_CONFIRMED',
    });
  });

  it('fails closed on truthy non-boolean live-routing flags at runtime', () => {
    const testRouter = new BankCapabilityRouter([
      liveTestAdapter('TEST_DOUBLE_A', ['DIRECT_PAYMENT']),
    ]);
    const malformedTraffic = {
      ...authority('TEST_DOUBLE_A'),
      mayCarryRealTraffic: 'true',
    } as unknown as BankRoutingAuthority;
    expect(testRouter.route(malformedTraffic, 'DIRECT_PAYMENT')).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'SERVER_HELD_MATURITY_DOES_NOT_ALLOW_REAL_TRAFFIC',
    });

    const malformedEnvironment = {
      ...authority('TEST_DOUBLE_A'),
      productionEnvironmentConfirmed: 'true',
    } as unknown as BankRoutingAuthority;
    expect(testRouter.route(malformedEnvironment, 'DIRECT_PAYMENT')).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'PRODUCTION_ENVIRONMENT_NOT_CONFIRMED',
    });
  });

  it('fails closed when adapter live-transport readiness is truthy but not boolean true', () => {
    const malformedAdapter = {
      ...liveTestAdapter('TEST_DOUBLE_A', ['DIRECT_PAYMENT']),
      liveTransportImplemented: 'true',
    } as unknown as BankReferenceAdapter;
    const testRouter = new BankCapabilityRouter([malformedAdapter]);

    expect(testRouter.route(authority('TEST_DOUBLE_A'), 'DIRECT_PAYMENT')).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'REFERENCE_ADAPTER_HAS_NO_LIVE_TRANSPORT',
    });
  });

  it('requires current credential and callback-trust evidence before live routing', () => {
    expect(router.route(
      authority('T_BANK', { credentialReadiness: 'MISSING_OR_UNKNOWN' }),
      'STATUS_READ',
    )).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'CREDENTIAL_OR_CALLBACK_TRUST_NOT_VERIFIED',
    });
    expect(router.route(
      authority('T_BANK', { callbackTrustReadiness: 'EXPIRED_OR_REVOKED' }),
      'STATUS_READ',
    )).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'CREDENTIAL_OR_CALLBACK_TRUST_NOT_VERIFIED',
    });
  });

  it('keeps all three reference adapters NOT_ACTIVATED even with a LIVE_ACCEPTED authority because they have no live transport', () => {
    for (const provider of ['SBER', 'ALFA_BANK', 'T_BANK'] as const) {
      expect(router.route(authority(provider), 'STATUS_READ')).toMatchObject({
        status: 'NOT_ACTIVATED',
        reason: 'REFERENCE_ADAPTER_HAS_NO_LIVE_TRANSPORT',
      });
    }
  });

  it('fails closed when either maturity or server assessment does not admit real traffic', () => {
    expect(router.route(
      authority('T_BANK', { maturity: 'CONTRACT_TESTED', mayCarryRealTraffic: true }),
      'BILLING',
    )).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'SERVER_HELD_MATURITY_DOES_NOT_ALLOW_REAL_TRAFFIC',
    });
    expect(router.route(
      authority('T_BANK', { mayCarryRealTraffic: false }),
      'BILLING',
    )).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'SERVER_HELD_MATURITY_DOES_NOT_ALLOW_REAL_TRAFFIC',
    });
  });

  it('proves provider substitution through the same router contract with independent test doubles only', () => {
    const testRouter = new BankCapabilityRouter([
      liveTestAdapter('TEST_DOUBLE_A', ['DIRECT_PAYMENT']),
      liveTestAdapter('TEST_DOUBLE_B', ['DIRECT_PAYMENT']),
    ]);
    for (const provider of ['TEST_DOUBLE_A', 'TEST_DOUBLE_B'] as const) {
      expect(testRouter.route(authority(provider), 'DIRECT_PAYMENT')).toMatchObject({
        status: 'READY_FOR_REAL_TRAFFIC',
        authority: { providerFamily: provider },
      });
    }
  });
});
