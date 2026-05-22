import { describe, expect, it } from 'vitest';
import { p7CanExposeCounterpartyContacts, p7EvaluateBypassRisk } from '@/lib/platform-v7/anti-bypass';

describe('platform-v7 anti bypass foundation', () => {
  it('keeps contact disclosure blocked before reserve and document basis', () => {
    expect(p7CanExposeCounterpartyContacts({ reserveConfirmed: false, documentBasisReady: true })).toBe(false);
    expect(p7CanExposeCounterpartyContacts({ reserveConfirmed: true, documentBasisReady: false })).toBe(false);
    expect(p7CanExposeCounterpartyContacts({ reserveConfirmed: true, documentBasisReady: true })).toBe(true);
  });

  it('flags critical risk when contacts are exposed before reserve', () => {
    const decision = p7EvaluateBypassRisk({
      dealId: 'deal-1',
      reserveConfirmed: false,
      documentBasisReady: false,
      counterpartyContactsVisible: true,
      offPlatformPaymentMentioned: false,
      externalChatMentioned: false,
      repeatUnmatchedDeals: 0,
    });

    expect(decision.level).toBe('critical');
    expect(decision.signals).toContain('counterparty_details_exposed_before_reserve');
  });

  it('flags off-platform payment and external chat as bypass signals', () => {
    const decision = p7EvaluateBypassRisk({
      dealId: 'deal-2',
      reserveConfirmed: false,
      documentBasisReady: true,
      counterpartyContactsVisible: false,
      offPlatformPaymentMentioned: true,
      externalChatMentioned: true,
      repeatUnmatchedDeals: 0,
    });

    expect(decision.level).toBe('critical');
    expect(decision.signals).toContain('off_platform_payment_terms');
    expect(decision.signals).toContain('external_chat_channel');
    expect(decision.signals).toContain('early_direct_contact_requested');
  });

  it('keeps low risk when reserve and documents are ready with no bypass signals', () => {
    const decision = p7EvaluateBypassRisk({
      dealId: 'deal-3',
      reserveConfirmed: true,
      documentBasisReady: true,
      counterpartyContactsVisible: false,
      offPlatformPaymentMentioned: false,
      externalChatMentioned: false,
      repeatUnmatchedDeals: 0,
    });

    expect(decision.level).toBe('low');
    expect(decision.signals).toEqual([]);
  });
});
