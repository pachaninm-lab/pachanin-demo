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
  providerFamily: BankProviderFamily,
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

  it('fails closed on malformed runtime binding identity values instead of calling string methods', () => {
    const testRouter = new BankCapabilityRouter([
      liveTestAdapter('SBER', ['DIRECT_PAYMENT']),
    ]);
    for (const broken of [
      { integrationBindingId: 42 },
      { providerId: null },
      { providerCapabilityId: {} },
      { capabilityCode: false },
      { bindingKey: ['bank-primary'] },
      { bindingVersion: 7 },
      { configurationVersion: undefined },
    ]) {
      const malformed = {
        ...authority('SBER'),
        ...broken,
      } as unknown as BankRoutingAuthority;
      expect(testRouter.route(malformed, 'DIRECT_PAYMENT')).toMatchObject({
        status: 'CONTRADICTORY',
        reason: 'INCOMPLETE_SERVER_HELD_BINDING_AUTHORITY',
      });
    }
  });

  it('rejects a server-held binding for a non-bank integration capability', () => {
    const testRouter = new BankCapabilityRouter([
      liveTestAdapter('SBER', ['DIRECT_PAYMENT']),
    ]);
    expect(testRouter.route(
      authority('SBER', { capabilityCode: 'EDO' }),
      'DIRECT_PAYMENT',
    )).toMatchObject({
      status: 'CONTRADICTORY',
      reason: 'SERVER_HELD_CAPABILITY_CODE_MISMATCH',
    });
  });

  it('fails closed when server-held capabilities are not a validated capability array', () => {
    const testRouter = new BankCapabilityRouter([
      liveTestAdapter('SBER', ['DIRECT_PAYMENT']),
    ]);
    const stringInsteadOfArray = {
      ...authority('SBER'),
      authorizedBankCapabilities: 'DIRECT_PAYMENT',
    } as unknown as BankRoutingAuthority;
    expect(testRouter.route(stringInsteadOfArray, 'DIRECT_PAYMENT')).toMatchObject({
      status: 'CONTRADICTORY',
      reason: 'INVALID_SERVER_HELD_CAPABILITY_SET',
    });

    const unknownCapability = {
      ...authority('SBER'),
      authorizedBankCapabilities: ['DIRECT_PAYMENT', 'UNPINNED_CAPABILITY'],
    } as unknown as BankRoutingAuthority;
    expect(testRouter.route(unknownCapability, 'DIRECT_PAYMENT')).toMatchObject({
      status: 'CONTRADICTORY',
      reason: 'INVALID_SERVER_HELD_CAPABILITY_SET',
    });
  });

  it('fails closed when adapter capabilities are not a validated capability array', () => {
    const malformedAdapter = {
      ...liveTestAdapter('SBER', ['DIRECT_PAYMENT']),
      capabilities: 'DIRECT_PAYMENT',
    } as unknown as BankReferenceAdapter;
    const testRouter = new BankCapabilityRouter([malformedAdapter]);

    expect(testRouter.route(authority('SBER'), 'DIRECT_PAYMENT')).toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'INVALID_ADAPTER_CAPABILITY_SET',
    });
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
      liveTestAdapter('SBER', ['DIRECT_PAYMENT']),
    ]);
    const malformedTraffic = {
      ...authority('SBER'),
      mayCarryRealTraffic: 'true',
    } as unknown as BankRoutingAuthority;
    expect(testRouter.route(malformedTraffic, 'DIRECT_PAYMENT')).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'SERVER_HELD_MATURITY_DOES_NOT_ALLOW_REAL_TRAFFIC',
    });

    const malformedEnvironment = {
      ...authority('SBER'),
      productionEnvironmentConfirmed: 'true',
    } as unknown as BankRoutingAuthority;
    expect(testRouter.route(malformedEnvironment, 'DIRECT_PAYMENT')).toMatchObject({
      status: 'NOT_ACTIVATED',
      reason: 'PRODUCTION_ENVIRONMENT_NOT_CONFIRMED',
    });
  });

  it('fails closed when adapter live-transport readiness is truthy but not boolean true', () => {
    const malformedAdapter = {
      ...liveTestAdapter('SBER', ['DIRECT_PAYMENT']),
      liveTransportImplemented: 'true',
    } as unknown as BankReferenceAdapter;
    const testRouter = new BankCapabilityRouter([malformedAdapter]);

    expect(testRouter.route(authority('SBER'), 'DIRECT_PAYMENT')).toMatchObject({
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
      liveTestAdapter('SBER', ['DIRECT_PAYMENT']),
      liveTestAdapter('ALFA_BANK', ['DIRECT_PAYMENT']),
    ]);
    for (const provider of ['SBER', 'ALFA_BANK'] as const) {
      expect(testRouter.route(authority(provider), 'DIRECT_PAYMENT')).toMatchObject({
        status: 'READY_FOR_REAL_TRAFFIC',
        authority: { providerFamily: provider },
      });
    }
  });
});

describe('bank adapter provider identity at runtime', () => {
  it('rejects an identity accessor at registration without executing it', () => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
    const identity = jest.fn(() => 'SBER');
    Object.defineProperty(adapter, 'providerFamily', { get: identity });

    expect(() => new BankCapabilityRouter([adapter])).toThrow('NO_ADAPTER_FOR_SERVER_HELD_PROVIDER');
    expect(identity).not.toHaveBeenCalled();
  });

  it('rejects a self-mutating adapter identity getter without executing it', () => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
    const router = new BankCapabilityRouter([adapter]);
    let reads = 0;
    const identity = jest.fn(() => {
      if (++reads === 2) {
        Object.defineProperty(adapter, 'providerFamily', { value: 'T_BANK', configurable: true });
      }
      return 'SBER';
    });
    Object.defineProperty(adapter, 'providerFamily', { get: identity, configurable: true });

    expect(router.route(authority('SBER'), 'DIRECT_PAYMENT')).toEqual({
      status: 'UNAVAILABLE', adapter: null, reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
    });
    expect(identity).not.toHaveBeenCalled();
  });

  it('rejects an authority identity getter that can change the adapter after its final check', () => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
    const router = new BankCapabilityRouter([adapter]);
    const serverAuthority = authority('SBER');
    let reads = 0;
    const identity = jest.fn(() => {
      if (++reads === 2) Object.assign(adapter, { providerFamily: 'T_BANK' });
      return 'SBER';
    });
    Object.defineProperty(serverAuthority, 'providerFamily', { get: identity });

    expect(router.route(serverAuthority, 'DIRECT_PAYMENT')).toEqual({
      status: 'UNAVAILABLE', adapter: null, reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
    });
    expect(identity).not.toHaveBeenCalled();
    expect(adapter.providerFamily).toBe('SBER');
  });

  it.each([
    ['capabilities', 'adapter'],
    ['capabilities', 'authority'],
    ['liveTransportImplemented', 'adapter'],
    ['liveTransportImplemented', 'authority'],
  ] as const)('rejects an identity getter installed on %s read into %s', (property, target) => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
    const router = new BankCapabilityRouter([adapter]);
    const serverAuthority = authority('SBER');
    const identity = jest.fn(() => 'SBER');
    const calls = (['describeRequest', 'mapDispatchResponse', 'mapReceiptResponse'] as const)
      .map(method => jest.spyOn(adapter, method));
    Object.defineProperty(adapter, property, {
      get() {
        Object.defineProperty(target === 'adapter' ? adapter : serverAuthority, 'providerFamily', {
          get: identity, configurable: true,
        });
        return property === 'capabilities' ? ['DIRECT_PAYMENT'] : true;
      },
    });

    expect(router.route(serverAuthority, 'DIRECT_PAYMENT')).toEqual({
      status: 'UNAVAILABLE', adapter: null, reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
    });
    expect(identity).not.toHaveBeenCalled();
    for (const call of calls) expect(call).not.toHaveBeenCalled();
  });

  it.each([
    ['capabilities', false],
    ['capabilities', true],
    ['liveTransportImplemented', false],
    ['liveTransportImplemented', true],
  ] as const)(
    'rejects provider drift during %s read (authority also changed: %s)', (property, changeAuthority) => {
      const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
      const router = new BankCapabilityRouter([adapter]);
      const serverAuthority = authority('SBER');
      const calls = (['describeRequest', 'mapDispatchResponse', 'mapReceiptResponse'] as const)
        .map(method => jest.spyOn(adapter, method));
      Object.defineProperty(adapter, property, {
        get() {
          Object.assign(adapter, { providerFamily: 'T_BANK' });
          if (changeAuthority) Object.assign(serverAuthority, { providerFamily: 'T_BANK' });
          return property === 'capabilities' ? ['DIRECT_PAYMENT'] : true;
        },
      });

      expect(router.route(serverAuthority, 'DIRECT_PAYMENT')).toEqual({
        status: 'UNAVAILABLE',
        adapter: null,
        reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
      });
      for (const call of calls) expect(call).not.toHaveBeenCalled();
    },
  );

  const malformedProviderFamilies = [
    { name: 'unrecognized provider', providerFamily: 'OTHER_BANK' },
    { name: 'test-only provider identity', providerFamily: 'TEST_DOUBLE_A' },
    { name: 'empty identity', providerFamily: '' },
    { name: 'numeric identity', providerFamily: 42 },
    { name: 'missing identity', providerFamily: undefined },
  ];
  const adapterMethods = ['describeRequest', 'mapDispatchResponse', 'mapReceiptResponse'] as const;

  it.each(malformedProviderFamilies)('rejects registration of $name without invoking the adapter', ({ providerFamily }) => {
    const adapter = liveTestAdapter(providerFamily as BankProviderFamily, ['DIRECT_PAYMENT']);
    const calls = adapterMethods.map(method => jest.spyOn(adapter, method));

    expect(() => new BankCapabilityRouter([adapter])).toThrow('NO_ADAPTER_FOR_SERVER_HELD_PROVIDER');
    for (const call of calls) expect(call).not.toHaveBeenCalled();
  });

  it.each(malformedProviderFamilies)('does not route an authority with $name', ({ providerFamily }) => {
    const adapters = (['SBER', 'ALFA_BANK', 'T_BANK'] as const)
      .map(provider => liveTestAdapter(provider, ['DIRECT_PAYMENT']));
    const calls = adapters.flatMap(adapter => adapterMethods.map(method => jest.spyOn(adapter, method)));
    const testRouter = new BankCapabilityRouter(adapters);

    expect(testRouter.route(authority(providerFamily as BankProviderFamily), 'DIRECT_PAYMENT')).toEqual({
      status: 'UNAVAILABLE',
      adapter: null,
      reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
    });
    for (const call of calls) expect(call).not.toHaveBeenCalled();
  });

  it.each(['ALFA_BANK', 'T_BANK', 'OTHER_BANK'])('rejects an adapter changed from SBER to %s after registration', providerFamily => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
    const calls = adapterMethods.map(method => jest.spyOn(adapter, method));
    const testRouter = new BankCapabilityRouter([adapter]);
    Object.assign(adapter, { providerFamily });

    expect(testRouter.route(authority('SBER'), 'DIRECT_PAYMENT')).toEqual({
      status: 'UNAVAILABLE',
      adapter: null,
      reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
    });
    for (const call of calls) expect(call).not.toHaveBeenCalled();
  });

  it.each(['SBER', 'ALFA_BANK', 'T_BANK'] as const)('preserves matching %s test-double routing without invoking its methods', providerFamily => {
    const adapter = liveTestAdapter(providerFamily, ['DIRECT_PAYMENT']);
    const calls = adapterMethods.map(method => jest.spyOn(adapter, method));
    const testRouter = new BankCapabilityRouter([adapter]);
    const result = testRouter.route(authority(providerFamily), 'DIRECT_PAYMENT');

    expect(result).toMatchObject({
      status: 'READY_FOR_REAL_TRAFFIC',
      authority: { providerFamily },
    });
    expect(result.adapter).toBe(adapter);
    for (const call of calls) expect(call).not.toHaveBeenCalled();
  });
});
describe('bank routing immutable own-data boundary', () => {
  it('rejects authority Proxies before descriptor or value traps can upgrade readiness', () => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
    const target = authority('SBER', { credentialReadiness: 'EXPIRED_OR_REVOKED' });
    const descriptor = jest.fn((value: object, key: PropertyKey) => {
      Object.assign(target, { credentialReadiness: 'VERIFIED_CURRENT' });
      return Reflect.getOwnPropertyDescriptor(value, key);
    });
    const get = jest.fn((value: object, key: PropertyKey) => Reflect.get(value, key));
    const input = new Proxy<BankRoutingAuthority>(target, { getOwnPropertyDescriptor: descriptor, get });
    expect(new BankCapabilityRouter([adapter]).route(input, 'DIRECT_PAYMENT')).toMatchObject({ status: 'UNAVAILABLE' });
    expect(descriptor).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects adapter Proxies at registration before reflection traps run', () => {
    const descriptor = jest.fn((value: object, key: PropertyKey) => Reflect.getOwnPropertyDescriptor(value, key));
    const adapter = new Proxy<BankReferenceAdapter>(liveTestAdapter('SBER', ['DIRECT_PAYMENT']), { getOwnPropertyDescriptor: descriptor });
    expect(() => new BankCapabilityRouter([adapter])).toThrow('NO_ADAPTER_FOR_SERVER_HELD_PROVIDER');
    expect(descriptor).not.toHaveBeenCalled();
  });

  it('rejects revoked authority, adapter and registration-list Proxies without throwing from reflection', () => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
    const router = new BankCapabilityRouter([adapter]);
    const auth = Proxy.revocable(authority('SBER'), {}); auth.revoke();
    expect(router.route(auth.proxy, 'DIRECT_PAYMENT')).toMatchObject({ status: 'UNAVAILABLE' });
    const registration = Proxy.revocable(adapter, {}); registration.revoke();
    expect(() => new BankCapabilityRouter([registration.proxy])).toThrow('NO_ADAPTER_FOR_SERVER_HELD_PROVIDER');
    const list = Proxy.revocable([adapter], {}); list.revoke();
    expect(() => new BankCapabilityRouter(list.proxy)).toThrow('NO_ADAPTER_FOR_SERVER_HELD_PROVIDER');
  });

  it.each(['authority', 'adapter'] as const)('rejects a descriptor value containing a capability-array Proxy on %s', target => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
    const input = authority('SBER');
    const descriptor = jest.fn((value: object, key: PropertyKey) => Reflect.getOwnPropertyDescriptor(value, key));
    const get = jest.fn((value: object, key: PropertyKey) => Reflect.get(value, key));
    const values = new Proxy(['DIRECT_PAYMENT'], { getOwnPropertyDescriptor: descriptor, get });
    Object.defineProperty(target === 'authority' ? input : adapter,
      target === 'authority' ? 'authorizedBankCapabilities' : 'capabilities', { value: values });
    expect(new BankCapabilityRouter([adapter]).route(input, 'DIRECT_PAYMENT')).toMatchObject({
      status: target === 'authority' ? 'CONTRADICTORY' : 'UNAVAILABLE',
    });
    expect(descriptor).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it.each(['credentialReadiness', 'callbackTrustReadiness', 'maturity', 'evidenceMode',
    'mayCarryRealTraffic', 'productionEnvironmentConfirmed'] as const)(
    'does not execute a capability getter that upgrades %s before routing gates', field => {
      const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
      const input = authority('SBER', {
        [field]: field === 'maturity' ? 'CONTRACT_PENDING' : field === 'evidenceMode' ? 'CLIENT_HELD'
          : field.endsWith('Readiness') ? 'EXPIRED_OR_REVOKED' : false,
      } as Partial<BankRoutingAuthority>);
      const getter = jest.fn(() => {
        Object.assign(input, { [field]: field === 'maturity' ? 'LIVE_ACCEPTED' : field === 'evidenceMode' ? 'SERVER_HELD'
          : field.endsWith('Readiness') ? 'VERIFIED_CURRENT' : true });
        return ['DIRECT_PAYMENT'];
      });
      Object.defineProperty(adapter, 'capabilities', { get: getter });
      expect(new BankCapabilityRouter([adapter]).route(input, 'DIRECT_PAYMENT')).toMatchObject({ status: 'UNAVAILABLE' });
      expect(getter).not.toHaveBeenCalled();
    },
  );

  it('does not invoke authority admission getters or accept their attempted snapshot reentry', () => {
    const input = authority('SBER');
    const getter = jest.fn(() => {
      Object.assign(input, { callbackTrustReadiness: 'VERIFIED_CURRENT' });
      return 'VERIFIED_CURRENT';
    });
    Object.defineProperty(input, 'credentialReadiness', { get: getter });
    expect(new BankCapabilityRouter([liveTestAdapter('SBER', ['DIRECT_PAYMENT'])]).route(input, 'DIRECT_PAYMENT'))
      .toMatchObject({ status: 'CONTRADICTORY', reason: 'INCOMPLETE_SERVER_HELD_BINDING_AUTHORITY' });
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(['authority', 'adapter'] as const)('ignores injected array every/includes/iterator methods on %s', target => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']);
    const input = authority('SBER');
    const values = ['DIRECT_PAYMENT'] as BankCapability[];
    const every = jest.fn(() => true); const includes = jest.fn(() => true);
    const iterator = jest.fn(function* () { yield 'BILLING'; });
    Object.defineProperties(values, { every: { value: every }, includes: { value: includes }, [Symbol.iterator]: { value: iterator } });
    Object.assign(target === 'authority' ? input : adapter,
      { [target === 'authority' ? 'authorizedBankCapabilities' : 'capabilities']: values });
    expect(new BankCapabilityRouter([adapter]).route(input, 'DIRECT_PAYMENT')).toMatchObject({ status: 'READY_FOR_REAL_TRAFFIC' });
    expect(every).not.toHaveBeenCalled(); expect(includes).not.toHaveBeenCalled(); expect(iterator).not.toHaveBeenCalled();
  });

  it.each(['authority', 'adapter'] as const)('rejects an unknown indexed capability even when %s array methods lie', target => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']); const input = authority('SBER');
    const values = ['UNAUTHORIZED_CAPABILITY'];
    Object.defineProperties(values, { every: { value: () => true }, includes: { value: () => true } });
    Object.assign(target === 'authority' ? input : adapter,
      { [target === 'authority' ? 'authorizedBankCapabilities' : 'capabilities']: values });
    expect(new BankCapabilityRouter([adapter]).route(input, 'DIRECT_PAYMENT')).toMatchObject({
      status: target === 'authority' ? 'CONTRADICTORY' : 'UNAVAILABLE',
    });
  });

  it.each(['authority', 'adapter'] as const)('rejects sparse capability arrays on %s', target => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']); const input = authority('SBER');
    const values = ['DIRECT_PAYMENT']; values.length = 2;
    Object.assign(target === 'authority' ? input : adapter,
      { [target === 'authority' ? 'authorizedBankCapabilities' : 'capabilities']: values });
    expect(new BankCapabilityRouter([adapter]).route(input, 'DIRECT_PAYMENT')).toMatchObject({
      status: target === 'authority' ? 'CONTRADICTORY' : 'UNAVAILABLE',
    });
  });

  it.each(['authority', 'adapter'] as const)('rejects indexed capability getters on %s without executing them', target => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']); const input = authority('SBER');
    const values = ['DIRECT_PAYMENT']; const getter = jest.fn(() => 'DIRECT_PAYMENT');
    Object.defineProperty(values, '0', { get: getter });
    Object.assign(target === 'authority' ? input : adapter,
      { [target === 'authority' ? 'authorizedBankCapabilities' : 'capabilities']: values });
    expect(new BankCapabilityRouter([adapter]).route(input, 'DIRECT_PAYMENT')).toMatchObject({
      status: target === 'authority' ? 'CONTRADICTORY' : 'UNAVAILABLE',
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it('returns an immutable detached authority and capability snapshot', () => {
    const input = authority('SBER'); const originalValues = input.authorizedBankCapabilities as BankCapability[];
    const result = new BankCapabilityRouter([liveTestAdapter('SBER', ['DIRECT_PAYMENT'])]).route(input, 'DIRECT_PAYMENT');
    expect(result.status).toBe('READY_FOR_REAL_TRAFFIC');
    if (result.status !== 'READY_FOR_REAL_TRAFFIC') throw new Error('test fixture should route');
    expect(result.authority === input).toBe(false);
    expect(result.authority.authorizedBankCapabilities === originalValues).toBe(false);
    expect(Object.isFrozen(result.authority)).toBe(true);
    expect(Object.isFrozen(result.authority.authorizedBankCapabilities)).toBe(true);
    Object.assign(input, { providerId: 'changed', credentialReadiness: 'EXPIRED_OR_REVOKED' });
    originalValues[0] = 'BILLING';
    expect(result.authority.providerId).toBe('provider-1');
    expect(result.authority.credentialReadiness).toBe('VERIFIED_CURRENT');
    expect(result.authority.authorizedBankCapabilities[0]).toBe('SAFE_DEAL_RESERVE_RELEASE');
  });

  it('does not coerce a Proxy passed as the required capability', () => {
    const getter = jest.fn(() => { throw new Error('capability coercion must not run'); });
    const invalid = new Proxy({}, { get: getter }) as unknown as BankCapability;
    expect(new BankCapabilityRouter([liveTestAdapter('SBER', ['DIRECT_PAYMENT'])]).route(authority('SBER'), invalid))
      .toMatchObject({ status: 'UNSUPPORTED', reason: 'INVALID_REQUIRED_BANK_CAPABILITY' });
    expect(getter).not.toHaveBeenCalled();
  });

  it('does not consume a registration-array iterator that substitutes another provider', () => {
    const adapter = liveTestAdapter('SBER', ['DIRECT_PAYMENT']); const values = [adapter];
    const iterator = jest.fn(function* () { yield liveTestAdapter('T_BANK', ['DIRECT_PAYMENT']); });
    Object.defineProperty(values, Symbol.iterator, { value: iterator });
    expect(new BankCapabilityRouter(values).route(authority('SBER'), 'DIRECT_PAYMENT')).toMatchObject({ status: 'READY_FOR_REAL_TRAFFIC' });
    expect(iterator).not.toHaveBeenCalled();
  });
});
