import type { AuditEvent, EntityId, UserRole } from '../types';

let counter = 0;

export function createAuditEvent(params: {
  readonly entityType: string;
  readonly entityId: EntityId;
  readonly dealId?: EntityId;
  readonly batchId?: EntityId;
  readonly actorRole: UserRole;
  readonly actorId?: EntityId;
  readonly actorName?: string;
  readonly action: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string;
  readonly createdAt: string;
}): AuditEvent {
  counter += 1;
  return {
    id: `AUD-${counter.toString().padStart(4, '0')}`,
    entityType: params.entityType,
    entityId: params.entityId,
    dealId: params.dealId,
    batchId: params.batchId,
    actorRole: params.actorRole,
    actorId: params.actorId,
    actorName: params.actorName,
    action: params.action,
    before: params.before,
    after: params.after,
    reason: params.reason,
    createdAt: params.createdAt,
  };
}

export function createRequiredAuditEvents(createdAt: string): AuditEvent[] {
  return [
    createAuditEvent({ entityType: 'batch', entityId: 'GB-450-TMB-01', batchId: 'GB-450-TMB-01', actorRole: 'seller', actorName: 'КФХ Петров', action: 'Партия создана', reason: 'Быстрый режим продажи', createdAt }),
    createAuditEvent({ entityType: 'quality', entityId: 'QP-SELLER-01', batchId: 'GB-450-TMB-01', actorRole: 'seller', actorName: 'КФХ Петров', action: 'Качество добавлено', createdAt }),
    createAuditEvent({ entityType: 'lot', entityId: 'LOT-GB-450-01', batchId: 'GB-450-TMB-01', actorRole: 'seller', actorName: 'КФХ Петров', action: 'Лот создан из партии', createdAt }),
    createAuditEvent({ entityType: 'offer', entityId: 'OFF-01', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'buyer', actorName: 'Мукомольный комбинат Центр', action: 'Оффер отправлен', createdAt }),
    createAuditEvent({ entityType: 'deal', entityId: 'DL-GRAIN-450', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'seller', actorName: 'КФХ Петров', action: 'Оффер принят, сделка создана', createdAt }),
    createAuditEvent({ entityType: 'money', entityId: 'DL-GRAIN-450', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'bank', actorName: 'Банк', action: 'Тестовый резерв подтверждён', reason: 'sandbox/manual статус', createdAt }),
    createAuditEvent({ entityType: 'sdiz', entityId: 'SDIZ-TRANSPORT-01', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'seller', actorName: 'КФХ Петров', action: 'СДИЗ поставлен на ручную проверку', reason: 'Нет live-подключения ФГИС', createdAt }),
    createAuditEvent({ entityType: 'logistics', entityId: 'LOG-450-01', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'logistics', actorName: 'Диспетчер', action: 'Логистика назначена', createdAt }),
    createAuditEvent({ entityType: 'driver', entityId: 'DRIVER-01', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'driver', actorName: 'Иван Соколов', action: 'Водитель подтвердил прибытие', createdAt }),
    createAuditEvent({ entityType: 'weight', entityId: 'WB-450-01', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'elevator', actorName: 'Элеватор Рассказово', action: 'Вес зафиксирован', createdAt }),
    createAuditEvent({ entityType: 'sample', entityId: 'SAMPLE-450-01', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'elevator', actorName: 'Элеватор Рассказово', action: 'Проба взята и опломбирована', createdAt }),
    createAuditEvent({ entityType: 'lab', entityId: 'LAB-SBX-777', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'lab', actorName: 'Лаборатория', action: 'Результат качества добавлен', createdAt }),
    createAuditEvent({ entityType: 'money_adjustment', entityId: 'QD-450-01', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'operator', actorName: 'Оператор', action: 'Удержание рассчитано', reason: 'Отклонение качества', createdAt }),
    createAuditEvent({ entityType: 'dispute', entityId: 'DSP-450-01', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'buyer', actorName: 'Покупатель', action: 'Спор открыт', reason: 'Качество', createdAt }),
    createAuditEvent({ entityType: 'support_case', entityId: 'SUP-QD-450-01', dealId: 'DL-GRAIN-450', batchId: 'GB-450-TMB-01', actorRole: 'operator', actorName: 'Система', action: 'Обращение поддержки создано автоматически', reason: 'Критический блокер исполнения', createdAt }),
  ];
}
