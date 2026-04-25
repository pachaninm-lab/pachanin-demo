import { describe, expect, it } from 'vitest';
import type { PlatformV7LogisticsOpsQueueModel } from '@/lib/platform-v7/logistics-ops-queue';
import type { PlatformV7ReceivingGateModel } from '@/lib/platform-v7/logistics-receiving-gate';
import type { PlatformV7ShipmentGateModel } from '@/lib/platform-v7/logistics-shipment-gate';
import type { PlatformV7TransportDocumentsGateModel } from '@/lib/platform-v7/logistics-transport-documents-gate';
import {
  platformV7LogisticsReleaseDecision,
  platformV7LogisticsReleaseNextAction,
  platformV7LogisticsReleaseReadinessBlockers,
  platformV7LogisticsReleaseReadinessModel,
  platformV7LogisticsReleaseReadinessReviewReasons,
  platformV7LogisticsReleaseReadinessStatus,
  platformV7LogisticsReleaseReadinessTone,
} from '@/lib/platform-v7/logistics-release-readiness';

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

const cleanQueue: PlatformV7LogisticsOpsQueueModel = {
  summary: { total: 1, clear: 1, review: 0, blocked: 0, critical: 0, moneyBlocked: 0 },
  rows: [],
  nextAction: 'Логистическая очередь чистая.',
  isClean: true,
};

describe('platform-v7 logistics release readiness', () => {
  it('allows release when every logistics gate is ready', () => {
    const model = platformV7LogisticsReleaseReadinessModel({
      dealId: 'DL-1',
      shipmentId: 'SHIP-1',
      shipmentGate: shipmentReady,
      receivingGate: receivingReady,
      transportDocumentsGate: docsReady,
      opsQueue: cleanQueue,
      activeManualHold: false,
      activeDispute: false,
    });

    expect(model.status).toBe('ready');
    expect(model.decision).toBe('allow_release');
    expect(model.canNotifyBank).toBe(true);
    expect(model.canRelease).toBe(true);
    expect(model.blockers).toEqual([]);
  });

  it('blocks bank notification when any gate cannot release', () => {
    const model = platformV7LogisticsReleaseReadinessModel({
      dealId: 'DL-1',
      shipmentId: 'SHIP-1',
      shipmentGate: { ...shipmentReady, canReleaseMoney: false, moneyImpact: 'hold' },
      receivingGate: receivingReady,
      transportDocumentsGate: docsReady,
      opsQueue: { ...cleanQueue, summary: { ...cleanQueue.summary, blocked: 1, moneyBlocked: 1 } },
      activeManualHold: false,
      activeDispute: false,
    });

    expect(model.status).toBe('blocked');
    expect(model.decision).toBe('hold_release');
    expect(model.canNotifyBank).toBe(false);
    expect(model.blockers).toContain('shipment-gate-not-ready');
    expect(model.blockers).toContain('logistics-queue-has-blocked-items');
  });

  it('allows partial release only through review state', () => {
    const model = platformV7LogisticsReleaseReadinessModel({
      dealId: 'DL-1',
      shipmentId: 'SHIP-1',
      shipmentGate: { ...shipmentReady, status: 'review', tone: 'warning', moneyImpact: 'partial_release', reviewReasons: ['weight-tolerance-exceeded'] },
      receivingGate: receivingReady,
      transportDocumentsGate: docsReady,
      opsQueue: { ...cleanQueue, summary: { ...cleanQueue.summary, clear: 0, review: 1 } },
      activeManualHold: false,
      activeDispute: false,
    });

    expect(model.status).toBe('review');
    expect(model.decision).toBe('allow_partial_release');
    expect(model.canNotifyBank).toBe(true);
    expect(model.canRelease).toBe(false);
  });

  it('keeps helper outputs deterministic', () => {
    const input = {
      dealId: 'DL-1',
      shipmentId: 'SHIP-1',
      shipmentGate: shipmentReady,
      receivingGate: receivingReady,
      transportDocumentsGate: docsReady,
      opsQueue: cleanQueue,
      activeManualHold: false,
      activeDispute: false,
    };

    expect(platformV7LogisticsReleaseReadinessBlockers(input)).toEqual([]);
    expect(platformV7LogisticsReleaseReadinessReviewReasons(input)).toEqual([]);
    expect(platformV7LogisticsReleaseReadinessStatus([], [])).toBe('ready');
    expect(platformV7LogisticsReleaseDecision('ready', input)).toBe('allow_release');
    expect(platformV7LogisticsReleaseReadinessTone('blocked')).toBe('danger');
    expect(platformV7LogisticsReleaseNextAction('ready', [], [])).toBe('Логистика готова к передаче в денежный контур.');
  });
});
