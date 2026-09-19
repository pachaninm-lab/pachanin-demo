import type { Deal, DealStatus, User } from '../types';

export type DealTransitionAction =
  | 'publish_lot'
  | 'receive_offer'
  | 'accept_offer'
  | 'mark_contract_pending'
  | 'sign_contract'
  | 'request_reserve'
  | 'confirm_reserve'
  | 'assign_driver'
  | 'schedule_loading'
  | 'confirm_loading'
  | 'start_transit'
  | 'confirm_arrival'
  | 'complete_weighing'
  | 'sample_lab'
  | 'create_lab_protocol'
  | 'mark_documents_pending'
  | 'complete_documents'
  | 'open_dispute'
  | 'resolve_dispute'
  | 'partial_bank_basis'
  | 'confirm_bank_basis'
  | 'close_deal';

export interface DealTransitionContext {
  actor: User;
  hasIdempotencyKey?: boolean;
  hasRequiredDocuments?: boolean;
  reserveConfirmed?: boolean;
  weightConfirmed?: boolean;
  labConfirmed?: boolean;
  openDispute?: boolean;
  degradationMode?: boolean;
  criticalAuthority?: boolean;
}

export interface DealTransitionResult {
  ok: boolean;
  from: DealStatus;
  to?: DealStatus;
  errorCode?: DealTransitionErrorCode;
  reason?: string;
}

export type DealTransitionErrorCode =
  | 'INVALID_TRANSITION'
  | 'RESERVE_REQUIRED'
  | 'DOCUMENTS_REQUIRED'
  | 'DISPUTE_OPEN'
  | 'WEIGHT_OR_LAB_REQUIRED'
  | 'IDEMPOTENCY_REQUIRED'
  | 'AUTHORITY_REQUIRED'
  | 'DEGRADATION_BLOCKS_FINAL_ACTION';

export const DEAL_STATUSES: DealStatus[] = [
  'draft',
  'lot_published',
  'offer_received',
  'offer_accepted',
  'contract_pending',
  'contract_signed',
  'reserve_requested',
  'reserve_confirmed',
  'driver_assigned',
  'loading_scheduled',
  'loading_confirmed',
  'in_transit',
  'arrived',
  'weighing_completed',
  'lab_sampled',
  'lab_protocol_created',
  'documents_pending',
  'documents_complete',
  'dispute_open',
  'dispute_resolved',
  'partial_bank_basis',
  'bank_basis_confirmed',
  'closed',
];

export const DEAL_TRANSITIONS: Record<DealTransitionAction, { from: DealStatus[]; to: DealStatus }> = {
  publish_lot: { from: ['draft'], to: 'lot_published' },
  receive_offer: { from: ['lot_published'], to: 'offer_received' },
  accept_offer: { from: ['offer_received'], to: 'offer_accepted' },
  mark_contract_pending: { from: ['offer_accepted'], to: 'contract_pending' },
  sign_contract: { from: ['contract_pending'], to: 'contract_signed' },
  request_reserve: { from: ['contract_signed'], to: 'reserve_requested' },
  confirm_reserve: { from: ['reserve_requested'], to: 'reserve_confirmed' },
  assign_driver: { from: ['reserve_confirmed'], to: 'driver_assigned' },
  schedule_loading: { from: ['driver_assigned'], to: 'loading_scheduled' },
  confirm_loading: { from: ['loading_scheduled'], to: 'loading_confirmed' },
  start_transit: { from: ['loading_confirmed'], to: 'in_transit' },
  confirm_arrival: { from: ['in_transit'], to: 'arrived' },
  complete_weighing: { from: ['arrived'], to: 'weighing_completed' },
  sample_lab: { from: ['weighing_completed'], to: 'lab_sampled' },
  create_lab_protocol: { from: ['lab_sampled'], to: 'lab_protocol_created' },
  mark_documents_pending: { from: ['lab_protocol_created'], to: 'documents_pending' },
  complete_documents: { from: ['documents_pending'], to: 'documents_complete' },
  open_dispute: { from: ['weighing_completed', 'lab_sampled', 'lab_protocol_created', 'documents_pending', 'documents_complete'], to: 'dispute_open' },
  resolve_dispute: { from: ['dispute_open'], to: 'dispute_resolved' },
  partial_bank_basis: { from: ['documents_complete', 'dispute_resolved'], to: 'partial_bank_basis' },
  confirm_bank_basis: { from: ['documents_complete', 'partial_bank_basis', 'dispute_resolved'], to: 'bank_basis_confirmed' },
  close_deal: { from: ['bank_basis_confirmed'], to: 'closed' },
};

function guardAuthority(action: DealTransitionAction, ctx: DealTransitionContext): DealTransitionResult | null {
  const criticalActions: DealTransitionAction[] = ['confirm_reserve', 'partial_bank_basis', 'confirm_bank_basis', 'resolve_dispute', 'close_deal'];
  if (criticalActions.includes(action) && ctx.actor.authorityLevel !== 'critical' && !ctx.criticalAuthority) {
    return { ok: false, from: 'draft', errorCode: 'AUTHORITY_REQUIRED', reason: 'Критическое действие требует подтверждённых полномочий.' };
  }
  return null;
}

function guardIdempotency(action: DealTransitionAction, ctx: DealTransitionContext): DealTransitionResult | null {
  const bankActions: DealTransitionAction[] = ['request_reserve', 'confirm_reserve', 'partial_bank_basis', 'confirm_bank_basis'];
  if (bankActions.includes(action) && !ctx.hasIdempotencyKey) {
    return { ok: false, from: 'draft', errorCode: 'IDEMPOTENCY_REQUIRED', reason: 'Банковая mutation требует Idempotency-Key.' };
  }
  return null;
}

function guardMoney(action: DealTransitionAction, deal: Deal, ctx: DealTransitionContext): DealTransitionResult | null {
  if ((action === 'partial_bank_basis' || action === 'confirm_bank_basis') && !(deal.reserveConfirmed || ctx.reserveConfirmed)) {
    return { ok: false, from: deal.status, errorCode: 'RESERVE_REQUIRED', reason: 'Банковское основание невозможно без подтверждённого резерва.' };
  }
  if (action === 'confirm_bank_basis' && !(deal.documentsComplete || ctx.hasRequiredDocuments)) {
    return { ok: false, from: deal.status, errorCode: 'DOCUMENTS_REQUIRED', reason: 'Финальное банковское основание невозможно без полного пакета документов.' };
  }
  if (action === 'confirm_bank_basis' && (deal.openDisputeId || ctx.openDispute)) {
    return { ok: false, from: deal.status, errorCode: 'DISPUTE_OPEN', reason: 'Финальное банковское основание невозможно при открытом споре.' };
  }
  return null;
}

function guardExecution(action: DealTransitionAction, deal: Deal, ctx: DealTransitionContext): DealTransitionResult | null {
  if ((action === 'complete_documents' || action === 'confirm_bank_basis') && !(deal.weightConfirmed || ctx.weightConfirmed) && !(deal.labProtocolId || ctx.labConfirmed)) {
    return { ok: false, from: deal.status, errorCode: 'WEIGHT_OR_LAB_REQUIRED', reason: 'Нельзя закрыть документы или банковское основание без веса и лаборатории.' };
  }
  return null;
}

function guardDegradation(action: DealTransitionAction, deal: Deal, ctx: DealTransitionContext): DealTransitionResult | null {
  if ((action === 'confirm_bank_basis' || action === 'close_deal') && (deal.degradationMode || ctx.degradationMode)) {
    return { ok: false, from: deal.status, errorCode: 'DEGRADATION_BLOCKS_FINAL_ACTION', reason: 'Финальное необратимое действие закрыто в режиме деградации.' };
  }
  return null;
}

export function canTransitionDeal(deal: Deal, action: DealTransitionAction, ctx: DealTransitionContext): DealTransitionResult {
  const transition = DEAL_TRANSITIONS[action];
  if (!transition.from.includes(deal.status)) {
    return { ok: false, from: deal.status, errorCode: 'INVALID_TRANSITION', reason: `Переход ${action} невозможен из статуса ${deal.status}.` };
  }

  for (const guard of [guardAuthority, guardIdempotency]) {
    const blocked = guard(action, ctx);
    if (blocked) return { ...blocked, from: deal.status };
  }

  for (const guard of [guardMoney, guardExecution, guardDegradation]) {
    const blocked = guard(action, deal, ctx);
    if (blocked) return blocked;
  }

  return { ok: true, from: deal.status, to: transition.to };
}

export function transitionDeal(deal: Deal, action: DealTransitionAction, ctx: DealTransitionContext): Deal {
  const result = canTransitionDeal(deal, action, ctx);
  if (!result.ok || !result.to) {
    throw Object.assign(new Error(result.reason ?? 'Invalid deal transition'), { code: result.errorCode, result });
  }

  return {
    ...deal,
    status: result.to,
    updatedAt: new Date().toISOString(),
    reserveConfirmed: action === 'confirm_reserve' ? true : deal.reserveConfirmed,
    weightConfirmed: action === 'complete_weighing' ? true : deal.weightConfirmed,
    documentsComplete: action === 'complete_documents' ? true : deal.documentsComplete,
  };
}
