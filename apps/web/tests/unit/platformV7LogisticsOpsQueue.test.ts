import { describe, expect, it } from 'vitest';
import type { PlatformV7ReceivingGateModel } from '@/lib/platform-v7/logistics-receiving-gate';
import type { PlatformV7ShipmentGateModel } from '@/lib/platform-v7/logistics-shipment-gate';
import type { PlatformV7TransportDocumentsGateModel } from '@/lib/platform-v7/logistics-transport-documents-gate';
import {
  platformV7LogisticsOpsQueueModel,
  platformV7LogisticsOpsQueueNextAction,
  platformV7LogisticsOpsQueuePriority,
  platformV7LogisticsOpsQueueSort,
  platformV7LogisticsOpsQueueStatus,
  platformV7LogisticsOpsQueueSummary,
  platformV7LogisticsOpsQueueTone,
} from '@/lib/platform-v7/logistics-ops-queue';

const shipmentReady: PlatformV7ShipmentGateModel = {
  shipmentId: 'SHIP-1',
  dealId: 'DL-1',
  status: 'ready',
  tone: 'success',
  moneyImpact: 'release_allowed',
  canReleaseMoney: true,
  canAcceptShipment: false,
  blockerCount: 0,
  blockers: [],
  reviewReasons: [],
  nextAction: 'Рейс подтверждён, транспортный блокер снят.',
};

const receivingReady: PlatformV7ReceivingGateModel = {
  receivingId: 'RCV-1',
  shipmentId: 'SHIP-1',
  dealId: 'DL-1',
  status: 'ready',
  tone: 'success',
  moneyImpact: 'release_allowed',
  canFinalizeReceiving: true,
  canReleaseMoney: true,
  blockerCount: 0,
  blockers: [],
  reviewReasons: [],
  nextAction: 'Приёмка подтверждена, можно продолжать выпуск денег.',
};

const docsReady: PlatformV7TransportDocumentsGateModel = {
  packId: 'TDP-1',
  dealId: 'DL-1',
  shipmentId: 'SHIP-1',
  status: 'ready',
  tone: 'success',
  moneyImpact: 'release_allowed',
  canReleaseMoney: true,
  requiredCount: 2,
  completedRequiredCount: 2,
  readinessPercent: 100,
  blockerCount: 0,
  blockers: [],
  reviewReasons: [],
  nextAction: 'Транспортные документы закрыты, документный блокер снят.',
};

describe('platform-v7 logistics ops queue', () => {
  it('marks logistics queue clean when all gates are ready', () => {
    const model = platformV7LogisticsOpsQueueModel([
      {
        dealId: 'DL-1',
        shipmentId: 'SHIP-1',
        title: 'Рейс 1',
        shipmentGate: shipmentReady,
        receivingGate: receivingReady,
        transportDocumentsGate: docsReady,
        updatedAt: '2026-04-25T10:00:00.000Z',
      },
    ]);

    expect(model.summary.clear).toBe(1);
    expect(model.isClean).toBe(true);
    expect(model.rows[0].status).toBe('clear');
    expect(model.rows[0].moneyBlocked).toBe(false);
    expect(model.nextAction).toBe('Логистическая очередь чистая.');
  });

  it('sorts critical blocked rows before review and clear rows', () => {
    const model = platformV7LogisticsOpsQueueModel([
      {
        dealId: 'DL-3',
        shipmentId: 'SHIP-3',
        title: 'Чистый рейс',
        shipmentGate: shipmentReady,
        receivingGate: receivingReady,
        transportDocumentsGate: docsReady,
        updatedAt: '2026-04-25T12:00:00.000Z',
      },
      {
        dealId: 'DL-1',
        shipmentId: 'SHIP-1',
        title: 'Заблокированный рейс',
        shipmentGate: {
          ...shipmentReady,
          status: 'blocked',
          tone: 'danger',
          canReleaseMoney: false,
          blockerCount: 4,
          blockers: ['active-dispute', 'route-deviation', 'weight-missing', 'quality-missing'],
          nextAction: 'Остановить выпуск: active-dispute.',
        },
        receivingGate: receivingReady,
        transportDocumentsGate: docsReady,
        updatedAt: '2026-04-25T10:00:00.000Z',
      },
      {
        dealId: 'DL-2',
        shipmentId: 'SHIP-2',
        title: 'Рейс на проверке',
        shipmentGate: {
          ...shipmentReady,
          status: 'review',
          tone: 'warning',
          canReleaseMoney: false,
          reviewReasons: ['transport:in_transit'],
          nextAction: 'Передать рейс на проверку: transport:in_transit.',
        },
        receivingGate: receivingReady,
        transportDocumentsGate: docsReady,
        updatedAt: '2026-04-25T11:00:00.000Z',
      },
    ]);

    expect(model.rows.map((row) => row.shipmentId)).toEqual(['SHIP-1', 'SHIP-2', 'SHIP-3']);
    expect(model.summary.blocked).toBe(1);
    expect(model.summary.review).toBe(1);
    expect(model.nextAction).toBe('Остановить выпуск: active-dispute.');
  });

  it('keeps helper outputs deterministic', () => {
    const rowA = {
      dealId: 'DL-1',
      shipmentId: 'SHIP-1',
      title: 'A',
      status: 'blocked' as const,
      priority: 'critical' as const,
      blockerCount: 4,
      reviewCount: 0,
      moneyBlocked: true,
      nextAction: 'A',
      updatedAt: '2026-04-25T10:00:00.000Z',
      tone: 'danger' as const,
    };
    const rowB = { ...rowA, shipmentId: 'SHIP-2', status: 'clear' as const, priority: 'low' as const, blockerCount: 0, moneyBlocked: false };

    expect(platformV7LogisticsOpsQueueStatus(0, 0)).toBe('clear');
    expect(platformV7LogisticsOpsQueuePriority('blocked', 4, true)).toBe('critical');
    expect(platformV7LogisticsOpsQueueTone('review')).toBe('warning');
    expect(platformV7LogisticsOpsQueueSummary([rowA, rowB]).total).toBe(2);
    expect(platformV7LogisticsOpsQueueNextAction({ total: 0, clear: 0, review: 0, blocked: 0, critical: 0, moneyBlocked: 0 }, [])).toBe('Нет рейсов в логистической очереди.');
    expect(platformV7LogisticsOpsQueueSort(rowA, rowB)).toBeLessThan(0);
  });
});
