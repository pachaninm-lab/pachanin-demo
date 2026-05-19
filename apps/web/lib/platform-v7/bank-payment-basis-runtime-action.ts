import { buildPlatformV7RuntimeActionEvent, type PlatformV7RuntimeActionEventResult } from './runtime-action-events';
import type { PlatformV7ExecutionRole } from './execution-action-core';

export interface PlatformV7BankPaymentBasisRuntimeInput {
  readonly actorRole: PlatformV7ExecutionRole;
  readonly dealId: string;
  readonly reason?: string;
  readonly at?: string;
}

export interface PlatformV7BankPaymentBasisRuntimeResult {
  readonly status: 'created' | 'blocked';
  readonly dealId: string;
  readonly event: PlatformV7RuntimeActionEventResult;
  readonly uiStatusLabel: string;
  readonly uiSafetyNote: string;
}

export function buildPlatformV7BankPaymentBasisRuntimeAction(input: PlatformV7BankPaymentBasisRuntimeInput): PlatformV7BankPaymentBasisRuntimeResult {
  const dealId = input.dealId.trim();
  const event = buildPlatformV7RuntimeActionEvent({
    actionId: 'request_bank_payment_basis_review',
    actorRole: input.actorRole,
    targetId: dealId,
    reason: input.reason,
    at: input.at,
  });

  if (event.status === 'blocked') {
    return {
      status: 'blocked',
      dealId,
      event,
      uiStatusLabel: 'основание не передано',
      uiSafetyNote: event.disabledReason,
    };
  }

  return {
    status: 'created',
    dealId,
    event,
    uiStatusLabel: 'основание передано на банковскую проверку',
    uiSafetyNote: 'Платформа создала запрос на проверку основания банком. Это не выпуск денег, не подтверждение выплаты и не замена внешнего банковского события.',
  };
}
