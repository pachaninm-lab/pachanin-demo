export type PlatformV7QualityDiscountStatus = 'ready' | 'review' | 'blocked';
export type PlatformV7QualityDiscountTone = 'success' | 'warning' | 'danger';
export type PlatformV7QualityDiscountBasis = 'protein' | 'moisture' | 'foreign_matter' | 'gluten' | 'falling_number' | 'oil_content' | 'custom';
export type PlatformV7QualityDiscountType = 'percent' | 'amount_per_ton';

export interface PlatformV7QualityDiscountLineInput {
  id: string;
  basis: PlatformV7QualityDiscountBasis;
  title: string;
  type: PlatformV7QualityDiscountType;
  value: number;
  approved: boolean;
  requiresManualApproval: boolean;
}

export interface PlatformV7QualityDiscountInput {
  dealId: string;
  shipmentId: string;
  grossAmount: number;
  tonnage: number;
  currency: 'RUB';
  maxAutoDiscountPercent: number;
  lines: PlatformV7QualityDiscountLineInput[];
  activeDispute: boolean;
  manualHold: boolean;
}

export interface PlatformV7QualityDiscountLineModel extends PlatformV7QualityDiscountLineInput {
  discountAmount: number;
}

export interface PlatformV7QualityDiscountModel {
  dealId: string;
  shipmentId: string;
  status: PlatformV7QualityDiscountStatus;
  tone: PlatformV7QualityDiscountTone;
  grossAmount: number;
  totalDiscountAmount: number;
  totalDiscountPercent: number;
  netPayableAmount: number;
  canApplyAutomatically: boolean;
  lineCount: number;
  lines: PlatformV7QualityDiscountLineModel[];
  blockerCount: number;
  blockers: string[];
  reviewReasons: string[];
  nextAction: string;
}

export function platformV7QualityDiscountModel(input: PlatformV7QualityDiscountInput): PlatformV7QualityDiscountModel {
  const lines = input.lines.map((line) => platformV7QualityDiscountLineModel(line, input.grossAmount, input.tonnage));
  const totalDiscountAmount = platformV7QualityDiscountTotal(lines);
  const totalDiscountPercent = input.grossAmount > 0 ? (totalDiscountAmount / input.grossAmount) * 100 : 0;
  const netPayableAmount = input.grossAmount - totalDiscountAmount;
  const blockers = platformV7QualityDiscountBlockers(input, lines, netPayableAmount);
  const reviewReasons = platformV7QualityDiscountReviewReasons(input, lines, totalDiscountPercent);
  const status = platformV7QualityDiscountStatus(blockers, reviewReasons);

  return {
    dealId: input.dealId,
    shipmentId: input.shipmentId,
    status,
    tone: platformV7QualityDiscountTone(status),
    grossAmount: input.grossAmount,
    totalDiscountAmount,
    totalDiscountPercent,
    netPayableAmount,
    canApplyAutomatically: status === 'ready',
    lineCount: lines.length,
    lines,
    blockerCount: blockers.length,
    blockers,
    reviewReasons,
    nextAction: platformV7QualityDiscountNextAction(status, blockers, reviewReasons),
  };
}

export function platformV7QualityDiscountLineModel(
  line: PlatformV7QualityDiscountLineInput,
  grossAmount: number,
  tonnage: number,
): PlatformV7QualityDiscountLineModel {
  const discountAmount = line.type === 'percent'
    ? (grossAmount * line.value) / 100
    : line.value * tonnage;

  return {
    ...line,
    discountAmount: platformV7QualityDiscountRound(discountAmount),
  };
}

export function platformV7QualityDiscountTotal(lines: PlatformV7QualityDiscountLineModel[]): number {
  return platformV7QualityDiscountRound(lines.reduce((sum, line) => sum + line.discountAmount, 0));
}

export function platformV7QualityDiscountBlockers(
  input: PlatformV7QualityDiscountInput,
  lines: PlatformV7QualityDiscountLineModel[],
  netPayableAmount: number,
): string[] {
  const blockers: string[] = [];

  if (input.manualHold) blockers.push('manual-hold');
  if (input.activeDispute) blockers.push('active-dispute');
  if (input.grossAmount <= 0) blockers.push('invalid-gross-amount');
  if (input.tonnage <= 0) blockers.push('invalid-tonnage');
  if (netPayableAmount < 0) blockers.push('negative-net-payable');
  lines.filter((line) => line.value < 0).forEach((line) => blockers.push(`negative-discount:${line.id}`));

  return [...new Set(blockers)];
}

export function platformV7QualityDiscountReviewReasons(
  input: PlatformV7QualityDiscountInput,
  lines: PlatformV7QualityDiscountLineModel[],
  totalDiscountPercent: number,
): string[] {
  const reasons: string[] = [];

  lines.filter((line) => line.requiresManualApproval && !line.approved).forEach((line) => reasons.push(`manual-approval-required:${line.id}`));
  lines.filter((line) => !line.approved).forEach((line) => reasons.push(`discount-not-approved:${line.id}`));
  if (totalDiscountPercent > input.maxAutoDiscountPercent) reasons.push('discount-over-auto-limit');

  return [...new Set(reasons)];
}

export function platformV7QualityDiscountStatus(
  blockers: string[],
  reviewReasons: string[],
): PlatformV7QualityDiscountStatus {
  if (blockers.length > 0) return 'blocked';
  if (reviewReasons.length > 0) return 'review';
  return 'ready';
}

export function platformV7QualityDiscountTone(status: PlatformV7QualityDiscountStatus): PlatformV7QualityDiscountTone {
  if (status === 'ready') return 'success';
  if (status === 'review') return 'warning';
  return 'danger';
}

export function platformV7QualityDiscountNextAction(
  status: PlatformV7QualityDiscountStatus,
  blockers: string[],
  reviewReasons: string[],
): string {
  if (status === 'ready') return 'Скидка по качеству готова к применению.';
  if (status === 'blocked') return blockers[0] ? `Остановить скидку: ${blockers[0]}.` : 'Остановить скидку до снятия блокеров.';
  return reviewReasons[0] ? `Подтвердить скидку: ${reviewReasons[0]}.` : 'Передать скидку по качеству на ручное подтверждение.';
}

export function platformV7QualityDiscountRound(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function platformV7QualityDiscountStableKey(input: PlatformV7QualityDiscountInput): string {
  return `${input.dealId}:${input.shipmentId}:${input.grossAmount}:${input.tonnage}:${input.lines.map((line) => line.id).sort().join('|')}`;
}
