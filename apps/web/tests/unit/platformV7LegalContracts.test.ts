import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_REQUIRED_LEGAL_RULES,
  canPlatformV7EnterRealMode,
  doesLegalRuleBlockMoney,
} from '@/lib/platform-v7/legal-contracts';

describe('platform-v7 rule contracts', () => {
  it('keeps required rule coverage', () => {
    expect(PLATFORM_V7_REQUIRED_LEGAL_RULES.map((rule) => rule.type)).toEqual([
      'deal_rules',
      'rating_rules',
      'dispute_rules',
      'money_hold_rules',
      'pilot_real_boundary',
      'anti_bypass_policy',
      'document_signing_rules',
      'external_connector_rules',
      'personal_data_rules',
      'tax_and_counterparty_rules',
    ]);
  });

  it('keeps mode gate closed when the rule set is incomplete', () => {
    expect(canPlatformV7EnterRealMode(['deal_rules']).allowed).toBe(false);

    const allRules = PLATFORM_V7_REQUIRED_LEGAL_RULES.map((rule) => rule.type);
    expect(canPlatformV7EnterRealMode(allRules)).toMatchObject({
      allowed: true,
      missing: [],
    });
  });

  it('keeps payout-impacting checks explicit', () => {
    const payoutRules = ['dispute_rules', 'money_hold_rules', 'document_signing_rules', 'tax_and_counterparty_rules'] as const;
    for (const rule of payoutRules) expect(doesLegalRuleBlockMoney(rule)).toBe(true);
    expect(doesLegalRuleBlockMoney('anti_bypass_policy')).toBe(false);
  });
});
