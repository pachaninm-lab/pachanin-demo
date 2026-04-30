import type { AuditEvent, Deal, User } from '../types';
import { canTransitionDeal, transitionDeal, type DealTransitionAction } from '../state-machine/dealStateMachine';

export type PlatformActionId =
  | 'create_lot'
  | 'publish_lot'
  | 'accept_offer'
  | 'create_deal'
  | 'request_reserve'
  | 'confirm_reserve'
  | 'assign_driver'
  | 'confirm_arrival'
  | 'create_lab_protocol'
  | 'open_dispute';

export interface PlatformActionInput {
  actionId: PlatformActionId;
  deal: Deal;
  actor: User;
  idempotencyKey?: string;
  now?: string;
}

export interface PlatformActionOutput {
  ok: boolean;
  before: Deal;
  after?: Deal;
  auditEvent?: AuditEvent;
  toast: { type: 'success' | 'warning'; message: string };
  disabledReason?: string;
}

const ACTION_TO_TRANSITION: Record<PlatformActionId, DealTransitionAction | null> = {
  create_lot: null,
  publish_lot: 'publish_lot',
  accept_offer: 'accept_offer',
  create_deal: 'mark_contract_pending',
  request_reserve: 'request_reserve',
  confirm_reserve: 'confirm_reserve',
  assign_driver: 'assign_driver',
  confirm_arrival: 'confirm_arrival',
  create_lab_protocol: 'create_lab_protocol',
  open_dispute: 'open_dispute',
};

const ACTION_LABELS: Record<PlatformActionId, string> = {
  create_lot: 'Создан черновик лота',
  publish_lot: 'Лот опубликован в песочнице',
  accept_offer: 'Оффер принят как основание сделки',
  create_deal: 'Создана карточка сделки',
  request_reserve: 'Запрошен резерв средств',
  confirm_reserve: 'Резерв средств подтверждён',
  assign_driver: 'Водитель назначен',
  confirm_arrival: 'Прибытие подтверждено',
  create_lab_protocol: 'Лабораторный протокол создан',
  open_dispute: 'Открыт спор и удержание',
};

export function runPlatformAction(input: PlatformActionInput): PlatformActionOutput {
  const createdAt = input.now ?? new Date().toISOString();
  const transition = ACTION_TO_TRANSITION[input.actionId];
  const after = transition
    ? transitionDeal(input.deal, transition, {
        actor: input.actor,
        hasIdempotencyKey: Boolean(input.idempotencyKey),
        reserveConfirmed: input.deal.reserveConfirmed,
        hasRequiredDocuments: input.deal.documentsComplete,
        weightConfirmed: input.deal.weightConfirmed,
        labConfirmed: Boolean(input.deal.labProtocolId),
        openDispute: Boolean(input.deal.openDisputeId),
        degradationMode: input.deal.degradationMode,
      })
    : { ...input.deal };

  if (transition) {
    const check = canTransitionDeal(input.deal, transition, {
      actor: input.actor,
      hasIdempotencyKey: Boolean(input.idempotencyKey),
      reserveConfirmed: input.deal.reserveConfirmed,
      hasRequiredDocuments: input.deal.documentsComplete,
      weightConfirmed: input.deal.weightConfirmed,
      labConfirmed: Boolean(input.deal.labProtocolId),
      openDispute: Boolean(input.deal.openDisputeId),
      degradationMode: input.deal.degradationMode,
    });

    if (!check.ok) {
      return {
        ok: false,
        before: input.deal,
        toast: { type: 'warning', message: check.reason ?? 'Действие сейчас недоступно' },
        disabledReason: check.reason,
      };
    }
  }

  const stampedAfter = { ...after, updatedAt: createdAt };
  return {
    ok: true,
    before: input.deal,
    after: stampedAfter,
    auditEvent: {
      id: `AUD-${input.actionId}-${input.deal.id}-${createdAt}`,
      actorUserId: input.actor.id,
      action: input.actionId,
      objectType: 'deal',
      objectId: input.deal.id,
      before: { status: input.deal.status },
      after: { status: stampedAfter.status },
      idempotencyKey: input.idempotencyKey,
      createdAt,
    },
    toast: { type: 'success', message: ACTION_LABELS[input.actionId] },
  };
}
