import { describe, expect, it } from 'vitest';
import type { PlatformV7QualityControlGateModel } from '@/lib/platform-v7/quality-control-gate';
import type { PlatformV7QualityDiscountModel } from '@/lib/platform-v7/quality-discount';
import {
  platformV7QualityReleaseDecision,
  platformV7QualityReleaseNextAction,
  platformV7QualityReleaseReadinessBlockers,
  platformV7QualityReleaseReadinessModel,
  platformV7QualityReleaseReadinessReviewReasons,
  platformV7QualityReleaseReadinessStatus,
  platformV7QualityReleaseReadinessTone,
  platformV7QualityReleaseStableKey,
} from '@/lib/platform-v7/quality-release-readiness';

const qualityReady: PlatformV7QualityControlGateModel = {
  qualityId: 'QLT-1',
  dealId: 'DL-1',
  shipmentId: 'SHIP-1',
  cropKind: 'wheat',
  status: 'ready',
  tone: 'success',
  moneyImpact: 'release_allowed',
  canReleaseMoney: true,
  missingRequiredCodes: [],
  failedParameterCodes: [],
  discountParameterCodes: [],
  blockerCount: 0,
  blockers: [],
  reviewReasons: [],
  nextAction: 'Качество подтверждено, блокер качества снят.',
};

const discountReady: PlatformV7QualityDiscountModel = {
  dealId: 'DL-1',
  shipmentId: 'SHIP-1',
  status: 'ready',
  tone: 'success',
  grossAmount: 1000000,
  totalDiscountAmount: 0,
  totalDiscountPercent: 0,
  netPayableAmount: 1000000,
  canApplyAutomatically: true,
  lineCount: 0,
  lines: [],
  blockerCount: 0,
  blockers: [],
  reviewReasons: [],
  nextAction: 'Скидка по качеству готова к применению.',
};

describe('platform-v7 quality release readiness', () => {
  it('allows release when quality and discount are ready', () => {
    const model = platformV7QualityReleaseReadinessModel({
      dealId: 'DL-1',
      shipmentId: 'SHIP-1',
      qualityGate: qualityReady,
      discount: discountReady,
      activeManualHold: false,
      activeDispute: false,
    });

    expect(model.status).toBe('ready');
    expect(model.decision).toBe('allow_release');
    expect(model.canNotifyBank).toBe(true);
    expect(model.canRelease).toBe(true);
    expect(model.blockers).toEqual([]);
  });

  it('uses partial release when discount amount exists', () => {
    const model = platformV7QualityReleaseReadinessModel({
      dealId: 'DL-1',
      shipmentId: 'SHIP-1',
      qualityGate: qualityReady,
      discount: { ...discountReady, totalDiscountAmount: 20000, netPayableAmount: 980000 },
      activeManualHold: false,
      activeDispute: false,
    });

    expect(model.status).toBe('ready');
    expect(model.decision).toBe('allow_partial_release');
    expect(model.canNotifyBank).toBe(true);
    expect(model.canRelease).toBe(false);
  });

  it('holds release when quality or discount is blocked', () => {
    const model = platformV7QualityReleaseReadinessModel({
      dealId: 'DL-1',
      shipmentId: 'SHIP-1',
      qualityGate: { ...qualityReady, status: 'blocked', tone: 'danger', canReleaseMoney: false, blockerCount: 1, blockers: ['quality-protocol-missing'] },
      discount: { ...discountReady, status: 'blocked', blockers: ['negative-net-payable'], blockerCount: 1 },
      activeManualHold: false,
      activeDispute: true,
    });

    expect(model.status).toBe('blocked');
    expect(model.decision).toBe('hold_release');
    expect(model.canNotifyBank).toBe(false);
    expect(model.blockers).toContain('active-dispute');
    expect(model.blockers).toContain('quality-gate-not-ready');
    expect(model.blockers).toContain('quality-discount-blocked');
  });

  it('routes review to controlled partial release', () => {
    const model = platformV7QualityReleaseReadinessModel({
      dealId: 'DL-1',
      shipmentId: 'SHIP-1',
      qualityGate: { ...qualityReady, status: 'review', tone: 'warning', moneyImpact: 'partial_release', reviewReasons: ['discount-required:protein'] },
      discount: { ...discountReady, status: 'review', totalDiscountAmount: 20000, reviewReasons: ['discount-over-auto-limit'] },
      activeManualHold: false,
      activeDispute: false,
    });

    expect(model.status).toBe('review');
    expect(model.decision).toBe('allow_partial_release');
    expect(model.canNotifyBank).toBe(true);
    expect(model.reviewReasons).toContain('quality-gate-review');
    expect(model.reviewReasons).toContain('discount:discount-over-auto-limit');
  });

  it('keeps helper outputs deterministic', () => {
    const input = { dealId: 'DL-1', shipmentId: 'SHIP-1', qualityGate: qualityReady, discount: discountReady, activeManualHold: false, activeDispute: false };

    expect(platformV7QualityReleaseReadinessBlockers(input)).toEqual([]);
    expect(platformV7QualityReleaseReadinessReviewReasons(input)).toEqual([]);
    expect(platformV7QualityReleaseReadinessStatus([], [])).toBe('ready');
    expect(platformV7QualityReleaseDecision('ready', input)).toBe('allow_release');
    expect(platformV7QualityReleaseReadinessTone('blocked')).toBe('danger');
    expect(platformV7QualityReleaseNextAction('ready', [], [])).toBe('Качество готово к денежному контуру.');
    expect(platformV7QualityReleaseStableKey(input)).toBe('DL-1:SHIP-1:ready:ready:0');
  });
});
