import { describe, expect, it } from 'vitest';
import type { PlatformV7BankPartnerReadinessInput } from '@/lib/platform-v7/bank-partner-readiness';
import {
  platformV7BankPartnerReadinessBlockers,
  platformV7BankPartnerReadinessModel,
  platformV7BankPartnerReadinessNextAction,
  platformV7BankPartnerReadinessPercent,
  platformV7BankPartnerReadinessTone,
} from '@/lib/platform-v7/bank-partner-readiness';

const liveReady: PlatformV7BankPartnerReadinessInput = {
  partner: 'Сбер',
  stage: 'live',
  connectors: {
    safe_deals: true,
    sberbusiness_id: true,
    webhooks: true,
    nominal_account: true,
    credit_widget: true,
  },
  contractSigned: true,
  credentialsReady: true,
  nominalAccountReady: true,
  webhookUrlReady: true,
  testPaymentPassed: true,
  productionAccessReady: true,
};

describe('platform-v7 bank partner readiness', () => {
  it('marks live partner as ready only when all required checks pass', () => {
    const model = platformV7BankPartnerReadinessModel(liveReady);

    expect(model.readinessPercent).toBe(100);
    expect(model.canGoLive).toBe(true);
    expect(model.canRunMoneyPilot).toBe(true);
    expect(model.blockerCount).toBe(0);
    expect(model.tone).toBe('success');
    expect(model.nextAction).toBe('Банковый live-контур готов.');
  });

  it('keeps sandbox partner blocked when contract and credentials are missing', () => {
    const model = platformV7BankPartnerReadinessModel({
      ...liveReady,
      stage: 'sandbox',
      contractSigned: false,
      credentialsReady: false,
      nominalAccountReady: false,
      webhookUrlReady: false,
      testPaymentPassed: false,
      productionAccessReady: false,
      connectors: { safe_deals: true },
    });

    expect(model.canGoLive).toBe(false);
    expect(model.canRunMoneyPilot).toBe(false);
    expect(model.blockerCount).toBeGreaterThan(2);
    expect(model.tone).toBe('danger');
    expect(model.missingConnectors).toEqual(['sberbusiness_id', 'webhooks', 'nominal_account']);
  });

  it('allows money pilot before live when critical pilot conditions are ready', () => {
    const model = platformV7BankPartnerReadinessModel({
      ...liveReady,
      stage: 'test_stand',
      productionAccessReady: false,
    });

    expect(model.canRunMoneyPilot).toBe(true);
    expect(model.canGoLive).toBe(false);
    expect(model.readinessPercent).toBeLessThan(100);
  });

  it('keeps helpers deterministic', () => {
    expect(platformV7BankPartnerReadinessPercent(liveReady, 4)).toBe(100);
    expect(platformV7BankPartnerReadinessTone(0, true)).toBe('success');
    expect(platformV7BankPartnerReadinessTone(1, false)).toBe('warning');
    expect(platformV7BankPartnerReadinessNextAction([], 'pre_live')).toBe('Перевести банк из тестового контура в live.');
    expect(platformV7BankPartnerReadinessBlockers(liveReady)).toEqual([]);
  });
});
