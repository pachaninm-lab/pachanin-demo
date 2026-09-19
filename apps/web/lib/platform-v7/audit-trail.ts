export type PlatformV7AuditEntityType = 'lot' | 'purchase_request' | 'deal' | 'shipment' | 'quality_test' | 'document' | 'payment' | 'dispute' | 'bank_event' | 'user';
export type PlatformV7AuditAction = 'created' | 'updated' | 'status_changed' | 'approved' | 'rejected' | 'signed' | 'uploaded' | 'released' | 'held' | 'commented';
export type PlatformV7AuditSource = 'web_app' | 'mobile_app' | 'operator_console' | 'bank_webhook' | 'edo' | 'fgis_grain' | 'system_worker';
export type PlatformV7AuditResult = 'success' | 'failure' | 'manual_review';
export type PlatformV7AuditTrailStatus = 'valid' | 'warning' | 'broken';
export type PlatformV7AuditTrailTone = 'success' | 'warning' | 'danger';

export interface PlatformV7AuditTrailEvent {
  id: string;
  entityId: string;
  entityType: PlatformV7AuditEntityType;
  action: PlatformV7AuditAction;
  source: PlatformV7AuditSource;
  result: PlatformV7AuditResult;
  actorId: string;
  actorRole: string;
  occurredAt: string;
  correlationId: string;
  reason?: string;
  beforeHash?: string;
  afterHash?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PlatformV7AuditTrailSummary {
  total: number;
  success: number;
  failure: number;
  manualReview: number;
  uniqueActors: number;
  uniqueEntities: number;
  uniqueCorrelations: number;
}

export interface PlatformV7AuditTrailModel {
  status: PlatformV7AuditTrailStatus;
  tone: PlatformV7AuditTrailTone;
  events: PlatformV7AuditTrailEvent[];
  summary: PlatformV7AuditTrailSummary;
  blockerCount: number;
  blockers: string[];
  nextAction: string;
  canExportAuditPack: boolean;
}

export function platformV7AuditTrailModel(events: PlatformV7AuditTrailEvent[]): PlatformV7AuditTrailModel {
  const sorted = platformV7AuditTrailSort(events);
  const blockers = platformV7AuditTrailBlockers(sorted);
  const summary = platformV7AuditTrailSummary(sorted);
  const status = platformV7AuditTrailStatus(blockers, summary);

  return {
    status,
    tone: platformV7AuditTrailTone(status),
    events: sorted,
    summary,
    blockerCount: blockers.length,
    blockers,
    nextAction: platformV7AuditTrailNextAction(status, blockers),
    canExportAuditPack: status === 'valid' && summary.total > 0,
  };
}

export function platformV7AuditTrailSort(events: PlatformV7AuditTrailEvent[]): PlatformV7AuditTrailEvent[] {
  return [...events].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() || a.id.localeCompare(b.id));
}

export function platformV7AuditTrailSummary(events: PlatformV7AuditTrailEvent[]): PlatformV7AuditTrailSummary {
  return {
    total: events.length,
    success: events.filter((event) => event.result === 'success').length,
    failure: events.filter((event) => event.result === 'failure').length,
    manualReview: events.filter((event) => event.result === 'manual_review').length,
    uniqueActors: new Set(events.map((event) => event.actorId)).size,
    uniqueEntities: new Set(events.map((event) => `${event.entityType}:${event.entityId}`)).size,
    uniqueCorrelations: new Set(events.map((event) => event.correlationId)).size,
  };
}

export function platformV7AuditTrailBlockers(events: PlatformV7AuditTrailEvent[]): string[] {
  const blockers: string[] = [];
  const seenIds = new Set<string>();

  events.forEach((event) => {
    if (seenIds.has(event.id)) blockers.push(`duplicate-id:${event.id}`);
    seenIds.add(event.id);

    if (!event.actorId) blockers.push(`missing-actor:${event.id}`);
    if (!event.actorRole) blockers.push(`missing-actor-role:${event.id}`);
    if (!event.correlationId) blockers.push(`missing-correlation:${event.id}`);
    if (!Number.isFinite(new Date(event.occurredAt).getTime())) blockers.push(`invalid-occurred-at:${event.id}`);
    if (event.action === 'status_changed' && (!event.beforeHash || !event.afterHash)) blockers.push(`missing-status-hash:${event.id}`);
    if (event.result === 'failure' && !event.reason) blockers.push(`missing-failure-reason:${event.id}`);
  });

  return [...new Set(blockers)];
}

export function platformV7AuditTrailStatus(
  blockers: string[],
  summary: PlatformV7AuditTrailSummary,
): PlatformV7AuditTrailStatus {
  if (blockers.some((blocker) => blocker.startsWith('duplicate-id') || blocker.startsWith('missing-actor') || blocker.startsWith('invalid-occurred-at') || blocker.startsWith('missing-correlation'))) return 'broken';
  if (summary.total === 0 || summary.failure > 0 || summary.manualReview > 0 || blockers.length > 0) return 'warning';
  return 'valid';
}

export function platformV7AuditTrailTone(status: PlatformV7AuditTrailStatus): PlatformV7AuditTrailTone {
  if (status === 'valid') return 'success';
  if (status === 'warning') return 'warning';
  return 'danger';
}

export function platformV7AuditTrailNextAction(status: PlatformV7AuditTrailStatus, blockers: string[]): string {
  if (status === 'valid') return 'Audit trail готов к экспорту.';
  if (status === 'broken') return blockers[0] ? `Остановить audit export: ${blockers[0]}.` : 'Остановить audit export до восстановления событий.';
  return blockers[0] ? `Дозакрыть audit trail: ${blockers[0]}.` : 'Проверить незавершённые или спорные события аудита.';
}

export function platformV7AuditTrailStableKey(event: PlatformV7AuditTrailEvent): string {
  return `${event.entityType}:${event.entityId}:${event.action}:${event.correlationId}`;
}
