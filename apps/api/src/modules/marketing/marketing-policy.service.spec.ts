import { evaluateMarketingPolicy } from './marketing-policy.service';
import type { MarketingPolicyInput } from './marketing.types';

const NOW = Date.parse('2026-08-24T09:00:00.000Z');

function safe(overrides: Partial<MarketingPolicyInput> = {}): MarketingPolicyInput {
  return {
    channel: 'TELEGRAM',
    classification: 'INFORMATIONAL',
    text: 'Как лабораторное отклонение влияет на окончательный расчёт по партии зерна.',
    requiresEvidence: true,
    evidenceIds: ['evidence-1'],
    requiresFreshness: true,
    freshnessCheckedAt: '2026-08-24T08:30:00.000Z',
    maxEvidenceAgeHours: 24,
    riskClass: 'NONE',
    containsPersonalData: false,
    destinationRisk: 'CLEARED',
    isDirectMessage: false,
    ...overrides,
  };
}

const OUTBOUND_ON = { MARKETING_OUTBOUND_ENABLED: 'true' } as NodeJS.ProcessEnv;

describe('marketing policy — autonomous outbound', () => {
  it('fails closed when the global outbound switch is absent', () => {
    const decision = evaluateMarketingPolicy(safe(), {}, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('OUTBOUND_DISABLED');
  });

  it('allows sourced low-risk informational content on an allowlisted channel', () => {
    expect(evaluateMarketingPolicy(safe(), OUTBOUND_ON, NOW)).toEqual({
      allowed: true,
      code: 'ALLOW',
      reasons: [],
    });
  });

  it('cannot expand the Russian channel allowlist through arbitrary input', () => {
    const decision = evaluateMarketingPolicy(safe({ channel: 'UNAPPROVED_NETWORK' }), OUTBOUND_ON, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('CHANNEL_NOT_ALLOWLISTED');
  });

  it('quarantines legally uncertain material', () => {
    const decision = evaluateMarketingPolicy(safe({ classification: 'UNCERTAIN' }), OUTBOUND_ON, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('LEGAL_CLASSIFICATION_UNCERTAIN');
  });

  it('requires marker, advertiser identity, valid INN and ERID for advertising', () => {
    const decision = evaluateMarketingPolicy(
      safe({ classification: 'ADVERTISING', advertising: {} }),
      OUTBOUND_ON,
      NOW,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining([
      'ADVERTISING_MARKER_MISSING',
      'ADVERTISER_IDENTITY_MISSING',
      'ADVERTISER_INN_INVALID',
      'ERID_MISSING',
    ]));
  });

  it('rejects malformed INN and ERID before outbound admission', () => {
    const decision = evaluateMarketingPolicy(
      safe({
        classification: 'ADVERTISING',
        advertising: {
          hasAdvertisingLabel: true,
          advertiserName: 'ООО «Прозрачная цена»',
          advertiserInn: '1234567890',
          erid: 'bad erid',
          isPaidPlacement: false,
        },
      }),
      OUTBOUND_ON,
      NOW,
    );
    expect(decision.reasons).toEqual(expect.arrayContaining([
      'ADVERTISER_INN_INVALID',
      'ERID_MISSING',
    ]));
  });

  it('allows properly attributed non-paid advertising when all legal metadata is present', () => {
    const decision = evaluateMarketingPolicy(
      safe({
        classification: 'ADVERTISING',
        advertising: {
          hasAdvertisingLabel: true,
          advertiserName: 'ООО «Прозрачная цена»',
          advertiserInn: '7707083893',
          erid: 'example-erid-from-ord',
          isPaidPlacement: false,
        },
      }),
      OUTBOUND_ON,
      NOW,
    );
    expect(decision.allowed).toBe(true);
  });

  it('keeps paid placements disabled until the separate paid-mode switch is enabled', () => {
    const advertising = {
      hasAdvertisingLabel: true,
      advertiserName: 'ООО «Прозрачная цена»',
      advertiserInn: '7707083893',
      erid: 'example-erid-from-ord',
      isPaidPlacement: true,
    } as const;

    expect(
      evaluateMarketingPolicy(safe({ classification: 'ADVERTISING', advertising }), OUTBOUND_ON, NOW).reasons,
    ).toContain('PAID_MODE_DISABLED');

    expect(
      evaluateMarketingPolicy(
        safe({ classification: 'ADVERTISING', advertising }),
        { MARKETING_OUTBOUND_ENABLED: 'true', MARKETING_PAID_MODE_ENABLED: 'true' },
        NOW,
      ).allowed,
    ).toBe(true);
  });

  it('blocks unsolicited direct messages but allows initiated or consented replies', () => {
    expect(evaluateMarketingPolicy(safe({ isDirectMessage: true }), OUTBOUND_ON, NOW).reasons)
      .toContain('UNSOLICITED_DIRECT_MESSAGE');
    expect(
      evaluateMarketingPolicy(safe({ isDirectMessage: true, recipientInitiated: true }), OUTBOUND_ON, NOW).allowed,
    ).toBe(true);
    expect(
      evaluateMarketingPolicy(safe({ isDirectMessage: true, marketingConsentId: 'consent-42' }), OUTBOUND_ON, NOW).allowed,
    ).toBe(true);
  });

  it('rejects stale evidence, personal-data exposure and restricted destinations', () => {
    const decision = evaluateMarketingPolicy(
      safe({
        freshnessCheckedAt: '2026-08-20T08:30:00.000Z',
        containsPersonalData: true,
        destinationRisk: 'RESTRICTED',
      }),
      OUTBOUND_ON,
      NOW,
    );
    expect(decision.reasons).toEqual(expect.arrayContaining([
      'STALE_OR_UNVERIFIED_EVIDENCE',
      'PERSONAL_DATA_EXPOSURE',
      'DESTINATION_NOT_CLEARED',
    ]));
  });
});
