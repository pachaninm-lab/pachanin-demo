import type { DocumentRequirement, ExecutionBlocker, MoneyAdjustment, MoneyProjection, QualityDelta, SdizGate, WeightBalance } from '../types';
import { money } from '../format';
import { documentBlockers } from './document-requirement-engine';
import { getSdizGateBlockers } from './sdiz-gate-engine';
import { createNextAction } from './next-action-engine';

export function qualityAdjustment(delta: QualityDelta): MoneyAdjustment | null {
  if (delta.totalHoldAmount.value <= 0) return null;
  return {
    id: `MA-${delta.id}`,
    dealId: delta.dealId,
    type: 'quality_discount',
    title: 'Удержание по качеству',
    amount: delta.totalHoldAmount,
    sourceEntityType: 'quality_delta',
    sourceEntityId: delta.id,
    status: delta.status === 'dispute_required' ? 'disputed' : 'applied',
    blocksFullRelease: false,
    allowsPartialRelease: true,
    createdAt: delta.createdAt,
  };
}

export function weightAdjustment(balance: WeightBalance): MoneyAdjustment | null {
  if (balance.weightDeviationMoneyImpact.value <= 0) return null;
  return {
    id: `MA-${balance.id}`,
    dealId: balance.dealId,
    type: 'weight_deviation',
    title: 'Удержание по весу',
    amount: balance.weightDeviationMoneyImpact,
    sourceEntityType: 'weight_balance',
    sourceEntityId: balance.id,
    status: balance.status === 'disputed' ? 'disputed' : 'applied',
    blocksFullRelease: false,
    allowsPartialRelease: true,
    createdAt: balance.createdAt,
  };
}

export function documentAdjustment(document: DocumentRequirement): MoneyAdjustment | null {
  if (!document.blocksMoneyRelease || ['uploaded', 'signed', 'not_required'].includes(document.status)) return null;
  return {
    id: `MA-${document.id}`,
    dealId: document.dealId,
    type: document.documentType.startsWith('sdiz') ? 'sdiz_hold' : 'document_hold',
    title: document.documentType.startsWith('sdiz') ? 'Удержание до закрытия СДИЗ' : 'Удержание до закрытия документа',
    amount: money(0),
    sourceEntityType: 'document_requirement',
    sourceEntityId: document.id,
    status: 'draft',
    blocksFullRelease: true,
    allowsPartialRelease: false,
    createdAt: document.createdAt,
  };
}

export function calculateMoneyProjection(params: {
  readonly dealId: string;
  readonly grossDealAmount: number;
  readonly reservedAmount: number;
  readonly documents?: readonly DocumentRequirement[];
  readonly sdizGates?: readonly SdizGate[];
  readonly qualityDelta?: QualityDelta;
  readonly weightBalance?: WeightBalance;
  readonly releasedAmount?: number;
}): MoneyProjection {
  const adjustments = [
    params.qualityDelta ? qualityAdjustment(params.qualityDelta) : null,
    params.weightBalance ? weightAdjustment(params.weightBalance) : null,
    ...(params.documents ?? []).map(documentAdjustment),
  ].filter((item): item is MoneyAdjustment => Boolean(item));

  const releaseBlockedReasons: ExecutionBlocker[] = [
    ...documentBlockers(params.documents ?? []),
    ...getSdizGateBlockers(params.sdizGates ?? []).filter((blocker) => blocker.blocks === 'money_release'),
  ];

  const heldAmount = adjustments.reduce((sum, next) => sum + (next.amount.value > 0 ? next.amount.value : 0), 0);
  const disputedAmount = adjustments.filter((next) => next.status === 'disputed').reduce((sum, next) => sum + next.amount.value, 0);
  const fullStop = adjustments.some((next) => next.blocksFullRelease) || releaseBlockedReasons.some((reason) => reason.severity === 'critical');
  const releasedAmount = params.releasedAmount ?? 0;
  const readyToReleaseAmount = fullStop ? 0 : Math.max(0, params.reservedAmount - heldAmount - releasedAmount);

  return {
    dealId: params.dealId,
    grossDealAmount: money(params.grossDealAmount),
    reservedAmount: money(params.reservedAmount),
    readyToReleaseAmount: money(readyToReleaseAmount),
    heldAmount: money(heldAmount),
    disputedAmount: money(disputedAmount),
    manualReviewAmount: money(fullStop ? Math.max(0, params.reservedAmount - heldAmount - releasedAmount) : 0),
    releasedAmount: money(releasedAmount),
    adjustments,
    releaseAllowed: readyToReleaseAmount > 0 && releaseBlockedReasons.length === 0,
    releaseBlockedReasons,
    nextAction: createNextAction({
      seed: `${params.dealId}-release`,
      title: releaseBlockedReasons.length > 0 ? 'Закрыть причины остановки денег' : 'Подготовить выпуск денег через банк',
      description: releaseBlockedReasons.length > 0 ? 'Сначала закройте документы, СДИЗ или ручную проверку.' : 'Сумма готова к банковскому подтверждению.',
      role: releaseBlockedReasons[0]?.responsibleRole ?? 'bank',
      priority: releaseBlockedReasons.length > 0 ? 'critical' : 'high',
      actionType: releaseBlockedReasons.length > 0 ? 'resolve_blocker' : 'approve_release',
      targetRoute: `/platform-v7/deals/${params.dealId}/release`,
      requiresReason: true,
    }),
  };
}
