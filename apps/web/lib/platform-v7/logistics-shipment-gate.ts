export type PlatformV7ShipmentGateStatus = 'ready' | 'review' | 'blocked';
export type PlatformV7ShipmentGateTone = 'success' | 'warning' | 'danger';
export type PlatformV7ShipmentTransportStatus = 'not_started' | 'created' | 'in_transit' | 'arrived' | 'accepted' | 'rejected';
export type PlatformV7ShipmentDocumentStatus = 'missing' | 'draft' | 'signed' | 'registered' | 'failed';
export type PlatformV7ShipmentTrackingStatus = 'missing' | 'active' | 'stale' | 'route_deviation';
export type PlatformV7ShipmentWeightStatus = 'missing' | 'matched' | 'tolerance_exceeded' | 'mismatch';
export type PlatformV7ShipmentQualityStatus = 'missing' | 'pending' | 'passed' | 'discount_required' | 'failed';
export type PlatformV7ShipmentMoneyImpact = 'none' | 'hold' | 'partial_release' | 'release_allowed';

export interface PlatformV7ShipmentGateInput {
  shipmentId: string;
  dealId: string;
  transportStatus: PlatformV7ShipmentTransportStatus;
  transportDocumentStatus: PlatformV7ShipmentDocumentStatus;
  trackingStatus: PlatformV7ShipmentTrackingStatus;
  weightStatus: PlatformV7ShipmentWeightStatus;
  qualityStatus: PlatformV7ShipmentQualityStatus;
  receiverConfirmed: boolean;
  activeDispute: boolean;
  manualHold: boolean;
}

export interface PlatformV7ShipmentGateModel {
  shipmentId: string;
  dealId: string;
  status: PlatformV7ShipmentGateStatus;
  tone: PlatformV7ShipmentGateTone;
  moneyImpact: PlatformV7ShipmentMoneyImpact;
  canReleaseMoney: boolean;
  canAcceptShipment: boolean;
  blockerCount: number;
  blockers: string[];
  reviewReasons: string[];
  nextAction: string;
}

export function platformV7ShipmentGateModel(input: PlatformV7ShipmentGateInput): PlatformV7ShipmentGateModel {
  const blockers = platformV7ShipmentGateBlockers(input);
  const reviewReasons = platformV7ShipmentGateReviewReasons(input);
  const status = platformV7ShipmentGateStatus(blockers, reviewReasons);
  const moneyImpact = platformV7ShipmentMoneyImpact(status, input);

  return {
    shipmentId: input.shipmentId,
    dealId: input.dealId,
    status,
    tone: platformV7ShipmentGateTone(status),
    moneyImpact,
    canReleaseMoney: moneyImpact === 'release_allowed',
    canAcceptShipment: status !== 'blocked' && input.transportStatus === 'arrived' && !input.activeDispute,
    blockerCount: blockers.length,
    blockers,
    reviewReasons,
    nextAction: platformV7ShipmentGateNextAction(status, blockers, reviewReasons),
  };
}

export function platformV7ShipmentGateBlockers(input: PlatformV7ShipmentGateInput): string[] {
  const blockers: string[] = [];

  if (input.manualHold) blockers.push('manual-hold');
  if (input.activeDispute) blockers.push('active-dispute');
  if (input.transportStatus === 'not_started') blockers.push('shipment-not-started');
  if (input.transportStatus === 'rejected') blockers.push('shipment-rejected');
  if (input.transportDocumentStatus === 'missing') blockers.push('transport-documents-missing');
  if (input.transportDocumentStatus === 'failed') blockers.push('transport-documents-failed');
  if (input.trackingStatus === 'missing') blockers.push('tracking-missing');
  if (input.trackingStatus === 'route_deviation') blockers.push('route-deviation');
  if (input.weightStatus === 'missing') blockers.push('weight-missing');
  if (input.weightStatus === 'mismatch') blockers.push('weight-mismatch');
  if (input.qualityStatus === 'missing') blockers.push('quality-missing');
  if (input.qualityStatus === 'failed') blockers.push('quality-failed');
  if (input.transportStatus === 'accepted' && !input.receiverConfirmed) blockers.push('receiver-not-confirmed');

  return [...new Set(blockers)];
}

export function platformV7ShipmentGateReviewReasons(input: PlatformV7ShipmentGateInput): string[] {
  const reasons: string[] = [];

  if (input.transportStatus === 'created' || input.transportStatus === 'in_transit' || input.transportStatus === 'arrived') reasons.push(`transport:${input.transportStatus}`);
  if (input.transportDocumentStatus === 'draft' || input.transportDocumentStatus === 'signed') reasons.push(`documents:${input.transportDocumentStatus}`);
  if (input.trackingStatus === 'stale') reasons.push('tracking-stale');
  if (input.weightStatus === 'tolerance_exceeded') reasons.push('weight-tolerance-exceeded');
  if (input.qualityStatus === 'pending' || input.qualityStatus === 'discount_required') reasons.push(`quality:${input.qualityStatus}`);
  if (input.transportStatus !== 'accepted') reasons.push('shipment-not-accepted');

  return [...new Set(reasons)];
}

export function platformV7ShipmentGateStatus(
  blockers: string[],
  reviewReasons: string[],
): PlatformV7ShipmentGateStatus {
  if (blockers.length > 0) return 'blocked';
  if (reviewReasons.length > 0) return 'review';
  return 'ready';
}

export function platformV7ShipmentMoneyImpact(
  status: PlatformV7ShipmentGateStatus,
  input: PlatformV7ShipmentGateInput,
): PlatformV7ShipmentMoneyImpact {
  if (status === 'blocked') return 'hold';
  if (input.qualityStatus === 'discount_required' || input.weightStatus === 'tolerance_exceeded') return 'partial_release';
  if (status === 'ready' && input.transportStatus === 'accepted' && input.receiverConfirmed) return 'release_allowed';
  if (status === 'review') return 'partial_release';
  return 'none';
}

export function platformV7ShipmentGateTone(status: PlatformV7ShipmentGateStatus): PlatformV7ShipmentGateTone {
  if (status === 'ready') return 'success';
  if (status === 'review') return 'warning';
  return 'danger';
}

export function platformV7ShipmentGateNextAction(
  status: PlatformV7ShipmentGateStatus,
  blockers: string[],
  reviewReasons: string[],
): string {
  if (status === 'ready') return 'Рейс подтверждён, транспортный блокер снят.';
  if (status === 'blocked') return blockers[0] ? `Остановить выпуск: ${blockers[0]}.` : 'Остановить выпуск до снятия транспортных блокеров.';
  return reviewReasons[0] ? `Передать рейс на проверку: ${reviewReasons[0]}.` : 'Передать рейс на проверку оператора.';
}
