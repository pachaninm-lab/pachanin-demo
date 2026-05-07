import { describe, expect, it } from 'vitest';
import { buildSdizGates, getSdizGateBlockers } from '@/lib/platform-v7/grain-execution/automation/sdiz-gate-engine';
import type { SdizGate } from '@/lib/platform-v7/grain-execution/types';

const createdAt = '2026-05-05T09:00:00.000Z';

function buildCptGates(): SdizGate[] {
  return buildSdizGates({
    batchId: 'BATCH-1',
    dealId: 'DL-1',
    logisticsOrderId: 'LOG-1',
    routeLegId: 'LEG-1',
    basis: 'CPT',
    responsibleSellerId: 'SELLER-1',
    responsibleBuyerId: 'BUYER-1',
    volumeTons: 600,
    createdAt,
  });
}

describe('platform-v7 SDIZ stage blocking consistency', () => {
  it('returns blockers for every stage blocked by CPT SDIZ gates', () => {
    const blockers = getSdizGateBlockers(buildCptGates());

    expect(new Set(blockers.map((blocker) => blocker.blocks))).toEqual(new Set([
      'lot_publication',
      'deal_creation',
      'shipment',
      'acceptance',
      'money_release',
    ]));
  });

  it('does not collapse shipment and acceptance blockers into money release', () => {
    const transportationGate = buildCptGates().find((gate) => gate.operationType === 'transportation');
    expect(transportationGate).toBeDefined();

    const blockers = getSdizGateBlockers([transportationGate!]);

    expect(blockers.map((blocker) => blocker.blocks).sort()).toEqual(['acceptance', 'money_release', 'shipment']);
    expect(blockers.map((blocker) => blocker.id)).toEqual(expect.arrayContaining([
      'SDIZ-BATCH-1-transportation-shipment-block',
      'SDIZ-BATCH-1-transportation-acceptance-block',
      'SDIZ-BATCH-1-transportation-money_release-block',
    ]));
  });

  it('keeps realization blocker on publication, deal creation and money release', () => {
    const realizationGate = buildCptGates().find((gate) => gate.operationType === 'realization');
    expect(realizationGate).toBeDefined();

    expect(getSdizGateBlockers([realizationGate!]).map((blocker) => blocker.blocks).sort()).toEqual([
      'deal_creation',
      'lot_publication',
      'money_release',
    ]);
  });

  it('treats manual review as critical and does not mark signed-only gate as satisfied', () => {
    const shipmentGate = buildCptGates().find((gate) => gate.operationType === 'shipment')!;
    const manualReviewGate = { ...shipmentGate, status: 'manual_review' as const };
    const signedGate = { ...shipmentGate, status: 'signed' as const };
    const sentGate = { ...shipmentGate, status: 'sent' as const };

    expect(getSdizGateBlockers([manualReviewGate]).every((blocker) => blocker.severity === 'critical')).toBe(true);
    expect(getSdizGateBlockers([signedGate]).length).toBeGreaterThan(0);
    expect(getSdizGateBlockers([sentGate])).toEqual([]);
  });
});
