import type { BatchReadiness, DocumentRequirement, GrainBatch, ReadinessBlocker, SdizGate } from '../types';
import { createNextAction, sortNextActions } from './next-action-engine';

function scorePart(condition: boolean, points: number): number {
  return condition ? points : 0;
}

export function calculateBatchReadiness(
  batch: GrainBatch,
  documents: readonly DocumentRequirement[] = [],
  sdizGates: readonly SdizGate[] = [],
): BatchReadiness {
  const batchDocuments = documents.filter((doc) => doc.relatedEntityId === batch.id || doc.dealId.includes(batch.id) || doc.relatedEntityType === 'batch');
  const batchSdiz = sdizGates.filter((gate) => gate.batchId === batch.id);
  const blockers: ReadinessBlocker[] = [];

  if (batch.availableVolumeTons <= 0) {
    blockers.push({
      id: `${batch.id}-volume`,
      type: 'volume',
      severity: 'critical',
      title: 'Нет доступного объёма',
      description: 'Партия не может выйти в продажу без подтверждённого свободного объёма.',
      responsibleRole: 'seller',
    });
  }

  if (batch.fgisStatus === 'not_linked' || batch.fgisStatus === 'sync_error' || batch.fgisStatus === 'blocked') {
    blockers.push({
      id: `${batch.id}-fgis`,
      type: 'fgis',
      severity: batch.fgisStatus === 'sync_error' || batch.fgisStatus === 'blocked' ? 'critical' : 'warning',
      title: batch.fgisStatus === 'sync_error' ? 'ФГИС требует проверки' : 'Партия не связана с ФГИС',
      description: 'Продажа возможна только после понятного статуса партии в тестовом или ручном контуре.',
      responsibleRole: 'seller',
    });
  }

  if (!batch.qualityProfileId) {
    blockers.push({
      id: `${batch.id}-quality`,
      type: 'quality',
      severity: 'warning',
      title: 'Не хватает анализа качества',
      description: 'Покупатель не увидит влажность, протеин, клейковину и базовые показатели.',
      responsibleRole: 'seller',
    });
  }

  if (!batch.storageLocationName || !batch.region) {
    blockers.push({
      id: `${batch.id}-storage`,
      type: 'storage',
      severity: 'critical',
      title: 'Не подтверждено место хранения',
      description: 'Нельзя посчитать логистику и базис без точки хранения.',
      responsibleRole: 'seller',
    });
  }

  const blockingDocs = batchDocuments.filter((doc) => doc.required && !['uploaded', 'signed', 'not_required'].includes(doc.status));
  if (blockingDocs.length > 0) {
    blockers.push({
      id: `${batch.id}-documents`,
      type: 'document',
      severity: 'warning',
      title: 'Документы не закрыты',
      description: `Не хватает документов: ${blockingDocs.length}.`,
      responsibleRole: 'seller',
    });
  }

  const blockingSdiz = batchSdiz.filter((gate) => gate.required && ['required', 'draft', 'error', 'manual_review'].includes(gate.status));
  if (blockingSdiz.length > 0) {
    blockers.push({
      id: `${batch.id}-sdiz`,
      type: 'sdiz',
      severity: 'critical',
      title: 'СДИЗ требует действия',
      description: 'СДИЗ влияет на публикацию, отгрузку или выпуск денег.',
      responsibleRole: blockingSdiz[0]?.responsibleRole ?? 'seller',
    });
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      scorePart(batch.availableVolumeTons > 0, 18) +
        scorePart(Boolean(batch.storageLocationName && batch.region), 14) +
        scorePart(['linked', 'manual_mode', 'draft'].includes(batch.fgisStatus), 20) +
        scorePart(Boolean(batch.qualityProfileId), 18) +
        scorePart(blockingDocs.length === 0, 15) +
        scorePart(blockingSdiz.length === 0, 15),
    ),
  );

  const nextActions = sortNextActions([
    ...(!batch.qualityProfileId
      ? [
          createNextAction({
            seed: `${batch.id}-quality`,
            title: 'Добавить анализ качества',
            description: 'Загрузите протокол или внесите показатели вручную.',
            role: 'seller',
            priority: 'high',
            actionType: 'attach_quality',
            targetRoute: `/platform-v7/batches/${batch.id}`,
          }),
        ]
      : []),
    ...(!['linked', 'manual_mode', 'draft'].includes(batch.fgisStatus)
      ? [
          createNextAction({
            seed: `${batch.id}-fgis`,
            title: 'Проверить ФГИС / СДИЗ',
            description: 'Закройте тестовый или ручной статус партии перед продажей.',
            role: 'seller',
            priority: 'critical',
            actionType: 'link_fgis',
            targetRoute: `/platform-v7/batches/${batch.id}`,
            requiresReason: true,
          }),
        ]
      : []),
    createNextAction({
      seed: `${batch.id}-publish`,
      title: score >= 80 ? 'Создать лот из партии' : 'Довести партию до публикации',
      description: score >= 80 ? 'Партия достаточно готова для лота.' : 'Закройте причины остановки перед публикацией.',
      role: 'seller',
      priority: score >= 80 ? 'medium' : 'high',
      actionType: 'publish_lot',
      targetRoute: `/platform-v7/batches/${batch.id}`,
      disabled: score < 70,
      disabledReason: score < 70 ? 'Готовность партии ниже безопасного порога.' : undefined,
    }),
  ]);

  return {
    batchId: batch.id,
    score,
    status: blockers.some((blocker) => blocker.severity === 'critical') ? 'blocked' : score >= 80 ? 'ready_for_sale' : score >= 60 ? 'almost_ready' : 'not_ready',
    blockers,
    nextActions,
  };
}
