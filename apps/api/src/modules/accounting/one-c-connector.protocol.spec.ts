import {
  ONE_C_COMMANDS,
  ONE_C_CONNECTOR_API,
  ONE_C_PROTOCOL_VERSION,
  OneCBindingStatus,
  OneCCommand,
  OneCCompatibilityProfile,
  OneCPostingMode,
  OneCProtocolValidationError,
  OneCSyncState,
  canTransitionOneCSyncState,
  createOneCPairingChallenge,
  effectiveOneCPostingMode,
  isOneCCommand,
  oneCFailureState,
  validateOneCBinding,
  validateOneCDiscovery,
  validateOneCJob,
  verifyOneCPairingCode,
  type OneCConnectorJob,
  type OneCOrganizationBinding,
  type OneCSelfDiscovery,
} from './one-c-connector.protocol';

const discovery = (
  overrides: Partial<OneCSelfDiscovery> = {},
): OneCSelfDiscovery => ({
  platformVersion: '2026.08',
  configurationName: 'Бухгалтерия предприятия',
  configurationVersion: '3.0.190.12',
  databaseInstanceId: 'db-farm-01',
  organizations: [
    {
      guid: 'org-guid-farm',
      inn: '7701234567',
      kpp: '770101001',
      name: 'ООО Ферма',
    },
    {
      guid: 'org-guid-trader',
      inn: '7801234567',
      kpp: '780101001',
      name: 'ООО Трейдер',
    },
  ],
  capabilities: [...ONE_C_COMMANDS],
  connectorVersion: '1.0.0',
  protocolVersion: ONE_C_PROTOCOL_VERSION,
  ...overrides,
});

const binding = (
  overrides: Partial<OneCOrganizationBinding> = {},
): OneCOrganizationBinding => ({
  platformOrganizationId: 'platform-org-farm',
  oneCOrganizationGuid: 'org-guid-farm',
  connectorInstallationId: 'install-1',
  connectionId: 'connection-1',
  capabilityProfile: [
    OneCCommand.UPSERT_COUNTERPARTY,
    OneCCommand.CREATE_SALES_DRAFT,
    OneCCommand.GET_DOCUMENT_STATUS,
  ],
  compatibilityProfile: OneCCompatibilityProfile.BP_3,
  status: OneCBindingStatus.ACTIVE,
  ...overrides,
});

const job = (
  command: OneCCommand,
  payload: Readonly<Record<string, unknown>>,
): OneCConnectorJob => ({
  id: 'job-1',
  command,
  payload,
  idempotencyKey: 'idem-1',
  correlationId: 'corr-1',
  organizationId: 'platform-org-farm',
  connectionId: 'connection-1',
  revision: 1,
  attempt: 0,
});

describe('1C connector protocol', () => {
  it('exposes exactly the seven commands from the execution contract', () => {
    expect(ONE_C_COMMANDS).toEqual([
      'UPSERT_COUNTERPARTY',
      'CREATE_SALES_DRAFT',
      'CREATE_PURCHASE_DRAFT',
      'CREATE_CORRECTION_DRAFT',
      'GET_DOCUMENT_STATUS',
      'PUSH_PAYMENT_STATUS',
      'GET_REFERENCE_CANDIDATES',
    ]);
  });

  it('does not contain arbitrary SQL, code, dump or unrestricted-read commands', () => {
    const vocabulary = ONE_C_COMMANDS.join(' ').toUpperCase();
    for (const forbidden of ['SQL', 'EXECUTE_CODE', 'DUMP', 'GET_ALL_RECORDS']) {
      expect(vocabulary).not.toContain(forbidden);
    }
  });

  it('pins the complete /connector/v1 route vocabulary', () => {
    expect(Object.values(ONE_C_CONNECTOR_API)).toEqual([
      'POST /connector/v1/pair',
      'POST /connector/v1/heartbeat',
      'GET /connector/v1/jobs',
      'POST /connector/v1/jobs/:id/ack',
      'POST /connector/v1/jobs/:id/result',
      'POST /connector/v1/jobs/:id/fail',
      'POST /connector/v1/events',
      'POST /connector/v1/mappings',
    ]);
  });

  it('refuses an unknown command instead of treating it as extensible input', () => {
    expect(isOneCCommand('RUN_SQL')).toBe(false);
  });

  it('accepts a database that exposes more than one legal entity', () => {
    expect(() => validateOneCDiscovery(discovery())).not.toThrow();
  });

  it('refuses a discovery report with a mismatched protocol version', () => {
    expect(() =>
      validateOneCDiscovery(discovery({ protocolVersion: '999' })),
    ).toThrow('protocolVersion must be 1');
  });

  it('refuses duplicate organization GUIDs inside one database', () => {
    const source = discovery();
    expect(() =>
      validateOneCDiscovery({
        ...source,
        organizations: [source.organizations[0], source.organizations[0]],
      }),
    ).toThrow('organization GUIDs must be unique');
  });

  it('refuses a capability that is not one of the seven typed commands', () => {
    const source = discovery();
    expect(() =>
      validateOneCDiscovery({
        ...source,
        capabilities: [...source.capabilities, 'RUN_SQL' as OneCCommand],
      }),
    ).toThrow('unsupported connector capability');
  });

  it('binds one platform organization to an explicitly discovered 1C GUID', () => {
    expect(() => validateOneCBinding(binding(), discovery())).not.toThrow();
  });

  it('does not let a binding claim another legal entity implicitly', () => {
    expect(() =>
      validateOneCBinding(
        binding({ oneCOrganizationGuid: 'not-discovered' }),
        discovery(),
      ),
    ).toThrow('bound 1C organization GUID was not discovered');
  });

  it('does not let a binding enable a command the connector did not advertise', () => {
    const source = discovery({ capabilities: [OneCCommand.GET_DOCUMENT_STATUS] });
    expect(() =>
      validateOneCBinding(
        binding({ capabilityProfile: [OneCCommand.CREATE_SALES_DRAFT] }),
        source,
      ),
    ).toThrow('binding capability was not advertised');
  });

  it('keeps unsupported compatibility explicit as UNKNOWN', () => {
    expect(
      binding({ compatibilityProfile: OneCCompatibilityProfile.UNKNOWN })
        .compatibilityProfile,
    ).toBe('UNKNOWN');
  });

  it('accepts a sales draft with only the typed payload', () => {
    expect(() =>
      validateOneCJob(
        job(OneCCommand.CREATE_SALES_DRAFT, {
          documentId: 'doc-1',
          documentVersionId: 'ver-1',
          documentType: 'UPD',
          documentNumber: 'УПД-1',
          payloadHash: 'a'.repeat(64),
          counterpartyInn: '7701234567',
          formatRevision: 'UPD@1',
        }),
      ),
    ).not.toThrow();
  });

  it('refuses an unknown field even beside an otherwise valid command', () => {
    expect(() =>
      validateOneCJob(
        job(OneCCommand.CREATE_SALES_DRAFT, {
          documentId: 'doc-1',
          documentVersionId: 'ver-1',
          documentType: 'UPD',
          documentNumber: 'УПД-1',
          payloadHash: 'a'.repeat(64),
          counterpartyInn: '7701234567',
          formatRevision: 'UPD@1',
          sql: 'DROP TABLE everything',
        }),
      ),
    ).toThrow('payload field is not allowed');
  });

  it('refuses a draft without the version that makes it idempotent', () => {
    expect(() =>
      validateOneCJob(
        job(OneCCommand.CREATE_PURCHASE_DRAFT, {
          documentId: 'doc-1',
          documentType: 'UPD',
          documentNumber: 'УПД-1',
          payloadHash: 'a'.repeat(64),
          counterpartyInn: '7701234567',
          formatRevision: 'UPD@1',
        }),
      ),
    ).toThrow('documentVersionId');
  });

  it('keeps payment money as a whole minor-unit string', () => {
    expect(() =>
      validateOneCJob(
        job(OneCCommand.PUSH_PAYMENT_STATUS, {
          dealId: 'deal-1',
          paymentId: 'payment-1',
          status: 'RECEIVED',
          amountKopecks: '142000000',
          currency: 'RUB',
          paidAt: '2026-08-18T12:00:00Z',
        }),
      ),
    ).not.toThrow();

    expect(() =>
      validateOneCJob(
        job(OneCCommand.PUSH_PAYMENT_STATUS, {
          dealId: 'deal-1',
          paymentId: 'payment-1',
          status: 'RECEIVED',
          amountKopecks: 1420000.5,
          currency: 'RUB',
          paidAt: '2026-08-18T12:00:00Z',
        }),
      ),
    ).toThrow('amountKopecks must be a whole number string');
  });

  it('bounds reference discovery instead of exposing an unrestricted read', () => {
    expect(() =>
      validateOneCJob(
        job(OneCCommand.GET_REFERENCE_CANDIDATES, {
          referenceType: 'COUNTERPARTY',
          query: 'Ромашка',
          limit: 20,
        }),
      ),
    ).not.toThrow();

    expect(() =>
      validateOneCJob(
        job(OneCCommand.GET_REFERENCE_CANDIDATES, {
          referenceType: 'COUNTERPARTY',
          query: 'Ромашка',
          limit: 10000,
        }),
      ),
    ).toThrow('limit must be an integer from 1 to 100');
  });

  it('creates a high-entropy pairing code and stores only a salted hash', () => {
    const challenge = createOneCPairingChallenge(
      new Date('2026-08-18T12:00:00Z'),
      10 * 60 * 1000,
    );

    expect(challenge.code.length).toBeGreaterThanOrEqual(16);
    expect(challenge.record.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(challenge.record.codeHash).not.toContain(challenge.code);
    expect(challenge.record.salt).not.toBe('');
  });

  it('accepts the pairing code only before expiry and before consumption', () => {
    const now = new Date('2026-08-18T12:00:00Z');
    const challenge = createOneCPairingChallenge(now, 60_000);

    expect(
      verifyOneCPairingCode(
        challenge.record,
        challenge.code,
        new Date('2026-08-18T12:00:30Z'),
      ),
    ).toBe(true);

    expect(
      verifyOneCPairingCode(
        challenge.record,
        challenge.code,
        new Date('2026-08-18T12:01:00Z'),
      ),
    ).toBe(false);

    expect(
      verifyOneCPairingCode(
        { ...challenge.record, consumedAt: new Date('2026-08-18T12:00:10Z') },
        challenge.code,
        new Date('2026-08-18T12:00:20Z'),
      ),
    ).toBe(false);
  });

  it('refuses a wrong pairing secret without leaking equality details', () => {
    const challenge = createOneCPairingChallenge();
    expect(verifyOneCPairingCode(challenge.record, 'x'.repeat(32))).toBe(false);
  });

  it('bounds pairing TTL so a stale bootstrap secret cannot live forever', () => {
    expect(() => createOneCPairingChallenge(new Date(), 2 * 60 * 60 * 1000)).toThrow(
      OneCProtocolValidationError,
    );
  });

  it('defaults to CREATE_DRAFT even when AUTO_POST was requested', () => {
    expect(
      effectiveOneCPostingMode(
        OneCPostingMode.AUTO_POST,
        'install-1',
        '3.0.190.12',
        null,
      ),
    ).toBe(OneCPostingMode.CREATE_DRAFT);
  });

  it('enables AUTO_POST only for separately accepted exact installation and configuration', () => {
    const accepted = {
      connectorInstallationId: 'install-1',
      configurationVersion: '3.0.190.12',
      acceptedAt: new Date(),
    };

    expect(
      effectiveOneCPostingMode(
        OneCPostingMode.AUTO_POST,
        'install-1',
        '3.0.190.12',
        accepted,
      ),
    ).toBe(OneCPostingMode.AUTO_POST);

    expect(
      effectiveOneCPostingMode(
        OneCPostingMode.AUTO_POST,
        'install-2',
        '3.0.190.12',
        accepted,
      ),
    ).toBe(OneCPostingMode.CREATE_DRAFT);
  });

  it('maps timeout and network ambiguity to UNKNOWN, never success', () => {
    expect(oneCFailureState('TIMEOUT')).toBe(OneCSyncState.UNKNOWN);
    expect(oneCFailureState('NETWORK')).toBe(OneCSyncState.UNKNOWN);
    expect(oneCFailureState('AMBIGUOUS_RESULT')).toBe(OneCSyncState.UNKNOWN);
    expect(oneCFailureState('BUSINESS_REJECTION')).toBe(OneCSyncState.REJECTED);
  });

  it('requires reconciliation before retrying an UNKNOWN result', () => {
    expect(
      canTransitionOneCSyncState(OneCSyncState.UNKNOWN, OneCSyncState.QUEUED),
    ).toBe(false);
    expect(
      canTransitionOneCSyncState(
        OneCSyncState.UNKNOWN,
        OneCSyncState.RECONCILIATION_REQUIRED,
      ),
    ).toBe(true);
    expect(
      canTransitionOneCSyncState(
        OneCSyncState.RECONCILIATION_REQUIRED,
        OneCSyncState.QUEUED,
      ),
    ).toBe(true);
  });

  it('does not let a terminal POSTED or REJECTED job drift into another state', () => {
    expect(
      canTransitionOneCSyncState(OneCSyncState.POSTED, OneCSyncState.QUEUED),
    ).toBe(false);
    expect(
      canTransitionOneCSyncState(OneCSyncState.REJECTED, OneCSyncState.QUEUED),
    ).toBe(false);
  });
});
