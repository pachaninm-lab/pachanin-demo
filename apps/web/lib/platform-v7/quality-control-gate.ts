export type PlatformV7QualityGateStatus = 'ready' | 'review' | 'blocked';
export type PlatformV7QualityGateTone = 'success' | 'warning' | 'danger';
export type PlatformV7CropKind = 'wheat' | 'barley' | 'corn' | 'sunflower' | 'soybean' | 'other';
export type PlatformV7QualityParameterStatus = 'missing' | 'within_contract' | 'within_tolerance' | 'discount_required' | 'rejected';
export type PlatformV7QualityProtocolStatus = 'missing' | 'draft' | 'issued' | 'signed' | 'linked' | 'rejected';
export type PlatformV7QualityMoneyImpact = 'hold' | 'partial_release' | 'release_allowed';

export interface PlatformV7QualityParameterInput {
  code: string;
  title: string;
  status: PlatformV7QualityParameterStatus;
  actualValue?: number;
  contractMin?: number;
  contractMax?: number;
  unit?: string;
}

export interface PlatformV7QualityControlGateInput {
  qualityId: string;
  dealId: string;
  shipmentId: string;
  cropKind: PlatformV7CropKind;
  protocolStatus: PlatformV7QualityProtocolStatus;
  protocolSignedBy: string[];
  parameters: PlatformV7QualityParameterInput[];
  requiredParameterCodes: string[];
  discountAccepted: boolean;
  receiverConfirmed: boolean;
  activeDispute: boolean;
  manualHold: boolean;
}

export interface PlatformV7QualityControlGateModel {
  qualityId: string;
  dealId: string;
  shipmentId: string;
  cropKind: PlatformV7CropKind;
  status: PlatformV7QualityGateStatus;
  tone: PlatformV7QualityGateTone;
  moneyImpact: PlatformV7QualityMoneyImpact;
  canReleaseMoney: boolean;
  missingRequiredCodes: string[];
  failedParameterCodes: string[];
  discountParameterCodes: string[];
  blockerCount: number;
  blockers: string[];
  reviewReasons: string[];
  nextAction: string;
}

export function platformV7QualityControlGateModel(input: PlatformV7QualityControlGateInput): PlatformV7QualityControlGateModel {
  const missingRequiredCodes = platformV7QualityMissingRequiredCodes(input.parameters, input.requiredParameterCodes);
  const failedParameterCodes = input.parameters.filter((parameter) => parameter.status === 'rejected').map((parameter) => parameter.code).sort();
  const discountParameterCodes = input.parameters.filter((parameter) => parameter.status === 'discount_required').map((parameter) => parameter.code).sort();
  const blockers = platformV7QualityControlBlockers(input, missingRequiredCodes, failedParameterCodes);
  const reviewReasons = platformV7QualityControlReviewReasons(input, discountParameterCodes);
  const status = platformV7QualityControlStatus(blockers, reviewReasons);
  const moneyImpact = platformV7QualityMoneyImpact(status, discountParameterCodes);

  return {
    qualityId: input.qualityId,
    dealId: input.dealId,
    shipmentId: input.shipmentId,
    cropKind: input.cropKind,
    status,
    tone: platformV7QualityControlTone(status),
    moneyImpact,
    canReleaseMoney: moneyImpact === 'release_allowed',
    missingRequiredCodes,
    failedParameterCodes,
    discountParameterCodes,
    blockerCount: blockers.length,
    blockers,
    reviewReasons,
    nextAction: platformV7QualityControlNextAction(status, blockers, reviewReasons),
  };
}

export function platformV7QualityMissingRequiredCodes(
  parameters: PlatformV7QualityParameterInput[],
  requiredParameterCodes: string[],
): string[] {
  const presentCodes = new Set(parameters.filter((parameter) => parameter.status !== 'missing').map((parameter) => parameter.code));
  return [...new Set(requiredParameterCodes)].filter((code) => !presentCodes.has(code)).sort();
}

export function platformV7QualityControlBlockers(
  input: PlatformV7QualityControlGateInput,
  missingRequiredCodes: string[],
  failedParameterCodes: string[],
): string[] {
  const blockers: string[] = [];

  if (input.manualHold) blockers.push('manual-hold');
  if (input.activeDispute) blockers.push('active-dispute');
  if (!input.receiverConfirmed) blockers.push('receiver-not-confirmed');
  if (input.protocolStatus === 'missing') blockers.push('quality-protocol-missing');
  if (input.protocolStatus === 'rejected') blockers.push('quality-protocol-rejected');
  if (input.protocolSignedBy.length === 0) blockers.push('quality-protocol-not-signed');
  missingRequiredCodes.forEach((code) => blockers.push(`required-parameter-missing:${code}`));
  failedParameterCodes.forEach((code) => blockers.push(`parameter-rejected:${code}`));

  return [...new Set(blockers)];
}

export function platformV7QualityControlReviewReasons(
  input: PlatformV7QualityControlGateInput,
  discountParameterCodes: string[],
): string[] {
  const reasons: string[] = [];

  if (input.protocolStatus === 'draft' || input.protocolStatus === 'issued' || input.protocolStatus === 'signed') reasons.push(`quality-protocol:${input.protocolStatus}`);
  input.parameters.filter((parameter) => parameter.status === 'within_tolerance').forEach((parameter) => reasons.push(`parameter-within-tolerance:${parameter.code}`));
  discountParameterCodes.forEach((code) => reasons.push(`discount-required:${code}`));
  if (discountParameterCodes.length > 0 && !input.discountAccepted) reasons.push('discount-not-accepted');

  return [...new Set(reasons)];
}

export function platformV7QualityControlStatus(
  blockers: string[],
  reviewReasons: string[],
): PlatformV7QualityGateStatus {
  if (blockers.length > 0) return 'blocked';
  if (reviewReasons.length > 0) return 'review';
  return 'ready';
}

export function platformV7QualityMoneyImpact(
  status: PlatformV7QualityGateStatus,
  discountParameterCodes: string[],
): PlatformV7QualityMoneyImpact {
  if (status === 'blocked') return 'hold';
  if (status === 'review' || discountParameterCodes.length > 0) return 'partial_release';
  return 'release_allowed';
}

export function platformV7QualityControlTone(status: PlatformV7QualityGateStatus): PlatformV7QualityGateTone {
  if (status === 'ready') return 'success';
  if (status === 'review') return 'warning';
  return 'danger';
}

export function platformV7QualityControlNextAction(
  status: PlatformV7QualityGateStatus,
  blockers: string[],
  reviewReasons: string[],
): string {
  if (status === 'ready') return 'Качество подтверждено, блокер качества снят.';
  if (status === 'blocked') return blockers[0] ? `Остановить выпуск: ${blockers[0]}.` : 'Остановить выпуск до закрытия качества.';
  return reviewReasons[0] ? `Передать качество на проверку: ${reviewReasons[0]}.` : 'Передать качество на проверку оператора.';
}

export function platformV7QualityControlStableKey(input: PlatformV7QualityControlGateInput): string {
  return `${input.dealId}:${input.shipmentId}:${input.cropKind}:${input.requiredParameterCodes.sort().join('|')}`;
}
