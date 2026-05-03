import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_PROVIDER_REGISTRY,
  assertProviderLiveClaimIsAllowed,
  canClaimProviderLive,
  getProviderPublicFactLabel,
  providerBlocksRelease,
  type IntegrationEvent,
} from '@/lib/platform-v7/integrations/providerRegistry';

describe('platform-v7 provider registry', () => {
  it('keeps providers as fact sources without unverified live claims', () => {
    const providers = Object.values(PLATFORM_V7_PROVIDER_REGISTRY);

    expect(providers.length).toBeGreaterThan(0);

    for (const provider of providers) {
      expect(provider.publicLabel).toContain('·');
      expect(provider.nextLiveStep.length).toBeGreaterThan(10);
      expect(canClaimProviderLive(provider)).toBe(false);
      expect(() => assertProviderLiveClaimIsAllowed(provider)).toThrow(/Боевой статус провайдера/);
    }
  });

  it('requires full evidence before a provider can be marked as live', () => {
    const liveCandidate = {
      ...PLATFORM_V7_PROVIDER_REGISTRY.sber_safe_deals,
      mode: 'live' as const,
      connectionStatus: 'live_connected' as const,
      legalClaim: 'live_connected' as const,
      hasContract: true,
      hasCredentials: true,
      hasCallbacks: true,
      confirmedOperationsCount: 1,
    };

    expect(canClaimProviderLive(liveCandidate)).toBe(true);
    expect(() => assertProviderLiveClaimIsAllowed(liveCandidate)).not.toThrow();
  });

  it('returns public source labels for deal facts', () => {
    expect(getProviderPublicFactLabel('fgis_grain')).toBe('ФГИС · ручная проверка');
    expect(getProviderPublicFactLabel('sber_safe_deals')).toBe('Сбер · тестовый контур');
  });

  it('keeps money release blocked while provider money event is not successful', () => {
    const baseEvent: IntegrationEvent = {
      id: 'EVT-TEST-1',
      dealId: 'DL-TEST',
      provider: 'sber_safe_deals',
      providerDisplayName: 'Сбер API / Безопасные сделки',
      providerMode: 'test',
      providerHealth: 'manual_review',
      objectType: 'money',
      eventType: 'reserve_status',
      status: 'pending',
      userMessage: 'Резерв ожидает подтверждения банка.',
      operatorMessage: 'Проверить ответ банка перед выпуском денег.',
      affectsMoney: true,
      blocksRelease: false,
      evidenceIds: [],
      createdAt: '2026-05-03T10:00:00.000Z',
      actor: 'bank-adapter',
      rawPayloadHiddenFromPublicUi: { requestId: 'hidden' },
    };

    expect(providerBlocksRelease(baseEvent)).toBe(true);
    expect(providerBlocksRelease({ ...baseEvent, status: 'success' })).toBe(false);
    expect(providerBlocksRelease({ ...baseEvent, status: 'success', blocksRelease: true })).toBe(true);
  });
});
