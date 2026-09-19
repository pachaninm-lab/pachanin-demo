import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_EXTERNAL_CONFIRMATION_BLOCKERS,
  PLATFORM_V7_INTEGRATION_CONTRACTS,
  canPlatformV7IntegrationInfluenceMoney,
  canPlatformV7ShowExternalConfirmation,
  getPlatformV7IntegrationReadinessSummary,
} from '@/lib/platform-v7/integration-readiness';

describe('platform-v7 integration readiness contracts', () => {
  it('covers every required external system', () => {
    expect(PLATFORM_V7_INTEGRATION_CONTRACTS.map((contract) => contract.kind)).toEqual([
      'fgis_grain',
      'sdiz',
      'edo',
      'gis_epd',
      'bank',
      'gps',
      'laboratory',
      'counterparty_check',
    ]);
  });

  it('blocks external confirmations by default before real connections exist', () => {
    expect(PLATFORM_V7_EXTERNAL_CONFIRMATION_BLOCKERS).toHaveLength(8);

    for (const contract of PLATFORM_V7_INTEGRATION_CONTRACTS) {
      expect(canPlatformV7ShowExternalConfirmation(contract.kind)).toBe(false);
    }
  });

  it('keeps money-impacting systems explicit', () => {
    expect(canPlatformV7IntegrationInfluenceMoney('sdiz')).toBe(true);
    expect(canPlatformV7IntegrationInfluenceMoney('edo')).toBe(true);
    expect(canPlatformV7IntegrationInfluenceMoney('bank')).toBe(true);
    expect(canPlatformV7IntegrationInfluenceMoney('laboratory')).toBe(true);
    expect(canPlatformV7IntegrationInfluenceMoney('counterparty_check')).toBe(true);
    expect(canPlatformV7IntegrationInfluenceMoney('fgis_grain')).toBe(false);
    expect(canPlatformV7IntegrationInfluenceMoney('gps')).toBe(false);
  });

  it('summarizes readiness as pre-integration until all external confirmations are allowed', () => {
    expect(getPlatformV7IntegrationReadinessSummary()).toMatchObject({
      total: 8,
      connected: 0,
      externalConfirmationAllowed: false,
      mode: 'pre_integration',
    });
  });
});
