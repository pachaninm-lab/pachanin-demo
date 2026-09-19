import type { PlatformV7QualityControlGateModel } from './quality-control-gate';
import type { PlatformV7QualityDiscountModel } from './quality-discount';

export type PlatformV7QualityReleaseReadinessStatus = 'ready' | 'review' | 'blocked';
export type PlatformV7QualityReleaseReadinessTone = 'success' | 'warning' | 'danger';
export type PlatformV7QualityReleaseDecision = 'allow_release' | 'allow_partial_release' | 'hold_release';

export interface PlatformV7QualityReleaseReadinessInput {
  dealId: string;
  shipmentId: string;
  qualityGate: PlatformV7QualityControlGateModel;
  discount: PlatformV7QualityDiscountModel;
  activeManualHold: boolean;
  activeDispute: boolean;
}

export interface PlatformV7QualityReleaseReadinessModel {
  dealId: string;
  shipmentId: string;
  status: PlatformV7QualityReleaseReadinessStatus;
  tone: PlatformV7QualityReleaseReadinessTone;
  decision: PlatformV7QualityReleaseDecision;
  canNotifyBank: boolean;
  canRelease: boolean;
  blockerCount: number;
  blockers: string[];
  reviewReasons: string[];
  nextAction: string;
}

export function platformV7QualityReleaseReadinessModel(input: PlatformV7QualityReleaseReadinessInput): PlatformV7QualityReleaseReadinessModel {
  const blockers = platformV7QualityReleaseReadinessBlockers(input);
  const reviewReasons = platformV7QualityReleaseReadinessReviewReasons(input);
  const status = platformV7QualityReleaseReadinessStatus(blockers, reviewReasons);
  const decision = platformV7QualityReleaseDecision(status, input);

  return {
    dealId: input.dealId,
    shipmentId: input.shipmentId,
    status,
    tone: platformV7QualityReleaseReadinessTone(status),
    decision,
    canNotifyBank: status !== 'blocked' && decision !== 'hold_release',
    canRelease: decision === 'allow_release',
    blockerCount: blockers.length,
    blockers,
    reviewReasons,
    nextAction: platformV7QualityReleaseNextAction(status, blockers, reviewReasons),
  };
}

export function platformV7QualityReleaseReadinessBlockers(input: PlatformV7QualityReleaseReadinessInput): string[] {
  const blockers: string[] = [];

  if (input.activeManualHold) blockers.push('manual-hold');
  if (input.activeDispute) blockers.push('active-dispute');
  if (!input.qualityGate.canReleaseMoney) blockers.push('quality-gate-not-ready');
  if (input.discount.status === 'blocked') blockers.push('quality-discount-blocked');
  input.qualityGate.blockers.forEach((blocker) => blockers.push(`quality:${blocker}`));
  input.discount.blockers.forEach((blocker) => blockers.push(`discount:${blocker}`));

  return [...new Set(blockers)];
}

export function platformV7QualityReleaseReadinessReviewReasons(input: PlatformV7QualityReleaseReadinessInput): string[] {
  const reasons: string[] = [];

  if (input.qualityGate.status === 'review') reasons.push('quality-gate-review');
  if (input.discount.status === 'review') reasons.push('quality-discount-review');
  input.qualityGate.reviewReasons.forEach((reason) => reasons.push(`quality:${reason}`));
  input.discount.reviewReasons.forEach((reason) => reasons.push(`discount:${reason}`));

  return [...new Set(reasons)];
}

export function platformV7QualityReleaseReadinessStatus(
  blockers: string[],
  reviewReasons: string[],
): PlatformV7QualityReleaseReadinessStatus {
  if (blockers.length > 0) return 'blocked';
  if (reviewReasons.length > 0) return 'review';
  return 'ready';
}

export function platformV7QualityReleaseDecision(
  status: PlatformV7QualityReleaseReadinessStatus,
  input: PlatformV7QualityReleaseReadinessInput,
): PlatformV7QualityReleaseDecision {
  if (status === 'blocked') return 'hold_release';
  if (input.qualityGate.moneyImpact === 'partial_release' || input.discount.totalDiscountAmount > 0 || status === 'review') return 'allow_partial_release';
  return 'allow_release';
}

export function platformV7QualityReleaseReadinessTone(status: PlatformV7QualityReleaseReadinessStatus): PlatformV7QualityReleaseReadinessTone {
  if (status === 'ready') return 'success';
  if (status === 'review') return 'warning';
  return 'danger';
}

export function platformV7QualityReleaseNextAction(
  status: PlatformV7QualityReleaseReadinessStatus,
  blockers: string[],
  reviewReasons: string[],
): string {
  if (status === 'ready') return 'Качество готово к денежному контуру.';
  if (status === 'blocked') return blockers[0] ? `Не передавать в банк: ${blockers[0]}.` : 'Не передавать в банк до закрытия качества.';
  return reviewReasons[0] ? `Передать качество с ручным контролем: ${reviewReasons[0]}.` : 'Передать качество на ручной контроль.';
}

export function platformV7QualityReleaseStableKey(input: PlatformV7QualityReleaseReadinessInput): string {
  return `${input.dealId}:${input.shipmentId}:${input.qualityGate.status}:${input.discount.status}:${input.discount.totalDiscountAmount}`;
}
