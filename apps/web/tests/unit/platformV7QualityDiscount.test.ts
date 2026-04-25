import { describe, expect, it } from 'vitest';
import type { PlatformV7QualityDiscountInput } from '@/lib/platform-v7/quality-discount';
import {
  platformV7QualityDiscountBlockers,
  platformV7QualityDiscountLineModel,
  platformV7QualityDiscountModel,
  platformV7QualityDiscountNextAction,
  platformV7QualityDiscountReviewReasons,
  platformV7QualityDiscountRound,
  platformV7QualityDiscountStableKey,
  platformV7QualityDiscountStatus,
  platformV7QualityDiscountTone,
  platformV7QualityDiscountTotal,
} from '@/lib/platform-v7/quality-discount';

const baseDiscount: PlatformV7QualityDiscountInput = {
  dealId: 'DL-1',
  shipmentId: 'SHIP-1',
  grossAmount: 1_000_000,
  tonnage: 100,
  currency: 'RUB',
  maxAutoDiscountPercent: 5,
  activeDispute: false,
  manualHold: false,
  lines: [
    {
      id: 'DISC-1',
      basis: 'protein',
      title: 'Протеин ниже контракта',
      type: 'percent',
      value: 2,
      approved: true,
      requiresManualApproval: false,
    },
    {
      id: 'DISC-2',
      basis: 'moisture',
      title: 'Влажность выше допуска',
      type: 'amount_per_ton',
      value: 100,
      approved: true,
      requiresManualApproval: false,
    },
  ],
};

describe('platform-v7 quality discount', () => {
  it('calculates approved quality discount and net payable amount', () => {
    const model = platformV7QualityDiscountModel(baseDiscount);

    expect(model.status).toBe('ready');
    expect(model.tone).toBe('success');
    expect(model.canApplyAutomatically).toBe(true);
    expect(model.totalDiscountAmount).toBe(30_000);
    expect(model.totalDiscountPercent).toBe(3);
    expect(model.netPayableAmount).toBe(970_000);
    expect(model.blockers).toEqual([]);
  });

  it('moves discount into review when manual approval is required', () => {
    const model = platformV7QualityDiscountModel({
      ...baseDiscount,
      lines: [
        {
          ...baseDiscount.lines[0],
          approved: false,
          requiresManualApproval: true,
        },
      ],
    });

    expect(model.status).toBe('review');
    expect(model.canApplyAutomatically).toBe(false);
    expect(model.reviewReasons).toContain('manual-approval-required:DISC-1');
    expect(model.reviewReasons).toContain('discount-not-approved:DISC-1');
  });

  it('blocks negative net payable and active disputes', () => {
    const model = platformV7QualityDiscountModel({
      ...baseDiscount,
      activeDispute: true,
      lines: [
        {
          ...baseDiscount.lines[0],
          type: 'percent',
          value: 120,
        },
      ],
    });

    expect(model.status).toBe('blocked');
    expect(model.blockers).toContain('active-dispute');
    expect(model.blockers).toContain('negative-net-payable');
  });

  it('requires review when total discount exceeds auto limit', () => {
    const model = platformV7QualityDiscountModel({
      ...baseDiscount,
      maxAutoDiscountPercent: 1,
    });

    expect(model.status).toBe('review');
    expect(model.reviewReasons).toContain('discount-over-auto-limit');
  });

  it('keeps helper outputs deterministic', () => {
    const line = platformV7QualityDiscountLineModel(baseDiscount.lines[0], baseDiscount.grossAmount, baseDiscount.tonnage);

    expect(line.discountAmount).toBe(20_000);
    expect(platformV7QualityDiscountTotal([line])).toBe(20_000);
    expect(platformV7QualityDiscountBlockers(baseDiscount, [line], 980_000)).toEqual([]);
    expect(platformV7QualityDiscountReviewReasons(baseDiscount, [line], 2)).toEqual([]);
    expect(platformV7QualityDiscountStatus([], [])).toBe('ready');
    expect(platformV7QualityDiscountTone('blocked')).toBe('danger');
    expect(platformV7QualityDiscountNextAction('ready', [], [])).toBe('Скидка по качеству готова к применению.');
    expect(platformV7QualityDiscountRound(10.005)).toBe(10.01);
    expect(platformV7QualityDiscountStableKey(baseDiscount)).toBe('DL-1:SHIP-1:1000000:100:DISC-1|DISC-2');
  });
});
