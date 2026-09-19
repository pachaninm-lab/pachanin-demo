import { describe, expect, it } from 'vitest';
import { p7CanRevealCounterparty, p7CanRevealDriver, p7EvaluateBypassRisk } from '@/lib/platform-v7/anti-bypass';

describe('platform-v7 anti-bypass rules', () => {
  it('blocks direct contacts and off-platform payment instructions', () => {
    expect(p7EvaluateBypassRisk({
      dealId: 'deal-1',
      role: 'buyer',
      stage: 'offer',
      visibleSignals: ['direct_phone_visible', 'off_platform_payment_instruction'],
    })).toEqual(expect.objectContaining({
      blocked: true,
      riskLevel: 'critical',
    }));
  });

  it('blocks unmasked counterparty before reserve', () => {
    const result = p7EvaluateBypassRisk({
      dealId: 'deal-1',
      role: 'seller',
      stage: 'reserve_pending',
      visibleSignals: ['unmasked_counterparty_before_reserve'],
    });

    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain('unmasked_counterparty_before_reserve');
  });

  it('allows counterparty reveal only after reserve or execution stages', () => {
    expect(p7CanRevealCounterparty('pre_offer')).toBe(false);
    expect(p7CanRevealCounterparty('offer')).toBe(false);
    expect(p7CanRevealCounterparty('reserved')).toBe(true);
    expect(p7CanRevealCounterparty('in_execution')).toBe(true);
  });

  it('allows driver reveal only during execution or after close', () => {
    expect(p7CanRevealDriver('reserved')).toBe(false);
    expect(p7CanRevealDriver('in_execution')).toBe(true);
    expect(p7CanRevealDriver('closed')).toBe(true);
  });

  it('keeps clean flows unblocked', () => {
    expect(p7EvaluateBypassRisk({
      dealId: 'deal-1',
      role: 'operator',
      stage: 'in_execution',
      visibleSignals: [],
    })).toEqual({
      blocked: false,
      riskLevel: 'low',
      reasons: [],
      requiredAction: 'Продолжить в контуре сделки',
    });
  });
});
