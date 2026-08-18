import { describe, expect, it } from 'vitest';
import {
  CONNECTION_CENTER_REQUIRED_BUT_NOT_MODELED,
  isConnectionAttestationDto,
  isConnectionStateDto,
  presentConnection,
  type ConnectionAttestationDto,
  type ConnectionStateDto,
} from '../../app/platform-v7/settings/connections/connection-center.presentation';

const connection = (
  overrides: Partial<ConnectionStateDto> = {},
): ConnectionStateDto => ({
  kind: 'ONE_C',
  maturity: 'NOT_ATTESTED',
  missing: [
    'ADAPTER_NOT_IMPLEMENTED',
    'ENDPOINT_NOT_CONFIGURED',
    'VENDOR_CREDENTIALS_NOT_ISSUED',
  ],
  mayCarryRealTraffic: false,
  ...overrides,
});

const attestation = (
  overrides: Partial<ConnectionAttestationDto> = {},
): ConnectionAttestationDto => ({
  id: 'subject-1',
  connectionKind: 'ONE_C',
  state: {
    attested: false,
    awaiting: ['OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS'],
    rejected: [],
  },
  ...overrides,
});

describe('Connection Center presentation contract', () => {
  it('accepts only structurally valid server rows at the browser boundary', () => {
    expect(isConnectionStateDto(connection())).toBe(true);
    expect(isConnectionAttestationDto(attestation())).toBe(true);
    expect(
      isConnectionStateDto({
        kind: 'ONE_C',
        maturity: 'NOT_ATTESTED',
        missing: 'ADAPTER_NOT_IMPLEMENTED',
        mayCarryRealTraffic: false,
      }),
    ).toBe(false);
    expect(
      isConnectionAttestationDto({
        id: 'subject-1',
        connectionKind: 'ONE_C',
        state: { attested: 'yes', awaiting: [], rejected: [] },
      }),
    ).toBe(false);
  });

  it('does not call NOT_ATTESTED connected or live', () => {
    const view = presentConnection(connection(), []);
    expect(view.status).toBe('Ещё не готово');
    expect(view.statusTone).toBe('neutral');
    expect(view.realTrafficConfirmed).toBe(false);
    expect(view.detail.toLowerCase()).not.toContain('подключено');
  });

  it('does not call ADAPTER_READY or TEST real exchange', () => {
    for (const maturity of ['ADAPTER_READY', 'TEST'] as const) {
      const view = presentConnection(
        connection({ maturity, missing: ['LIVE_RECEIPT_NOT_OBTAINED'] }),
        [],
      );
      expect(view.realTrafficConfirmed).toBe(false);
      expect(view.statusTone).toBe('warning');
      expect(view.detail).toContain('реальный обмен');
      expect(view.detail).toMatch(/не (подтвержд|доказ)/u);
    }
  });

  it('recognizes real exchange only from consistent CONFIRMED_LIVE evidence', () => {
    const view = presentConnection(
      connection({
        maturity: 'CONFIRMED_LIVE',
        missing: [],
        mayCarryRealTraffic: true,
      }),
      [],
    );
    expect(view.realTrafficConfirmed).toBe(true);
    expect(view.status).toBe('Реальный обмен подтверждён');
    expect(view.statusTone).toBe('positive');
  });

  it('fails closed if mayCarryRealTraffic contradicts a lower maturity', () => {
    const view = presentConnection(
      connection({ maturity: 'TEST', mayCarryRealTraffic: true }),
      [],
    );
    expect(view.realTrafficConfirmed).toBe(false);
    expect(view.statusTone).toBe('danger');
    expect(view.status).toBe('Требуется проверка статуса');
  });

  it('fails closed on an unknown server maturity', () => {
    const view = presentConnection(connection({ maturity: 'GREEN' }), []);
    expect(view.realTrafficConfirmed).toBe(false);
    expect(view.statusTone).toBe('danger');
    expect(view.status).toBe('Статус не распознан');
  });

  it('translates server prerequisite codes into human copy', () => {
    const view = presentConnection(connection(), []);
    expect(view.missing).toHaveLength(3);
    expect(view.missing.join(' ')).not.toContain('ADAPTER_NOT_IMPLEMENTED');
    expect(view.missing.join(' ')).not.toContain('ENDPOINT_NOT_CONFIGURED');
    expect(view.missing.join(' ')).not.toContain('VENDOR_CREDENTIALS_NOT_ISSUED');
  });

  it('does not expose a rejected attestation as ready', () => {
    const view = presentConnection(
      connection(),
      [
        attestation({
          state: {
            attested: false,
            awaiting: [],
            rejected: ['SECURITY'],
          },
        }),
      ],
    );
    expect(view.attestation).toContain('отклонённая');
    expect(view.attestation).toContain('не может считаться готовым');
  });

  it('shows attestation as passed only from server attested=true', () => {
    const view = presentConnection(
      connection(),
      [
        attestation({
          state: { attested: true, awaiting: [], rejected: [] },
        }),
      ],
    );
    expect(view.attestation).toContain('прошедшее все обязательные');
  });

  it('keeps connect actions visibly disabled with a reason', () => {
    const oneC = presentConnection(connection(), []);
    expect(oneC.actionLabel).toBe('Подключить 1С');
    expect(oneC.actionDisabledReason).toMatch(/^Недоступно:/u);

    const edo = presentConnection(
      connection({ kind: 'EDO' }),
      [],
    );
    expect(edo.actionLabel).toBe('Подключить ЭДО');
    expect(edo.actionDisabledReason).toMatch(/^Недоступно:/u);
  });

  it('does not invent FGIS or transport connection state while backend lacks those models', () => {
    expect(CONNECTION_CENTER_REQUIRED_BUT_NOT_MODELED).toEqual([
      {
        title: 'ФГИС «Зерно»',
        detail: 'Платформа пока не показывает подтверждённый статус этого подключения на этом экране.',
      },
      {
        title: 'Перевозочные документы',
        detail: 'Платформа пока не показывает подтверждённый статус этого подключения на этом экране.',
      },
    ]);
  });
});
