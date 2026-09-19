import { DealDraft, Offer, nowIso } from './core-types';
import { createAuditEvent } from './audit-events';

export interface DealDraftGuardResult {
  ready: boolean;
  blockers: string[];
  status: DealDraft['status'];
}

export function createDealDraftFromAcceptedOffer(offer: Offer): DealDraft {
  if (offer.status !== 'accepted') throw new Error('DealDraft can only be created from an accepted offer');
  return {
    id: `DD-${offer.id}`,
    acceptedOfferId: offer.id,
    sellerId: offer.sellerId,
    buyerId: offer.buyerId,
    batchId: offer.batchId,
    lotId: offer.lotId,
    rfqId: offer.rfqId,
    pricePerTon: offer.pricePerTon,
    volumeTons: offer.volumeTons,
    moneyPlanReady: false,
    documentPlanReady: false,
    logisticsPlanReady: false,
    sdizStatus: 'simulation',
    complianceStop: false,
    bypassStop: false,
    status: 'created',
    blockers: ['money_plan', 'document_plan', 'logistics_plan'],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function evaluateDealDraftGuards(draft: DealDraft): DealDraftGuardResult {
  const blockers: string[] = [];
  if (!draft.moneyPlanReady) blockers.push('money_plan');
  if (!draft.documentPlanReady) blockers.push('document_plan');
  if (!draft.logisticsPlanReady) blockers.push('logistics_plan');
  if (draft.sdizStatus === 'blocked') blockers.push('sdiz');
  if (draft.complianceStop) blockers.push('compliance');
  if (draft.bypassStop) blockers.push('anti_bypass');
  const ready = blockers.length === 0;
  const status: DealDraft['status'] = ready ? 'ready_for_execution' : 'blocked';
  return { ready, blockers, status };
}

export function updateDealDraftReadiness(draft: DealDraft, actorId: string): { draft: DealDraft; auditEvent: ReturnType<typeof createAuditEvent> } {
  const guard = evaluateDealDraftGuards(draft);
  const nextDraft: DealDraft = {
    ...draft,
    status: guard.status,
    blockers: guard.blockers,
    updatedAt: nowIso(),
  };
  return {
    draft: nextDraft,
    auditEvent: createAuditEvent({
      entityType: 'deal_draft',
      entityId: draft.id,
      actorRole: 'operator',
      actorId,
      action: 'deal_draft_guard_evaluated',
      before: { status: draft.status, blockers: draft.blockers },
      after: { status: nextDraft.status, blockers: nextDraft.blockers },
    }),
  };
}
