import type { Dispute, DisputeDecision, EvidencePack, ExecutionBlocker, MoneyAmount } from '../types';
import { money } from '../format';

export type EvidenceRequirementKey = 'documents' | 'weight' | 'photos' | 'route' | 'lab' | 'sample_chain';

export type EvidencePackReadiness = {
  readonly evidencePackId: string;
  readonly ready: boolean;
  readonly score: number;
  readonly missing: EvidenceRequirementKey[];
  readonly present: EvidenceRequirementKey[];
};

const requirementLabels: Record<EvidenceRequirementKey, string> = {
  documents: 'документы',
  weight: 'весовые доказательства',
  photos: 'фотофиксация',
  route: 'маршрутные события',
  lab: 'лабораторный протокол',
  sample_chain: 'цепочка пробы',
};

export function calculateEvidencePackReadiness(pack: EvidencePack): EvidencePackReadiness {
  const checks: Record<EvidenceRequirementKey, boolean> = {
    documents: pack.documentIds.length > 0,
    weight: pack.weightEvidenceIds.length > 0,
    photos: pack.photoIds.length > 0,
    route: pack.routeEventIds.length > 0,
    lab: pack.labProtocolIds.length > 0,
    sample_chain: pack.sampleChainIds.length > 0,
  };
  const present = Object.entries(checks).filter(([, ready]) => ready).map(([key]) => key as EvidenceRequirementKey);
  const missing = Object.entries(checks).filter(([, ready]) => !ready).map(([key]) => key as EvidenceRequirementKey);

  return {
    evidencePackId: pack.id,
    ready: missing.length === 0,
    score: Math.round((present.length / Object.keys(checks).length) * 100),
    missing,
    present,
  };
}

export function evidencePackBlocker(pack: EvidencePack): ExecutionBlocker | null {
  const readiness = calculateEvidencePackReadiness(pack);
  if (readiness.ready) return null;

  return {
    id: `${pack.id}-dispute-decision-block`,
    type: 'dispute',
    severity: 'critical',
    title: 'Решение по спору закрыто до комплекта доказательств',
    description: `Не хватает: ${readiness.missing.map((item) => requirementLabels[item]).join(', ')}. Решение нельзя считать подготовленным без доказательного пакета.`,
    blocks: 'deal_closing',
    responsibleRole: 'operator',
    relatedEntityType: 'evidence_pack',
    relatedEntityId: pack.id,
  };
}

export function canPrepareDisputeDecision(pack: EvidencePack): boolean {
  return calculateEvidencePackReadiness(pack).ready;
}

export function prepareDisputeDecision(params: {
  readonly dispute: Dispute;
  readonly evidencePack: EvidencePack;
  readonly decision: DisputeDecision['decision'];
  readonly reason: string;
  readonly releaseAmount?: MoneyAmount;
  readonly holdAmount?: MoneyAmount;
  readonly penaltyAmount?: MoneyAmount;
  readonly decidedByName?: string;
  readonly createdAt: string;
}): DisputeDecision | null {
  if (!canPrepareDisputeDecision(params.evidencePack)) return null;

  return {
    id: `DD-${params.dispute.id}`,
    disputeId: params.dispute.id,
    dealId: params.dispute.dealId,
    decision: params.decision,
    reason: params.reason,
    releaseAmount: params.releaseAmount ?? money(0),
    holdAmount: params.holdAmount ?? params.dispute.disputedAmount,
    penaltyAmount: params.penaltyAmount,
    decidedByRole: 'operator',
    decidedByName: params.decidedByName,
    createdAt: params.createdAt,
  };
}
