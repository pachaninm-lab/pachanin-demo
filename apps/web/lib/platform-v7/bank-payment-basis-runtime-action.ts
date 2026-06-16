import { canonicalDomainDeals } from '@/lib/domain/selectors';
import { evaluateReleaseGuard, type ReleaseGuardBlocker } from './domain/release-guard';
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

const blockerLabels: Record<ReleaseGuardBlocker, string> = {
  NO_RESERVED_MONEY: 'нет подтверждённого резерва',
  NO_RELEASE_AMOUNT: 'нет суммы к банковской проверке',
  HOLD_AMOUNT_ACTIVE: 'есть активное удержание',
  OPEN_DISPUTE: 'открыт спор',
  DOCUMENTS_NOT_READY: 'документы не закрыты',
  FGIS_NOT_READY: 'ФГИС/СДИЗ не подтверждены',
  TRANSPORT_NOT_READY: 'рейс или транспортные документы не закрыты',
  ACCEPTANCE_NOT_CONFIRMED: 'приёмка не подтверждена',
  QUALITY_NOT_APPROVED: 'качество не подтверждено',
  MANUAL_BLOCKER: 'есть ручная остановка',
  DEAL_NOT_READY: 'стадия сделки не готова к банковской проверке',
};

export function buildPlatformV7BankPaymentBasisRuntimeAction(input: PlatformV7BankPaymentBasisRuntimeInput): PlatformV7BankPaymentBasisRuntimeResult {
  const dealId = input.dealId.trim();

  if (!dealId) {
    return blockedResult(input, dealId, 'основание не передано', 'Не выбрана сделка для банковской проверки основания.');
  }

  const deal = canonicalDomainDeals.find((item) => item.id === dealId);
  if (!deal) {
    return blockedResult(input, dealId, 'основание не передано', 'Сделка не найдена в проверочном контуре. Основание банку не создаётся.');
  }

  const check = evaluateReleaseGuard(deal);
  if (!check.canRequestRelease || !check.canExecuteRelease) {
    const reasons = check.blockers.map((blocker) => blockerLabels[blocker]).join(', ');
    return blockedResult(
      input,
      dealId,
      'основание не передано',
      `Основание для банковской проверки заблокировано: ${reasons || 'условия сделки не закрыты'}. Требуются резерв, сумма, отсутствие удержания, документы, ФГИС/СДИЗ, рейс, приёмка, качество, отсутствие спора и ручных остановок.`,
    );
  }

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
