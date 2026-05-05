import { EntityId, IsoDateTime, RiskLevel, clampScore, riskLevelFromScore } from './core-types';

export type CounterpartyRedFlagType =
  | 'bankruptcy_risk'
  | 'liquidation_risk'
  | 'court_risk'
  | 'enforcement_risk'
  | 'tax_risk'
  | 'mass_address'
  | 'invalid_registration'
  | 'payment_delay_history'
  | 'document_delay_history'
  | 'frequent_disputes'
  | 'quality_mismatch_history'
  | 'weight_mismatch_history'
  | 'manual_review_required';

export interface CounterpartyRedFlag {
  id: EntityId;
  counterpartyId: EntityId;
  type: CounterpartyRedFlagType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  source: 'platform_history' | 'kontur_focus' | 'dadata' | 'bank' | 'operator' | 'manual' | 'simulation';
  affectsDealAdmission: boolean;
  affectsPaymentTerms: boolean;
  requiresManualReview: boolean;
  createdAt: IsoDateTime;
}

export interface BuyerReliabilityScore {
  buyerId: EntityId;
  totalScore: number;
  identityScore: number;
  legalScore: number;
  financialScore: number;
  paymentDisciplineScore: number;
  documentDisciplineScore: number;
  disputeScore: number;
  platformHistoryScore: number;
  counterpartyRatingScore: number;
  riskLevel: RiskLevel;
  redFlags: CounterpartyRedFlag[];
  updatedAt: IsoDateTime;
}

export interface SellerReliabilityScore {
  sellerId: EntityId;
  totalScore: number;
  identityScore: number;
  legalScore: number;
  batchAccuracyScore: number;
  qualityAccuracyScore: number;
  weightAccuracyScore: number;
  shipmentDisciplineScore: number;
  documentDisciplineScore: number;
  sdizDisciplineScore: number;
  disputeScore: number;
  platformHistoryScore: number;
  counterpartyRatingScore: number;
  riskLevel: RiskLevel;
  redFlags: CounterpartyRedFlag[];
  updatedAt: IsoDateTime;
}

export interface DealReview {
  id: EntityId;
  dealId: EntityId;
  reviewerId: EntityId;
  reviewerRole: 'seller' | 'buyer';
  reviewedPartyId: EntityId;
  reviewedPartyRole: 'seller' | 'buyer';
  scores: Record<string, number | undefined>;
  wouldTradeAgain: boolean;
  comment?: string;
  status: 'draft' | 'submitted' | 'published' | 'under_moderation' | 'hidden';
  createdAt: IsoDateTime;
}

const severityPenalty = { info: 3, warning: 9, critical: 22 } as const;

function redFlagPenalty(redFlags: CounterpartyRedFlag[]): number {
  return redFlags.reduce((sum, flag) => sum + severityPenalty[flag.severity], 0);
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function calculateBuyerReliabilityScore(input: Omit<BuyerReliabilityScore, 'totalScore' | 'riskLevel'>): BuyerReliabilityScore {
  const weighted =
    input.identityScore * 0.12 +
    input.legalScore * 0.12 +
    input.financialScore * 0.16 +
    input.paymentDisciplineScore * 0.2 +
    input.documentDisciplineScore * 0.12 +
    input.disputeScore * 0.1 +
    input.platformHistoryScore * 0.1 +
    input.counterpartyRatingScore * 0.08;
  const totalScore = clampScore(weighted - redFlagPenalty(input.redFlags));
  return { ...input, totalScore, riskLevel: riskLevelFromScore(totalScore) };
}

export function calculateSellerReliabilityScore(input: Omit<SellerReliabilityScore, 'totalScore' | 'riskLevel'>): SellerReliabilityScore {
  const weighted =
    input.identityScore * 0.1 +
    input.legalScore * 0.1 +
    input.batchAccuracyScore * 0.12 +
    input.qualityAccuracyScore * 0.14 +
    input.weightAccuracyScore * 0.12 +
    input.shipmentDisciplineScore * 0.1 +
    input.documentDisciplineScore * 0.1 +
    input.sdizDisciplineScore * 0.08 +
    input.disputeScore * 0.07 +
    input.platformHistoryScore * 0.05 +
    input.counterpartyRatingScore * 0.02;
  const totalScore = clampScore(weighted - redFlagPenalty(input.redFlags));
  return { ...input, totalScore, riskLevel: riskLevelFromScore(totalScore) };
}

export function calculateReviewScore(review: DealReview): number {
  const values = Object.values(review.scores).filter((score): score is number => typeof score === 'number');
  const base = average(values) * 20;
  return clampScore(review.wouldTradeAgain ? base + 5 : base - 10);
}

export function ratingAdmission(score: number): { label: string; requiresManualReview: boolean; automaticAdmission: boolean } {
  if (score >= 90) return { label: 'Высокая надёжность', requiresManualReview: false, automaticAdmission: true };
  if (score >= 75) return { label: 'Стандартный допуск', requiresManualReview: false, automaticAdmission: true };
  if (score >= 60) return { label: 'Средний риск', requiresManualReview: true, automaticAdmission: true };
  if (score >= 40) return { label: 'Высокий риск', requiresManualReview: true, automaticAdmission: false };
  return { label: 'Критический риск', requiresManualReview: true, automaticAdmission: false };
}
