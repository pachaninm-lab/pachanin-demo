import type { PlatformV7DealDocumentsModel } from './deal-workspace-documents';
import type { PlatformV7DealLogisticsModel } from './deal-workspace-logistics';
import type { PlatformV7DealFinancialTerms } from './deal-financial-terms';

export type PlatformV7DealReleaseGateId = 'documents' | 'logistics' | 'money' | 'bank' | 'dispute';
export type PlatformV7DealReleaseGateStatus = 'pass' | 'review' | 'fail';

export interface PlatformV7DealReleaseGate {
  id: PlatformV7DealReleaseGateId;
  label: string;
  status: PlatformV7DealReleaseGateStatus;
  reason: string;
}

export interface PlatformV7DealReleaseReadinessInput {
  documents: PlatformV7DealDocumentsModel;
  logistics: PlatformV7DealLogisticsModel;
  financialTerms: PlatformV7DealFinancialTerms;
  bankCallbackConfirmed: boolean;
  disputeOpen: boolean;
}

export interface PlatformV7DealReleaseReadinessModel {
  gates: PlatformV7DealReleaseGate[];
  canRelease: boolean;
  gateStatus: PlatformV7DealReleaseGateStatus;
  releaseAmount: number;
  blockerCount: number;
  nextAction: string;
}

function gateStatus(gates: PlatformV7DealReleaseGate[]): PlatformV7DealReleaseGateStatus {
  if (gates.some((gate) => gate.status === 'fail')) return 'fail';
  if (gates.some((gate) => gate.status === 'review')) return 'review';
  return 'pass';
}

export function platformV7DealReleaseReadinessModel(
  input: PlatformV7DealReleaseReadinessInput,
): PlatformV7DealReleaseReadinessModel {
  const gates: PlatformV7DealReleaseGate[] = [
    {
      id: 'documents',
      label: 'Документы',
      status: input.documents.blocksRelease ? 'fail' : 'pass',
      reason: input.documents.blocksRelease
        ? `Подписано ${input.documents.signed}/${input.documents.total}; missing ${input.documents.missing}; rejected ${input.documents.rejected}.`
        : 'Документный пакет закрыт.',
    },
    {
      id: 'logistics',
      label: 'Логистика',
      status: input.logistics.blocksRelease ? 'fail' : 'pass',
      reason: input.logistics.blocksRelease
        ? `Логистика блокирует выпуск: ${input.logistics.blockers.join(', ') || input.logistics.statusLabel}.`
        : 'Рейс и приёмка закрыты.',
    },
    {
      id: 'money',
      label: 'Деньги',
      status: input.financialTerms.releaseAmount > 0 ? 'pass' : 'fail',
      reason: input.financialTerms.releaseAmount > 0
        ? `К выпуску ${input.financialTerms.releaseAmount}.`
        : 'Нет положительной суммы к выпуску.',
    },
    {
      id: 'bank',
      label: 'Банк',
      status: input.bankCallbackConfirmed ? 'pass' : 'review',
      reason: input.bankCallbackConfirmed ? 'Банковское событие подтверждено.' : 'Ожидается банковское подтверждение.',
    },
    {
      id: 'dispute',
      label: 'Спор',
      status: input.disputeOpen ? 'fail' : 'pass',
      reason: input.disputeOpen ? 'Есть активный спор.' : 'Активного спора нет.',
    },
  ];

  const status = gateStatus(gates);
  const blockerCount = gates.filter((gate) => gate.status === 'fail').length;

  return {
    gates,
    canRelease: status === 'pass',
    gateStatus: status,
    releaseAmount: input.financialTerms.releaseAmount,
    blockerCount,
    nextAction: status === 'pass' ? 'Выпустить деньги' : gates.find((gate) => gate.status !== 'pass')?.label ?? 'Проверить сделку',
  };
}

export function platformV7DealReleaseReadinessTone(
  model: PlatformV7DealReleaseReadinessModel,
): 'success' | 'warning' | 'danger' {
  if (model.gateStatus === 'pass') return 'success';
  if (model.gateStatus === 'review') return 'warning';
  return 'danger';
}
