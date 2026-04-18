import { getDealById, getDealIntegrationState, getDisputeById } from '@/lib/v7r/data';
import { statusLabel } from '@/lib/v7r/helpers';

export interface DecisionAnswer {
  title: string;
  reason: string;
  nextOwner: string;
  nextStep: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
}

export function getDealDecision(dealId: string): DecisionAnswer | null {
  const deal = getDealById(dealId);
  if (!deal) return null;
  const integration = getDealIntegrationState(deal.id, deal.lotId);

  if (deal.status === 'quality_disputed' && deal.dispute?.id) {
    return {
      title: `${deal.id}: деньги стоят из-за спора`,
      reason: `Статус ${statusLabel(deal.status)}. Удержание активно, потому что спор не закрыт${integration.reasonCodes.length ? `, а интеграция даёт причины: ${integration.reasonCodes.join(', ')}` : ''}.`,
      nextOwner: integration.nextOwner ?? 'Оператор',
      nextStep: integration.nextStep ?? 'Закрыть спор и снять удержание.',
      primaryActionLabel: 'Открыть спор',
      primaryActionHref: `/platform-v7/disputes/${deal.dispute.id}`,
      secondaryActionLabel: 'Открыть сделку',
      secondaryActionHref: `/platform-v7/deals/${deal.id}`,
    };
  }

  if (deal.status === 'release_requested') {
    return {
      title: `${deal.id}: деньги готовы к выпуску`,
      reason: integration.gateState === 'REVIEW'
        ? 'Сделка дошла до выпуска, но банк ждёт ручной проверки.'
        : 'Сделка дошла до выпуска и ждёт подтверждения банка.',
      nextOwner: integration.nextOwner ?? 'Банк',
      nextStep: integration.nextStep ?? 'Подтвердить release в банке.',
      primaryActionLabel: 'Открыть банк',
      primaryActionHref: '/platform-v7/bank',
      secondaryActionLabel: 'Открыть сделку',
      secondaryActionHref: `/platform-v7/deals/${deal.id}`,
    };
  }

  if (integration.gateState === 'FAIL') {
    return {
      title: `${deal.id}: интеграция блокирует следующий шаг`,
      reason: `Gate = FAIL. Причины: ${integration.reasonCodes.join(', ') || 'не указаны'}.`,
      nextOwner: integration.nextOwner ?? 'Оператор',
      nextStep: integration.nextStep ?? 'Снять интеграционные причины.',
      primaryActionLabel: 'Открыть интеграции',
      primaryActionHref: '/platform-v7/connectors',
      secondaryActionLabel: 'Открыть сделку',
      secondaryActionHref: `/platform-v7/deals/${deal.id}`,
    };
  }

  return {
    title: `${deal.id}: следующий шаг определён`,
    reason: `Статус ${statusLabel(deal.status)}. Критичных стоп-факторов нет.`,
    nextOwner: integration.nextOwner ?? 'Оператор',
    nextStep: integration.nextStep ?? 'Довести сделку до следующего этапа.',
    primaryActionLabel: 'Открыть сделку',
    primaryActionHref: `/platform-v7/deals/${deal.id}`,
    secondaryActionLabel: integration.gateState === 'PASS' ? undefined : 'Открыть интеграции',
    secondaryActionHref: integration.gateState === 'PASS' ? undefined : '/platform-v7/connectors',
  };
}

export function getDisputeDecision(disputeId: string): DecisionAnswer | null {
  const dispute = getDisputeById(disputeId);
  if (!dispute) return null;
  const deal = getDealById(dispute.dealId);
  const integration = deal ? getDealIntegrationState(deal.id, deal.lotId) : null;

  return {
    title: `${dispute.id}: спор держит деньги`,
    reason: `${dispute.title}. Под удержанием ${dispute.holdAmount.toLocaleString('ru-RU')} ₽. ${integration?.reasonCodes.length ? `Интеграционные причины: ${integration.reasonCodes.join(', ')}.` : ''}`,
    nextOwner: integration?.nextOwner ?? dispute.ballAt,
    nextStep: integration?.nextStep ?? dispute.description,
    primaryActionLabel: 'Открыть сделку',
    primaryActionHref: `/platform-v7/deals/${dispute.dealId}`,
    secondaryActionLabel: 'Открыть споры',
    secondaryActionHref: '/platform-v7/disputes',
  };
}
