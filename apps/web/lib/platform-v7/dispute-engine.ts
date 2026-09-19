export type PlatformV7DisputeType = 'weight' | 'quality' | 'documents' | 'logistics' | 'sdiz' | 'epd' | 'payment' | 'mixed';
export type PlatformV7DisputeStatus = 'none' | 'claim_created' | 'evidence_collection' | 'under_review' | 'decision_pending' | 'decision_issued' | 'bank_basis_sent' | 'resolved' | 'cancelled';
export type PlatformV7DisputeDecision = 'hold' | 'partial_release' | 'release' | 'manual_review';

export interface PlatformV7DisputeCase {
  readonly disputeId: string;
  readonly dealId: string;
  readonly type: PlatformV7DisputeType;
  readonly status: PlatformV7DisputeStatus;
  readonly reason: string;
  readonly claimAmount: number;
  readonly blockedAmount: number;
  readonly initiatorRole: string;
  readonly respondentRole: string;
  readonly evidenceIds: readonly string[];
  readonly reviewedEvidenceIds: readonly string[];
  readonly deadline: string;
  readonly currentOwner: string;
  readonly decision?: PlatformV7DisputeDecision;
  readonly bankBasisDocumentId?: string;
}

export interface PlatformV7DisputeReadiness {
  readonly canReview: boolean;
  readonly canDecide: boolean;
  readonly missingEvidenceIds: readonly string[];
  readonly moneyHeldAmount: number;
  readonly readyToReleaseAmount: number;
  readonly bankBasisRequired: boolean;
  readonly nextAction: string;
}

export function platformV7DisputeReadiness(dispute: PlatformV7DisputeCase): PlatformV7DisputeReadiness {
  const missingEvidenceIds = dispute.evidenceIds.filter((id) => !dispute.reviewedEvidenceIds.includes(id));
  const canReview = dispute.status === 'under_review' || dispute.status === 'decision_pending';
  const canDecide = canReview && missingEvidenceIds.length === 0 && dispute.evidenceIds.length > 0;
  const moneyHeldAmount = Math.max(0, dispute.blockedAmount);
  const readyToReleaseAmount = dispute.decision === 'partial_release'
    ? Math.max(0, dispute.claimAmount - dispute.blockedAmount)
    : dispute.decision === 'release'
      ? dispute.claimAmount
      : 0;
  const bankBasisRequired = dispute.status === 'decision_issued' && !dispute.bankBasisDocumentId;

  return {
    canReview,
    canDecide,
    missingEvidenceIds,
    moneyHeldAmount,
    readyToReleaseAmount,
    bankBasisRequired,
    nextAction: bankBasisRequired
      ? 'Сформировать основание для банка'
      : canDecide
        ? 'Вынести решение по спору'
        : missingEvidenceIds.length > 0
          ? 'Дособрать доказательства'
          : 'Передать спор на рассмотрение',
  };
}

export function platformV7ApplyDisputeDecision(dispute: PlatformV7DisputeCase, decision: PlatformV7DisputeDecision): PlatformV7DisputeCase {
  if (!platformV7DisputeReadiness(dispute).canDecide) {
    return { ...dispute, decision: 'manual_review', status: 'under_review' };
  }

  return {
    ...dispute,
    decision,
    status: 'decision_issued',
    currentOwner: decision === 'manual_review' ? 'operator' : 'bank',
  };
}

export function platformV7CanSendBankBasis(dispute: PlatformV7DisputeCase): boolean {
  return dispute.status === 'decision_issued' && Boolean(dispute.decision) && Boolean(dispute.bankBasisDocumentId);
}
