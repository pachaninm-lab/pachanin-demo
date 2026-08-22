import {
  IntegrationSafeDiagnosticsError,
  buildIntegrationSafeDiagnosticsPreview,
  isExactSafeDiagnosticsPreview,
} from './integration-safe-diagnostics.policy';

describe('integration safe diagnostics', () => {
  it('builds exactly the five safe metadata fields from §53', () => {
    const preview = buildIntegrationSafeDiagnosticsPreview({
      connectorVersion: '1.4.2',
      configurationVersion: '3.0.190.12',
      heartbeatAt: new Date('2026-08-18T18:00:00Z'),
      pendingCount: 7,
      safeErrorCodes: ['ONE_C_OFFLINE', 'MAPPING_REQUIRED'],
    });

    expect(preview).toEqual({
      connectorVersion: '1.4.2',
      configurationVersion: '3.0.190.12',
      heartbeatAt: '2026-08-18T18:00:00.000Z',
      pendingCount: 7,
      safeErrorCodes: ['ONE_C_OFFLINE', 'MAPPING_REQUIRED'],
    });
    expect(Object.keys(preview).sort()).toEqual([
      'configurationVersion',
      'connectorVersion',
      'heartbeatAt',
      'pendingCount',
      'safeErrorCodes',
    ]);
  });

  it('does not accept secret or arbitrary diagnostic fields in the exact preview', () => {
    for (const extra of [
      { password: 'secret' },
      { privateKey: 'secret' },
      { oauthToken: 'secret' },
      { clientSecret: 'secret' },
      { endpoint: 'https://internal.example' },
      { databaseDump: '...' },
      { payload: { arbitrary: true } },
    ]) {
      expect(
        isExactSafeDiagnosticsPreview({
          connectorVersion: '1.0.0',
          configurationVersion: '3.0',
          heartbeatAt: null,
          pendingCount: 0,
          safeErrorCodes: [],
          ...extra,
        }),
      ).toBe(false);
    }
  });

  it('allows no heartbeat without inventing an offline timestamp', () => {
    const preview = buildIntegrationSafeDiagnosticsPreview({
      connectorVersion: '1.0.0',
      configurationVersion: '3.0',
      heartbeatAt: null,
      pendingCount: 0,
      safeErrorCodes: [],
    });
    expect(preview.heartbeatAt).toBeNull();
    expect(isExactSafeDiagnosticsPreview(preview)).toBe(true);
  });

  it('bounds pendingCount so diagnostics cannot be abused as an arbitrary numeric channel', () => {
    expect(() =>
      buildIntegrationSafeDiagnosticsPreview({
        connectorVersion: '1.0.0',
        configurationVersion: '3.0',
        heartbeatAt: null,
        pendingCount: -1,
        safeErrorCodes: [],
      }),
    ).toThrow('pendingCount');

    expect(() =>
      buildIntegrationSafeDiagnosticsPreview({
        connectorVersion: '1.0.0',
        configurationVersion: '3.0',
        heartbeatAt: null,
        pendingCount: Number.MAX_SAFE_INTEGER,
        safeErrorCodes: [],
      }),
    ).toThrow(IntegrationSafeDiagnosticsError);
  });

  it('accepts only bounded machine-safe error codes, never free-text logs', () => {
    expect(() =>
      buildIntegrationSafeDiagnosticsPreview({
        connectorVersion: '1.0.0',
        configurationVersion: '3.0',
        heartbeatAt: null,
        pendingCount: 1,
        safeErrorCodes: ['ONE_C_OFFLINE', 'token=very-secret-value'],
      }),
    ).toThrow('unsafe error code');
  });

  it('deduplicates safe codes instead of making support noise look like more incidents', () => {
    const preview = buildIntegrationSafeDiagnosticsPreview({
      connectorVersion: '1.0.0',
      configurationVersion: '3.0',
      heartbeatAt: null,
      pendingCount: 3,
      safeErrorCodes: ['ONE_C_OFFLINE', 'ONE_C_OFFLINE'],
    });
    expect(preview.safeErrorCodes).toEqual(['ONE_C_OFFLINE']);
  });

  it('fails closed on malformed heartbeat', () => {
    expect(() =>
      buildIntegrationSafeDiagnosticsPreview({
        connectorVersion: '1.0.0',
        configurationVersion: '3.0',
        heartbeatAt: new Date(Number.NaN),
        pendingCount: 0,
        safeErrorCodes: [],
      }),
    ).toThrow('heartbeatAt must be a valid date');
  });
});
