import type { PlatformV7LogisticsOpsQueueModel } from './logistics-ops-queue';
import type { PlatformV7ReceivingGateModel } from './logistics-receiving-gate';
import type { PlatformV7ShipmentGateModel } from './logistics-shipment-gate';
import type { PlatformV7TransportDocumentsGateModel } from './logistics-transport-documents-gate';

export type PlatformV7LogisticsReleaseReadinessStatus = 'ready' | 'review' | 'blocked';
export type PlatformV7LogisticsReleaseReadinessTone = 'success' | 'warning' | 'danger';
export type PlatformV7LogisticsReleaseDecision = 'allow_release' | 'allow_partial_release' | 'hold_release';

export interface PlatformV7LogisticsReleaseReadinessInput {
  dealId: string;
  shipmentId: string;
  shipmentGate: PlatformV7ShipmentGateModel;
  receivingGate: PlatformV7ReceivingGateModel;
  transportDocumentsGate: PlatformV7TransportDocumentsGateModel;
  opsQueue: PlatformV7LogisticsOpsQueueModel;
  activeManualHold: boolean;
  activeDispute: boolean;
}

export interface PlatformV7LogisticsReleaseReadinessModel {
  dealId: string;
  shipmentId: string;
  status: PlatformV7LogisticsReleaseReadinessStatus;
  tone: PlatformV7LogisticsReleaseReadinessTone;
  decision: PlatformV7LogisticsReleaseDecision;
  canNotifyBank: boolean;
  canRelease: boolean;
  blockerCount: number;
  blockers: string[];
  reviewReasons: string[];
  nextAction: string;
}

export function platformV7LogisticsReleaseReadinessModel(
  input: PlatformV7LogisticsReleaseReadinessInput,
): PlatformV7LogisticsReleaseReadinessModel {
  const blockers = platformV7LogisticsReleaseReadinessBlockers(input);
  const reviewReasons = platformV7LogisticsReleaseReadinessReviewReasons(input);
  const status = platformV7LogisticsReleaseReadinessStatus(blockers, reviewReasons);
  const decision = platformV7LogisticsReleaseDecision(status, input);

  return {
    dealId: input.dealId,
    shipmentId: input.shipmentId,
    status,
    tone: platformV7LogisticsReleaseReadinessTone(status),
    decision,
    canNotifyBank: status !== 'blocked' && decision !== 'hold_release',
    canRelease: decision === 'allow_release',
    blockerCount: blockers.length,
    blockers,
    reviewReasons,
    nextAction: platformV7LogisticsReleaseNextAction(status, blockers, reviewReasons),
  };
}

export function platformV7LogisticsReleaseReadinessBlockers(
  input: PlatformV7LogisticsReleaseReadinessInput,
): string[] {
  const blockers: string[] = [];

  if (input.activeManualHold) blockers.push('manual-hold');
  if (input.activeDispute) blockers.push('active-dispute');
  if (!input.shipmentGate.canReleaseMoney) blockers.push('shipment-gate-not-ready');
  if (!input.receivingGate.canReleaseMoney) blockers.push('receiving-gate-not-ready');
  if (!input.transportDocumentsGate.canReleaseMoney) blockers.push('transport-documents-gate-not-ready');
  if (input.opsQueue.summary.blocked > 0) blockers.push('logistics-queue-has-blocked-items');
  if (input.opsQueue.summary.moneyBlocked > 0) blockers.push('logistics-queue-money-blocked');

  return [...new Set(blockers)];
}

export function platformV7LogisticsReleaseReadinessReviewReasons(
  input: PlatformV7LogisticsReleaseReadinessInput,
): string[] {
  const reasons: string[] = [];

  if (input.shipmentGate.status === 'review') reasons.push('shipment-gate-review');
  if (input.receivingGate.status === 'review') reasons.push('receiving-gate-review');
  if (input.transportDocumentsGate.status === 'review') reasons.push('transport-documents-gate-review');
  if (input.opsQueue.summary.review > 0) reasons.push('logistics-queue-review-items');

  return [...new Set(reasons)];
}

export function platformV7LogisticsReleaseReadinessStatus(
  blockers: string[],
  reviewReasons: string[],
): PlatformV7LogisticsReleaseReadinessStatus {
  if (blockers.length > 0) return 'blocked';
  if (reviewReasons.length > 0) return 'review';
  return 'ready';
}

export function platformV7LogisticsReleaseDecision(
  status: PlatformV7LogisticsReleaseReadinessStatus,
  input: PlatformV7LogisticsReleaseReadinessInput,
): PlatformV7LogisticsReleaseDecision {
  if (status === 'blocked') return 'hold_release';
  if (input.shipmentGate.moneyImpact === 'partial_release' || input.receivingGate.moneyImpact === 'partial_release' || input.transportDocumentsGate.moneyImpact === 'partial_release') return 'allow_partial_release';
  if (status === 'review') return 'allow_partial_release';
  return 'allow_release';
}

export function platformV7LogisticsReleaseReadinessTone(
  status: PlatformV7LogisticsReleaseReadinessStatus,
): PlatformV7LogisticsReleaseReadinessTone {
  if (status === 'ready') return 'success';
  if (status === 'review') return 'warning';
  return 'danger';
}

export function platformV7LogisticsReleaseNextAction(
  status: PlatformV7LogisticsReleaseReadinessStatus,
  blockers: string[],
  reviewReasons: string[],
): string {
  if (status === 'ready') return 'Логистика готова к передаче в денежный контур.';
  if (status === 'blocked') return blockers[0] ? `Не передавать в банк: ${blockers[0]}.` : 'Не передавать в банк до снятия логистических блокеров.';
  return reviewReasons[0] ? `Передать с частичным/ручным контролем: ${reviewReasons[0]}.` : 'Передать на ручной контроль перед банком.';
}
