import type { PlatformV7ReceivingGateModel } from './logistics-receiving-gate';
import type { PlatformV7ShipmentGateModel } from './logistics-shipment-gate';
import type { PlatformV7TransportDocumentsGateModel } from './logistics-transport-documents-gate';

export type PlatformV7LogisticsOpsQueueStatus = 'clear' | 'review' | 'blocked';
export type PlatformV7LogisticsOpsQueuePriority = 'low' | 'medium' | 'high' | 'critical';
export type PlatformV7LogisticsOpsQueueTone = 'success' | 'warning' | 'danger';

export interface PlatformV7LogisticsOpsQueueInput {
  dealId: string;
  shipmentId: string;
  title: string;
  shipmentGate: PlatformV7ShipmentGateModel;
  receivingGate: PlatformV7ReceivingGateModel;
  transportDocumentsGate: PlatformV7TransportDocumentsGateModel;
  updatedAt: string;
}

export interface PlatformV7LogisticsOpsQueueRow {
  dealId: string;
  shipmentId: string;
  title: string;
  status: PlatformV7LogisticsOpsQueueStatus;
  priority: PlatformV7LogisticsOpsQueuePriority;
  blockerCount: number;
  reviewCount: number;
  moneyBlocked: boolean;
  nextAction: string;
  updatedAt: string;
  tone: PlatformV7LogisticsOpsQueueTone;
}

export interface PlatformV7LogisticsOpsQueueSummary {
  total: number;
  clear: number;
  review: number;
  blocked: number;
  critical: number;
  moneyBlocked: number;
}

export interface PlatformV7LogisticsOpsQueueModel {
  summary: PlatformV7LogisticsOpsQueueSummary;
  rows: PlatformV7LogisticsOpsQueueRow[];
  nextAction: string;
  isClean: boolean;
}

export function platformV7LogisticsOpsQueueModel(items: PlatformV7LogisticsOpsQueueInput[]): PlatformV7LogisticsOpsQueueModel {
  const rows = items.map(platformV7LogisticsOpsQueueRow).sort(platformV7LogisticsOpsQueueSort);
  const summary = platformV7LogisticsOpsQueueSummary(rows);

  return {
    summary,
    rows,
    nextAction: platformV7LogisticsOpsQueueNextAction(summary, rows),
    isClean: summary.total > 0 && summary.blocked === 0 && summary.review === 0,
  };
}

export function platformV7LogisticsOpsQueueRow(input: PlatformV7LogisticsOpsQueueInput): PlatformV7LogisticsOpsQueueRow {
  const blockerCount = input.shipmentGate.blockerCount + input.receivingGate.blockerCount + input.transportDocumentsGate.blockerCount;
  const reviewCount = input.shipmentGate.reviewReasons.length + input.receivingGate.reviewReasons.length + input.transportDocumentsGate.reviewReasons.length;
  const moneyBlocked = !input.shipmentGate.canReleaseMoney || !input.receivingGate.canReleaseMoney || !input.transportDocumentsGate.canReleaseMoney;
  const status = platformV7LogisticsOpsQueueStatus(blockerCount, reviewCount);
  const priority = platformV7LogisticsOpsQueuePriority(status, blockerCount, moneyBlocked);

  return {
    dealId: input.dealId,
    shipmentId: input.shipmentId,
    title: input.title,
    status,
    priority,
    blockerCount,
    reviewCount,
    moneyBlocked,
    nextAction: platformV7LogisticsOpsQueueRowNextAction(input, status),
    updatedAt: input.updatedAt,
    tone: platformV7LogisticsOpsQueueTone(status),
  };
}

export function platformV7LogisticsOpsQueueStatus(
  blockerCount: number,
  reviewCount: number,
): PlatformV7LogisticsOpsQueueStatus {
  if (blockerCount > 0) return 'blocked';
  if (reviewCount > 0) return 'review';
  return 'clear';
}

export function platformV7LogisticsOpsQueuePriority(
  status: PlatformV7LogisticsOpsQueueStatus,
  blockerCount: number,
  moneyBlocked: boolean,
): PlatformV7LogisticsOpsQueuePriority {
  if (status === 'blocked' && blockerCount >= 4) return 'critical';
  if (status === 'blocked' && moneyBlocked) return 'high';
  if (status === 'blocked') return 'medium';
  if (status === 'review' && moneyBlocked) return 'medium';
  if (status === 'review') return 'medium';
  return 'low';
}

export function platformV7LogisticsOpsQueueSummary(rows: PlatformV7LogisticsOpsQueueRow[]): PlatformV7LogisticsOpsQueueSummary {
  return {
    total: rows.length,
    clear: rows.filter((row) => row.status === 'clear').length,
    review: rows.filter((row) => row.status === 'review').length,
    blocked: rows.filter((row) => row.status === 'blocked').length,
    critical: rows.filter((row) => row.priority === 'critical').length,
    moneyBlocked: rows.filter((row) => row.moneyBlocked).length,
  };
}

export function platformV7LogisticsOpsQueueNextAction(
  summary: PlatformV7LogisticsOpsQueueSummary,
  rows: PlatformV7LogisticsOpsQueueRow[],
): string {
  if (summary.total === 0) return 'Нет рейсов в логистической очереди.';
  if (summary.blocked > 0) return rows.find((row) => row.status === 'blocked')?.nextAction ?? 'Закрыть транспортные блокеры.';
  if (summary.review > 0) return rows.find((row) => row.status === 'review')?.nextAction ?? 'Разобрать рейсы на проверке.';
  return 'Логистическая очередь чистая.';
}

export function platformV7LogisticsOpsQueueTone(status: PlatformV7LogisticsOpsQueueStatus): PlatformV7LogisticsOpsQueueTone {
  if (status === 'clear') return 'success';
  if (status === 'review') return 'warning';
  return 'danger';
}

export function platformV7LogisticsOpsQueueSort(a: PlatformV7LogisticsOpsQueueRow, b: PlatformV7LogisticsOpsQueueRow): number {
  const rank = (priority: PlatformV7LogisticsOpsQueuePriority): number => {
    if (priority === 'critical') return 0;
    if (priority === 'high') return 1;
    if (priority === 'medium') return 2;
    return 3;
  };

  return rank(a.priority) - rank(b.priority)
    || b.blockerCount - a.blockerCount
    || b.reviewCount - a.reviewCount
    || new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    || a.shipmentId.localeCompare(b.shipmentId);
}

function platformV7LogisticsOpsQueueRowNextAction(
  input: PlatformV7LogisticsOpsQueueInput,
  status: PlatformV7LogisticsOpsQueueStatus,
): string {
  if (status === 'clear') return 'Рейс готов к денежному контуру.';
  if (input.shipmentGate.status === 'blocked') return input.shipmentGate.nextAction;
  if (input.receivingGate.status === 'blocked') return input.receivingGate.nextAction;
  if (input.transportDocumentsGate.status === 'blocked') return input.transportDocumentsGate.nextAction;
  if (input.shipmentGate.status === 'review') return input.shipmentGate.nextAction;
  if (input.receivingGate.status === 'review') return input.receivingGate.nextAction;
  return input.transportDocumentsGate.nextAction;
}
