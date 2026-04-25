import type { PlatformV7OnboardingAccessGateModel } from './onboarding-access-gate';
import type { PlatformV7OnboardingDocumentsModel } from './onboarding-documents';
import type { PlatformV7OnboardingKycModel, PlatformV7OnboardingRole } from './onboarding-kyc';

export type PlatformV7OnboardingRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PlatformV7OnboardingRiskTone = 'success' | 'warning' | 'danger';

export interface PlatformV7OnboardingRiskSignals {
  taxDebt: boolean;
  massRegistration: boolean;
  recentDirectorChange: boolean;
  sanctionsHit: boolean;
  amlHit: boolean;
  documentMismatch: boolean;
  bankAccountMismatch: boolean;
  beneficialOwnerUnverified: boolean;
  offPlatformSuspicion: boolean;
  previousDisputeCount: number;
}

export interface PlatformV7OnboardingRiskScoreInput {
  companyId: string;
  role: PlatformV7OnboardingRole;
  kyc: PlatformV7OnboardingKycModel;
  documents: PlatformV7OnboardingDocumentsModel;
  access: PlatformV7OnboardingAccessGateModel;
  signals: PlatformV7OnboardingRiskSignals;
}

export interface PlatformV7OnboardingRiskScoreModel {
  companyId: string;
  role: PlatformV7OnboardingRole;
  score: number;
  level: PlatformV7OnboardingRiskLevel;
  blocksAutoApproval: boolean;
  requiresManualReview: boolean;
  reasons: string[];
  nextAction: string;
  tone: PlatformV7OnboardingRiskTone;
}

export function platformV7OnboardingRiskScoreModel(
  input: PlatformV7OnboardingRiskScoreInput,
): PlatformV7OnboardingRiskScoreModel {
  const reasons = platformV7OnboardingRiskReasons(input);
  const score = platformV7OnboardingRiskScore(input, reasons.length);
  const level = platformV7OnboardingRiskLevel(score, input.signals.sanctionsHit || input.signals.amlHit);
  const blocksAutoApproval = level === 'high' || level === 'critical' || input.kyc.status === 'rejected' || input.kyc.status === 'restricted';
  const requiresManualReview = blocksAutoApproval || level === 'medium' || input.kyc.status === 'manual_review' || input.access.status === 'manual_review';

  return {
    companyId: input.companyId,
    role: input.role,
    score,
    level,
    blocksAutoApproval,
    requiresManualReview,
    reasons,
    nextAction: platformV7OnboardingRiskNextAction(level, blocksAutoApproval, reasons),
    tone: platformV7OnboardingRiskTone(level),
  };
}

export function platformV7OnboardingRiskReasons(input: PlatformV7OnboardingRiskScoreInput): string[] {
  const reasons: string[] = [];

  if (input.kyc.status === 'rejected') reasons.push('kyc-rejected');
  if (input.kyc.status === 'restricted') reasons.push('kyc-restricted');
  if (input.kyc.status === 'manual_review') reasons.push('kyc-manual-review');
  if (input.documents.blockerCount > 0) reasons.push('document-blockers');
  if (input.access.status === 'blocked') reasons.push('access-blocked');
  if (input.access.status === 'restricted') reasons.push('access-restricted');
  if (input.signals.taxDebt) reasons.push('tax-debt');
  if (input.signals.massRegistration) reasons.push('mass-registration');
  if (input.signals.recentDirectorChange) reasons.push('recent-director-change');
  if (input.signals.sanctionsHit) reasons.push('sanctions-hit');
  if (input.signals.amlHit) reasons.push('aml-hit');
  if (input.signals.documentMismatch) reasons.push('document-mismatch');
  if (input.signals.bankAccountMismatch) reasons.push('bank-account-mismatch');
  if (input.signals.beneficialOwnerUnverified) reasons.push('beneficial-owner-unverified');
  if (input.signals.offPlatformSuspicion) reasons.push('off-platform-suspicion');
  if (input.signals.previousDisputeCount > 0) reasons.push('previous-disputes');

  return [...new Set(reasons)];
}

export function platformV7OnboardingRiskScore(
  input: PlatformV7OnboardingRiskScoreInput,
  reasonCount = platformV7OnboardingRiskReasons(input).length,
): number {
  const signalScore = [
    input.signals.taxDebt ? 12 : 0,
    input.signals.massRegistration ? 10 : 0,
    input.signals.recentDirectorChange ? 6 : 0,
    input.signals.sanctionsHit ? 100 : 0,
    input.signals.amlHit ? 100 : 0,
    input.signals.documentMismatch ? 18 : 0,
    input.signals.bankAccountMismatch ? 20 : 0,
    input.signals.beneficialOwnerUnverified ? 15 : 0,
    input.signals.offPlatformSuspicion ? 12 : 0,
    Math.min(20, Math.max(0, input.signals.previousDisputeCount) * 5),
  ].reduce((sum, value) => sum + value, 0);

  const kycScore = input.kyc.status === 'approved'
    ? 0
    : input.kyc.status === 'manual_review'
      ? 18
      : input.kyc.status === 'restricted' || input.kyc.status === 'rejected'
        ? 100
        : 12;
  const documentScore = Math.min(25, input.documents.blockerCount * 7);
  const accessScore = input.access.status === 'allowed' ? 0 : input.access.status === 'manual_review' ? 15 : 20;
  const readinessPenalty = Math.max(0, 100 - Math.round((input.kyc.readinessPercent + input.documents.readinessPercent) / 2)) / 4;

  return Math.min(100, Math.round(signalScore + kycScore + documentScore + accessScore + readinessPenalty + reasonCount));
}

export function platformV7OnboardingRiskLevel(score: number, hasCriticalHit = false): PlatformV7OnboardingRiskLevel {
  if (hasCriticalHit || score >= 85) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

export function platformV7OnboardingRiskTone(level: PlatformV7OnboardingRiskLevel): PlatformV7OnboardingRiskTone {
  if (level === 'low') return 'success';
  if (level === 'medium') return 'warning';
  return 'danger';
}

export function platformV7OnboardingRiskNextAction(
  level: PlatformV7OnboardingRiskLevel,
  blocksAutoApproval: boolean,
  reasons: string[],
): string {
  if (level === 'low') return 'Автодопуск возможен после стандартной проверки.';
  if (blocksAutoApproval) return reasons[0] ? `Остановить автодопуск: ${reasons[0]}.` : 'Остановить автодопуск до проверки риска.';
  return reasons[0] ? `Передать риск на ручную проверку: ${reasons[0]}.` : 'Передать риск на ручную проверку.';
}
