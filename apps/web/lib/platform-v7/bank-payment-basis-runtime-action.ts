// evaluateReleaseGuard(deal) → check.canRequestRelease + check.canExecuteRelease → buildPlatformV7RuntimeActionEvent
import { evaluateReleaseGuard, type ReleaseGuardBlocker } from './domain/release-guard';
import { buildPlatformV7RuntimeActionEvent, type PlatformV7RuntimeActionEventResult } from './runtime-action-events';
import type { PlatformV7ExecutionRole } from './execution-action-core';
import { canonicalDomainDeals } from '@/lib/domain/selectors';

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

const BLOCKER_LABELS: Partial<Record<ReleaseGuardBlocker, string>> = {
  FGIS_NOT_READY: 'ФГИС/СДИЗ',
  QUALITY_NOT_APPROVED: 'качество',
  TRANSPORT_NOT_READY: 'логистика',
  DOCUMENTS_NOT_READY: 'документы',
  HOLD_AMOUNT_ACTIVE: 'удержание',
  OPEN_DISPUTE: 'спор',
  NO_RESERVED_MONEY: 'резерв',
  NO_RELEASE_AMOUNT: 'сумма основания',
  DEAL_NOT_READY: 'статус сделки',
  ACCEPTANCE_NOT_CONFIRMED: 'приёмка',
  MANUAL_BLOCKER: 'ручной блокер',
};

function buildReleaseGuardNote(blockers: readonly ReleaseGuardBlocker[]): string {
  const labels = blockers.map((b) => BLOCKER_LABELS[b] ?? b).filter(Boolean);
  return `Основание для банковской проверки заблокировано. Не закрыты: ${labels.join(', ')}. Устраните блокеры и повторите передачу основания.`;
}

export function buildPlatformV7BankPaymentBasisRuntimeAction(input: PlatformV7BankPaymentBasisRuntimeInput): PlatformV7BankPaymentBasisRuntimeResult {
  const dealId = input.dealId.trim();

  if (!dealId) {
    return blockedResult(input, dealId, 'основание не передано', 'Не выбрана сделка для банковской проверки основания.');
  }

  const deal = canonicalDomainDeals.find((entry) => entry.id === dealId);

  if (!deal) {
    return blockedResult(input, dealId, 'основание не передано', `Основание для банковской проверки заблокировано: сделка ${dealId} не найдена в контуре исполнения.`);
  }

  const check = evaluateReleaseGuard(deal);

  if (!check.canRequestRelease) {
    return blockedResult(input, dealId, 'основание не передано', buildReleaseGuardNote(check.blockers));
  }

  void check.canExecuteRelease;

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

function blockedResult(
  input: PlatformV7BankPaymentBasisRuntimeInput,
  dealId: string,
  uiStatusLabel: string,
  uiSafetyNote: string,
): PlatformV7BankPaymentBasisRuntimeResult {
  return {
    status: 'blocked',
    dealId,
    event: {
      status: 'blocked',
      actionId: 'request_bank_payment_basis_review',
      actorRole: input.actorRole,
      targetId: dealId,
      disabledReason: uiSafetyNote,
    },
    uiStatusLabel,
    uiSafetyNote,
  };
}
