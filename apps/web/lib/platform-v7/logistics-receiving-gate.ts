export type PlatformV7ReceivingGateStatus = 'ready' | 'review' | 'blocked';
export type PlatformV7ReceivingGateTone = 'success' | 'warning' | 'danger';
export type PlatformV7ReceivingWeightStatus = 'missing' | 'matched' | 'within_tolerance' | 'shortage' | 'excess' | 'rejected';
export type PlatformV7ReceivingQualityStatus = 'missing' | 'pending' | 'passed' | 'discount_required' | 'rejected';
export type PlatformV7ReceivingDocumentStatus = 'missing' | 'draft' | 'signed' | 'registered' | 'failed';
export type PlatformV7ReceivingMoneyImpact = 'hold' | 'partial_release' | 'release_allowed';

export interface PlatformV7ReceivingGateInput {
  receivingId: string;
  shipmentId: string;
  dealId: string;
  arrivalConfirmed: boolean;
  unloadingStarted: boolean;
  unloadingFinished: boolean;
  receiverConfirmed: boolean;
  weightStatus: PlatformV7ReceivingWeightStatus;
  qualityStatus: PlatformV7ReceivingQualityStatus;
  receivingDocumentStatus: PlatformV7ReceivingDocumentStatus;
  labProtocolLinked: boolean;
  activeDispute: boolean;
  manualHold: boolean;
}

export interface PlatformV7ReceivingGateModel {
  receivingId: string;
  shipmentId: string;
  dealId: string;
  status: PlatformV7ReceivingGateStatus;
  tone: PlatformV7ReceivingGateTone;
  moneyImpact: PlatformV7ReceivingMoneyImpact;
  canFinalizeReceiving: boolean;
  canReleaseMoney: boolean;
  blockerCount: number;
  blockers: string[];
  reviewReasons: string[];
  nextAction: string;
}

export function platformV7ReceivingGateModel(input: PlatformV7ReceivingGateInput): PlatformV7ReceivingGateModel {
  const blockers = platformV7ReceivingGateBlockers(input);
  const reviewReasons = platformV7ReceivingGateReviewReasons(input);
  const status = platformV7ReceivingGateStatus(blockers, reviewReasons);
  const moneyImpact = platformV7ReceivingMoneyImpact(status, input);

  return {
    receivingId: input.receivingId,
    shipmentId: input.shipmentId,
    dealId: input.dealId,
    status,
    tone: platformV7ReceivingGateTone(status),
    moneyImpact,
    canFinalizeReceiving: status !== 'blocked' && input.unloadingFinished && input.receiverConfirmed,
    canReleaseMoney: moneyImpact === 'release_allowed',
    blockerCount: blockers.length,
    blockers,
    reviewReasons,
    nextAction: platformV7ReceivingGateNextAction(status, blockers, reviewReasons),
  };
}

export function platformV7ReceivingGateBlockers(input: PlatformV7ReceivingGateInput): string[] {
  const blockers: string[] = [];

  if (input.manualHold) blockers.push('manual-hold');
  if (input.activeDispute) blockers.push('active-dispute');
  if (!input.arrivalConfirmed) blockers.push('arrival-not-confirmed');
  if (!input.unloadingStarted) blockers.push('unloading-not-started');
  if (!input.unloadingFinished) blockers.push('unloading-not-finished');
  if (!input.receiverConfirmed) blockers.push('receiver-not-confirmed');
  if (input.weightStatus === 'missing') blockers.push('weight-missing');
  if (input.weightStatus === 'rejected') blockers.push('weight-rejected');
  if (input.qualityStatus === 'missing') blockers.push('quality-missing');
  if (input.qualityStatus === 'rejected') blockers.push('quality-rejected');
  if (input.receivingDocumentStatus === 'missing') blockers.push('receiving-documents-missing');
  if (input.receivingDocumentStatus === 'failed') blockers.push('receiving-documents-failed');
  if (!input.labProtocolLinked) blockers.push('lab-protocol-not-linked');

  return [...new Set(blockers)];
}

export function platformV7ReceivingGateReviewReasons(input: PlatformV7ReceivingGateInput): string[] {
  const reasons: string[] = [];

  if (input.weightStatus === 'within_tolerance') reasons.push('weight-within-tolerance');
  if (input.weightStatus === 'shortage') reasons.push('weight-shortage');
  if (input.weightStatus === 'excess') reasons.push('weight-excess');
  if (input.qualityStatus === 'pending') reasons.push('quality-pending');
  if (input.qualityStatus === 'discount_required') reasons.push('quality-discount-required');
  if (input.receivingDocumentStatus === 'draft' || input.receivingDocumentStatus === 'signed') reasons.push(`documents:${input.receivingDocumentStatus}`);

  return [...new Set(reasons)];
}

export function platformV7ReceivingGateStatus(
  blockers: string[],
  reviewReasons: string[],
): PlatformV7ReceivingGateStatus {
  if (blockers.length > 0) return 'blocked';
  if (reviewReasons.length > 0) return 'review';
  return 'ready';
}

export function platformV7ReceivingMoneyImpact(
  status: PlatformV7ReceivingGateStatus,
  input: PlatformV7ReceivingGateInput,
): PlatformV7ReceivingMoneyImpact {
  if (status === 'blocked') return 'hold';
  if (input.weightStatus === 'within_tolerance' || input.weightStatus === 'shortage' || input.weightStatus === 'excess' || input.qualityStatus === 'discount_required') return 'partial_release';
  if (status === 'ready') return 'release_allowed';
  return 'partial_release';
}

export function platformV7ReceivingGateTone(status: PlatformV7ReceivingGateStatus): PlatformV7ReceivingGateTone {
  if (status === 'ready') return 'success';
  if (status === 'review') return 'warning';
  return 'danger';
}

export function platformV7ReceivingGateNextAction(
  status: PlatformV7ReceivingGateStatus,
  blockers: string[],
  reviewReasons: string[],
): string {
  if (status === 'ready') return 'Приёмка подтверждена, можно продолжать выпуск денег.';
  if (status === 'blocked') return blockers[0] ? `Остановить приёмку: ${blockers[0]}.` : 'Остановить приёмку до снятия блокеров.';
  return reviewReasons[0] ? `Передать приёмку на проверку: ${reviewReasons[0]}.` : 'Передать приёмку на проверку оператора.';
}
