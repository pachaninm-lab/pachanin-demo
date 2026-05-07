import { describe, expect, it } from 'vitest';
import {
  canPlatformV7ConnectorConfirmExternalEvent,
  doesPlatformV7ConnectorNeedFallback,
  isPlatformV7ConnectorBlocking,
  isPlatformV7ConnectorLive,
  isPlatformV7ConnectorTestMode,
  type PlatformV7ConnectorState,
} from '@/lib/platform-v7/connector-model';

const connector: PlatformV7ConnectorState = {
  id: 'connector-1',
  name: 'ФГИС Зерно',
  mode: 'test_mode',
  status: 'manual_review',
  ownerRole: 'operator',
  blocks: 'shipment',
  fallback: 'manual_check',
};

describe('platform-v7 connector model', () => {
  it('separates test mode from live external confirmation', () => {
    expect(isPlatformV7ConnectorTestMode(connector)).toBe(true);
    expect(isPlatformV7ConnectorLive(connector)).toBe(false);
    expect(canPlatformV7ConnectorConfirmExternalEvent(connector)).toBe(false);
  });

  it('requires live mode, ok status, external id and last event for external confirmation', () => {
    expect(
      canPlatformV7ConnectorConfirmExternalEvent({
        ...connector,
        mode: 'live_connection_active',
        status: 'ok',
        externalId: 'EXT-1',
        lastEventAt: '2026-05-06T10:00:00.000Z',
      })
    ).toBe(true);
    expect(canPlatformV7ConnectorConfirmExternalEvent({ ...connector, mode: 'live_connection_active', status: 'ok' })).toBe(false);
  });

  it('marks connector blocking only when it blocks a gate and status is blocking', () => {
    expect(isPlatformV7ConnectorBlocking(connector)).toBe(true);
    expect(isPlatformV7ConnectorBlocking({ ...connector, blocks: 'none' })).toBe(false);
    expect(isPlatformV7ConnectorBlocking({ ...connector, status: 'degraded' })).toBe(false);
  });

  it('requires fallback when connector is not ok and fallback exists', () => {
    expect(doesPlatformV7ConnectorNeedFallback(connector)).toBe(true);
    expect(doesPlatformV7ConnectorNeedFallback({ ...connector, status: 'ok' })).toBe(false);
    expect(doesPlatformV7ConnectorNeedFallback({ ...connector, fallback: 'none' })).toBe(false);
  });
});
