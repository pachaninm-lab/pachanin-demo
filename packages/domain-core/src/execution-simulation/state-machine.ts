import type { Deal, DealExecutionStatus, Document, DomainExecutionState, PlatformActionCommand, PlatformActionType } from './types';
import { DEAL_EXECUTION_STATUSES } from './types';

export type DealGuardCode =
  | 'NO_RELEASE_WITHOUT_RESERVE'
  | 'NO_RELEASE_WITHOUT_DOCUMENTS'
  | 'NO_FINAL_RELEASE_WITH_OPEN_DISPUTE'
  | 'NO_ACCEPTED_WITHOUT_WEIGHT'
  | 'NO_ACCEPTED_WITHOUT_LAB'
  | 'NO_BANK_COMMAND_WITHOUT_IDEMPOTENCY'
  | 'NO_CRITICAL_ACTION_WITHOUT_AUTHORITY'
  | 'NO_FINAL_CLOSE_DURING_DEGRADATION'
  | 'NO_DRIVER_ASSIGNMENT_WITHOUT_DEAL'
  | 'NO_DISPUTE_WITHOUT_EVIDENCE_OR_REASON';

export interface DealStateTransition {
  from: DealExecutionStatus;
  to: DealExecutionStatus;
  actions: PlatformActionType[];
}

export interface DealGuardError {
  code: DealGuardCode | 'INVALID_TRANSITION';
  message: string;
  statusCode: 409 | 403 | 422;
}

export interface DealTransitionResult {
  ok: boolean;
  deal?: Deal;
  error?: DealGuardError;
}

const authorityByCriticalAction: Record<PlatformActionType, Array<string>> = {
  createLot: ['seller', 'operator', 'admin'],
  publishLot: ['seller', 'operator', 'admin'],
  acceptOffer: ['buyer', 'operator', 'admin'],
  createDeal: ['seller', 'buyer', 'operator', 'admin'],
  requestReserve: ['buyer', 'bank', 'operator', 'admin'],
  confirmReserve: ['bank', 'operator', 'admin'],
  assignDriver: ['logistics', 'operator', 'admin'],
  confirmArrival: ['driver', 'elevator', 'operator', 'admin'],
  createLabProtocol: ['lab', 'operator', 'admin'],
  openDispute: ['seller', 'buyer', 'operator', 'arbitrator', 'admin']
};

export const dealStateTransitions: DealStateTransition[] = [
  { from: 'DRAFT', to: 'OFFER_ACCEPTED', actions: ['acceptOffer'] },
  { from: 'OFFER_ACCEPTED', to: 'DEAL_CREATED', actions: ['createDeal'] },
  { from: 'DEAL_CREATED', to: 'CONTRACT_DRAFTED', actions: ['createDeal'] },
  { from: 'CONTRACT_DRAFTED', to: 'AWAITING_SIGNATURES', actions: ['createDeal'] },
  { from: 'AWAITING_SIGNATURES', to: 'SIGNED', actions: ['createDeal'] },
  { from: 'SIGNED', to: 'RESERVE_REQUESTED', actions: ['requestReserve'] },
  { from: 'RESERVE_REQUESTED', to: 'RESERVE_CONFIRMED', actions: ['confirmReserve'] },
  { from: 'RESERVE_CONFIRMED', to: 'DRIVER_ASSIGNED', actions: ['assignDriver'] },
  { from: 'DRIVER_ASSIGNED', to: 'LOADING_CONFIRMED', actions: ['confirmArrival'] },
  { from: 'LOADING_CONFIRMED', to: 'LOADED', actions: ['confirmArrival'] },
  { from: 'LOADED', to: 'IN_TRANSIT', actions: ['confirmArrival'] },
  { from: 'IN_TRANSIT', to: 'ARRIVED', actions: ['confirmArrival'] },
  { from: 'ARRIVED', to: 'WEIGHING_CONFIRMED', actions: ['confirmArrival'] },
  { from: 'WEIGHING_CONFIRMED', to: 'LAB_SAMPLING', actions: ['createLabProtocol'] },
  { from: 'LAB_SAMPLING', to: 'LAB_PROTOCOL_CREATED', actions: ['createLabProtocol'] },
  { from: 'LAB_PROTOCOL_CREATED', to: 'ACCEPTED', actions: ['createLabProtocol'] },
  { from: 'ACCEPTED', to: 'DOCUMENTS_PENDING', actions: ['createLabProtocol'] },
  { from: 'DOCUMENTS_PENDING', to: 'DOCUMENTS_READY', actions: ['createLabProtocol'] },
  { from: 'DOCUMENTS_READY', to: 'PAYMENT_RELEASE_REQUESTED', actions: ['requestReserve'] },
  { from: 'PAYMENT_RELEASE_REQUESTED', to: 'FINAL_RELEASED', actions: ['confirmReserve'] },
  { from: 'FINAL_RELEASED', to: 'CLOSED', actions: ['confirmReserve'] },
  { from: 'ACCEPTED', to: 'DISPUTE_OPEN', actions: ['openDispute'] },
  { from: 'LAB_PROTOCOL_CREATED', to: 'DISPUTE_OPEN', actions: ['openDispute'] }
];

export function isDealExecutionStatus(value: string): value is DealExecutionStatus {
  return (DEAL_EXECUTION_STATUSES as readonly string[]).includes(value);
}

export function getAllowedNextStatuses(status: DealExecutionStatus): DealExecutionStatus[] {
  return dealStateTransitions.filter((transition) => transition.from === status).map((transition) => transition.to);
}

export function assertDealTransition(from: DealExecutionStatus, to: DealExecutionStatus, actionType: PlatformActionType): DealGuardError | null {
  const transition = dealStateTransitions.find((item) => item.from === from && item.to === to && item.actions.includes(actionType));
  if (transition) return null;

  return {
    code: 'INVALID_TRANSITION',
    message: `Недопустимый переход сделки ${from} -> ${to} для действия ${actionType}`,
    statusCode: 409
  };
}

function hasSignedRequiredDocuments(dealId: string, documents: Document[]) {
  const dealDocs = documents.filter((document) => document.dealId === dealId);
  const requiredTypes = ['contract', 'ttn', 'weighing_act', 'lab_protocol'];
  return requiredTypes.every((type) => dealDocs.some((document) => document.type === type && document.status === 'signed'));
}

export function evaluateDealGuards(
  state: DomainExecutionState,
  deal: Deal,
  to: DealExecutionStatus,
  command: PlatformActionCommand
): DealGuardError | null {
  const authority = authorityByCriticalAction[command.type] || [];
  if (!authority.includes(command.actor.role)) {
    return {
      code: 'NO_CRITICAL_ACTION_WITHOUT_AUTHORITY',
      message: `Роль ${command.actor.role} не имеет права выполнить действие ${command.type}`,
      statusCode: 403
    };
  }

  if ((command.type === 'requestReserve' || command.type === 'confirmReserve') && !command.idempotencyKey) {
    return {
      code: 'NO_BANK_COMMAND_WITHOUT_IDEMPOTENCY',
      message: 'Банковое действие в simulation-grade контуре требует idempotencyKey',
      statusCode: 422
    };
  }

  if ((to === 'PAYMENT_RELEASE_REQUESTED' || to === 'FINAL_RELEASED' || to === 'CLOSED') && !deal.reserveConfirmed) {
    return {
      code: 'NO_RELEASE_WITHOUT_RESERVE',
      message: 'Выпуск средств запрещён без подтверждённого резерва',
      statusCode: 409
    };
  }

  if ((to === 'PAYMENT_RELEASE_REQUESTED' || to === 'FINAL_RELEASED' || to === 'CLOSED') && !deal.requiredDocumentsReady && !hasSignedRequiredDocuments(deal.id, state.documents)) {
    return {
      code: 'NO_RELEASE_WITHOUT_DOCUMENTS',
      message: 'Выпуск средств запрещён без полного документного пакета',
      statusCode: 409
    };
  }

  if ((to === 'FINAL_RELEASED' || to === 'CLOSED') && (deal.openDisputeId || state.disputes.some((dispute) => dispute.dealId === deal.id && !['resolved', 'closed'].includes(dispute.status)))) {
    return {
      code: 'NO_FINAL_RELEASE_WITH_OPEN_DISPUTE',
      message: 'Финальный выпуск запрещён при открытом споре',
      statusCode: 409
    };
  }

  if (to === 'ACCEPTED' && !deal.weightConfirmed) {
    return {
      code: 'NO_ACCEPTED_WITHOUT_WEIGHT',
      message: 'Приёмка запрещена без подтверждённого веса',
      statusCode: 409
    };
  }

  if (to === 'ACCEPTED' && !deal.labProtocolId) {
    return {
      code: 'NO_ACCEPTED_WITHOUT_LAB',
      message: 'Приёмка запрещена без лабораторного протокола',
      statusCode: 409
    };
  }

  if (to === 'CLOSED' && deal.isDegraded) {
    return {
      code: 'NO_FINAL_CLOSE_DURING_DEGRADATION',
      message: 'Финальное закрытие запрещено во время деградации провайдера',
      statusCode: 409
    };
  }

  if (command.type === 'assignDriver' && !deal.id) {
    return {
      code: 'NO_DRIVER_ASSIGNMENT_WITHOUT_DEAL',
      message: 'Нельзя назначить водителя без сделки',
      statusCode: 422
    };
  }

  if (command.type === 'openDispute' && !String(command.payload.reason || '').trim()) {
    return {
      code: 'NO_DISPUTE_WITHOUT_EVIDENCE_OR_REASON',
      message: 'Спор требует основания и доказательного следа',
      statusCode: 422
    };
  }

  return null;
}

export function transitionDeal(
  state: DomainExecutionState,
  deal: Deal,
  to: DealExecutionStatus,
  command: PlatformActionCommand
): DealTransitionResult {
  const transitionError = assertDealTransition(deal.status, to, command.type);
  if (transitionError) return { ok: false, error: transitionError };

  const guardError = evaluateDealGuards(state, deal, to, command);
  if (guardError) return { ok: false, error: guardError };

  return {
    ok: true,
    deal: {
      ...deal,
      status: to,
      updatedAt: command.now || new Date().toISOString(),
      runtimeLabel: command.runtimeLabel || deal.runtimeLabel || 'sandbox'
    }
  };
}
