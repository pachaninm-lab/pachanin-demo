import type { ExecutionBlocker, LogisticsIncident, QualityDelta, SupportCase, WeightBalance } from '../types';

export function createSupportCaseFromBlocker(params: {
  readonly blocker: ExecutionBlocker;
  readonly requesterRole?: SupportCase['requesterRole'];
  readonly dealId?: string;
  readonly batchId?: string;
  readonly logisticsOrderId?: string;
  readonly createdAt: string;
}): SupportCase {
  const categoryMap: Record<ExecutionBlocker['type'], SupportCase['category']> = {
    fgis: 'fgis',
    sdiz: 'sdiz',
    document: 'documents',
    money: 'money',
    quality: 'quality',
    weight: 'weight',
    logistics: 'logistics',
    elevator: 'elevator',
    lab: 'lab',
    support: 'other',
    dispute: 'dispute',
    manual: 'other',
  };

  return {
    id: `SUP-${params.blocker.id}`,
    title: params.blocker.title,
    description: params.blocker.description,
    status: 'open',
    priority: params.blocker.severity === 'critical' ? 'critical' : params.blocker.severity === 'warning' ? 'high' : 'medium',
    category: categoryMap[params.blocker.type],
    requesterRole: params.requesterRole ?? params.blocker.responsibleRole,
    relatedEntityType: params.blocker.relatedEntityType === 'sdiz_gate' ? 'document' : params.blocker.relatedEntityType === 'document_requirement' ? 'document' : 'deal',
    relatedEntityId: params.blocker.relatedEntityId,
    dealId: params.dealId,
    batchId: params.batchId,
    logisticsOrderId: params.logisticsOrderId,
    automationSource: 'system_gate',
    suggestedResolution: params.blocker.nextAction?.title ?? 'Назначить ответственного и закрыть причину остановки.',
    nextActionRole: params.blocker.responsibleRole,
    nextActionTitle: params.blocker.nextAction?.title,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  };
}

export function createSupportCases(params: {
  readonly blockers: readonly ExecutionBlocker[];
  readonly incidents?: readonly LogisticsIncident[];
  readonly qualityDelta?: QualityDelta;
  readonly weightBalance?: WeightBalance;
  readonly dealId?: string;
  readonly batchId?: string;
  readonly logisticsOrderId?: string;
  readonly createdAt: string;
}): SupportCase[] {
  const blockerCases = params.blockers
    .filter((blocker) => blocker.severity !== 'info')
    .map((blocker) => createSupportCaseFromBlocker({ blocker, dealId: params.dealId, batchId: params.batchId, logisticsOrderId: params.logisticsOrderId, createdAt: params.createdAt }));

  const incidentCases = (params.incidents ?? [])
    .filter((incident) => incident.status === 'open')
    .map((incident) => ({
      id: `SUP-${incident.id}`,
      title: incident.title,
      description: 'Логистический инцидент влияет на исполнение сделки и требует действия.',
      status: 'open' as const,
      priority: incident.severity === 'critical' ? ('critical' as const) : ('high' as const),
      category: 'logistics' as const,
      requesterRole: 'logistics' as const,
      relatedEntityType: 'logistics_order' as const,
      relatedEntityId: incident.logisticsOrderId,
      dealId: incident.dealId,
      batchId: params.batchId,
      logisticsOrderId: incident.logisticsOrderId,
      automationSource: 'system_gate' as const,
      suggestedResolution: 'Проверить рейс, документы и денежный эффект.',
      nextActionRole: 'logistics' as const,
      nextActionTitle: 'Разобрать инцидент',
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    }));

  const qualityCase = params.qualityDelta && ['discount_required', 'dispute_required'].includes(params.qualityDelta.status)
    ? [
        {
          id: `SUP-${params.qualityDelta.id}`,
          title: 'Качество требует решения',
          description: 'Есть денежная дельта по качеству. Нужно принять удержание, запросить повторный анализ или открыть спор.',
          status: 'open' as const,
          priority: params.qualityDelta.status === 'dispute_required' ? ('critical' as const) : ('high' as const),
          category: 'quality' as const,
          requesterRole: 'operator' as const,
          relatedEntityType: 'dispute' as const,
          relatedEntityId: params.qualityDelta.id,
          dealId: params.qualityDelta.dealId,
          batchId: params.qualityDelta.batchId,
          automationSource: 'system_gate' as const,
          suggestedResolution: 'Согласовать удержание или запустить повторный анализ.',
          nextActionRole: 'operator' as const,
          nextActionTitle: 'Принять решение по качеству',
          createdAt: params.createdAt,
          updatedAt: params.createdAt,
        },
      ]
    : [];

  const weightCase = params.weightBalance?.status === 'deviation'
    ? [
        {
          id: `SUP-${params.weightBalance.id}`,
          title: 'Весовое расхождение требует решения',
          description: 'Зачётный вес отличается от договорного выше допуска. Нужно проверить документы и удержание.',
          status: 'open' as const,
          priority: 'high' as const,
          category: 'weight' as const,
          requesterRole: 'operator' as const,
          relatedEntityType: 'deal' as const,
          relatedEntityId: params.weightBalance.id,
          dealId: params.weightBalance.dealId,
          batchId: params.weightBalance.batchId,
          logisticsOrderId: params.weightBalance.logisticsOrderId,
          automationSource: 'system_gate' as const,
          suggestedResolution: 'Сверить весовые документы и рассчитать удержание только на расхождение.',
          nextActionRole: 'operator' as const,
          nextActionTitle: 'Проверить весовое расхождение',
          createdAt: params.createdAt,
          updatedAt: params.createdAt,
        },
      ]
    : [];

  return [...blockerCases, ...incidentCases, ...qualityCase, ...weightCase];
}

export function summarizeSupport(cases: readonly SupportCase[]) {
  return {
    openCases: cases.filter((item) => ['open', 'in_progress', 'waiting_user', 'waiting_external'].includes(item.status)).length,
    criticalCases: cases.filter((item) => item.priority === 'critical' && !['resolved', 'closed'].includes(item.status)).length,
    nextActionTitle: cases.find((item) => item.nextActionTitle)?.nextActionTitle,
  };
}
