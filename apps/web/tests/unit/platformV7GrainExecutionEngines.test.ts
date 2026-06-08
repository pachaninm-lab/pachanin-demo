import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

import { createNextAction, sortNextActions } from '@/lib/platform-v7/grain-execution/automation/next-action-engine';
import {
  isDocumentRequirementSatisfied,
  buildDocumentRequirements,
  summarizeDocuments,
  documentBlockers,
} from '@/lib/platform-v7/grain-execution/automation/document-requirement-engine';
import { buildSdizGates, getSdizGateBlockers } from '@/lib/platform-v7/grain-execution/automation/sdiz-gate-engine';
import {
  logisticsIncidentAdjustment,
  logisticsIncidentBlockers,
} from '@/lib/platform-v7/grain-execution/automation/logistics-incident-engine';
import { calculateWeightBalance } from '@/lib/platform-v7/grain-execution/automation/weight-balance-engine';
import { calculateQualityDelta } from '@/lib/platform-v7/grain-execution/automation/quality-delta-engine';
import {
  createReleaseIdempotencyKey,
  qualityAdjustment,
  weightAdjustment,
  documentAdjustment,
  calculateMoneyProjection,
} from '@/lib/platform-v7/grain-execution/automation/money-release-engine';
import { calculateBatchReadiness } from '@/lib/platform-v7/grain-execution/automation/readiness-engine';
import { calculateNetback, rankOffersByNetback } from '@/lib/platform-v7/grain-execution/automation/netback-engine';
import { matchBatchesToRfq, calculateDeliveredPricePerTon } from '@/lib/platform-v7/grain-execution/automation/matching-engine';
import { evaluateSampleChain, nextSampleStep } from '@/lib/platform-v7/grain-execution/automation/sample-chain-engine';

// ─── helpers ──────────────────────────────────────────────────────────────────

const NOW = '2025-01-01T00:00:00Z';

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'DOC-001',
    dealId: 'D-001',
    relatedEntityType: 'deal' as const,
    relatedEntityId: 'D-001',
    documentType: 'contract' as const,
    required: true,
    status: 'required' as const,
    responsibleRole: 'seller' as const,
    blocksLotPublication: false,
    blocksShipment: false,
    blocksAcceptance: false,
    blocksMoneyRelease: true,
    externalSystem: 'manual' as const,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'B-001',
    ownerId: 'U-001',
    ownerName: 'Иванов',
    ownerRole: 'seller' as const,
    crop: 'Пшеница',
    gostClass: '3',
    harvestYear: 2025,
    totalVolumeTons: 100,
    availableVolumeTons: 80,
    reservedVolumeTons: 20,
    soldVolumeTons: 0,
    storageType: 'elevator' as const,
    storageLocationName: 'Элеватор Тамбов',
    region: 'Тамбовская область',
    fgisStatus: 'linked' as const,
    qualityProfileId: 'QP-001',
    readinessScore: 85,
    blockers: [],
    maturity: 'sandbox' as const,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'OFF-001',
    type: 'rfq_response' as const,
    batchId: 'B-001',
    sellerId: 'U-001',
    crop: 'Пшеница',
    volumeTons: 50,
    pricePerTon: { value: 15000, currency: 'RUB' as const },
    basis: 'EXW' as const,
    paymentTerms: 'prepay' as const,
    logisticsOption: 'buyer_pickup' as const,
    status: 'submitted' as const,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRfq(overrides: Record<string, unknown> = {}) {
  return {
    id: 'RFQ-001',
    buyerId: 'U-002',
    buyerName: 'Покупатель',
    crop: 'Пшеница',
    volumeTons: 50,
    basis: 'EXW' as const,
    deliveryLocationName: 'Тамбов',
    deliveryRegion: 'Тамбовская область',
    qualityRequirements: {},
    paymentTerms: 'prepay' as const,
    requiresLogistics: false,
    requiresIndependentLab: false,
    requiresBankReserve: false,
    documentRequirements: [],
    status: 'open' as const,
    maturity: 'sandbox' as const,
    createdAt: NOW,
    ...overrides,
  };
}

function makeQualityProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'QP-001',
    source: 'elevator_lab' as const,
    crop: 'Пшеница',
    maturity: 'sandbox' as const,
    ...overrides,
  };
}

function makeIncident(overrides: Record<string, unknown> = {}) {
  return {
    id: 'INC-001',
    dealId: 'D-001',
    logisticsOrderId: 'LO-001',
    type: 'route_deviation' as const,
    severity: 'critical' as const,
    title: 'Отклонение маршрута',
    moneyImpact: { value: 50000, currency: 'RUB' as const },
    status: 'open' as const,
    createdAt: NOW,
    ...overrides,
  };
}

function makeChain(overrides: Record<string, unknown> = {}) {
  return {
    id: 'SC-001',
    dealId: 'D-001',
    batchId: 'B-001',
    status: 'not_started' as const,
    photoIds: [],
    repeatAllowed: true,
    arbitrationSampleExists: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ─── source guard ─────────────────────────────────────────────────────────────

const ENGINE_FILES = [
  'lib/platform-v7/grain-execution/automation/next-action-engine.ts',
  'lib/platform-v7/grain-execution/automation/document-requirement-engine.ts',
  'lib/platform-v7/grain-execution/automation/sdiz-gate-engine.ts',
  'lib/platform-v7/grain-execution/automation/logistics-incident-engine.ts',
  'lib/platform-v7/grain-execution/automation/weight-balance-engine.ts',
  'lib/platform-v7/grain-execution/automation/quality-delta-engine.ts',
  'lib/platform-v7/grain-execution/automation/money-release-engine.ts',
  'lib/platform-v7/grain-execution/automation/readiness-engine.ts',
  'lib/platform-v7/grain-execution/automation/netback-engine.ts',
  'lib/platform-v7/grain-execution/automation/matching-engine.ts',
  'lib/platform-v7/grain-execution/automation/sample-chain-engine.ts',
];

describe('Source guard: grain execution engines', () => {
  it.each(ENGINE_FILES)('file exists: %s', (f) => {
    expect(existsSync(f)).toBe(true);
  });

  it.each(ENGINE_FILES)('no live fetch calls: %s', (f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/https?:\/\//);
  });
});

// ─── next-action-engine ───────────────────────────────────────────────────────

describe('next-action-engine', () => {
  it('createNextAction uses seed as id prefix', () => {
    const action = createNextAction({
      title: 'Проверить ФГИС',
      role: 'seller',
      actionType: 'link_fgis',
      targetRoute: '/platform-v7/batches',
      seed: 'batch-fgis',
    });
    expect(action.id).toBe('NA-batch-fgis');
  });

  it('createNextAction defaults priority to medium and requiresReason to false', () => {
    const action = createNextAction({
      title: 'Загрузить документ',
      role: 'seller',
      actionType: 'upload_document',
      targetRoute: '/docs',
    });
    expect(action.priority).toBe('medium');
    expect(action.requiresReason).toBe(false);
    expect(action.createsAuditEvent).toBe(true);
  });

  it('createNextAction respects explicit priority and requiresReason', () => {
    const action = createNextAction({
      title: 'Закрыть блокер',
      role: 'operator',
      priority: 'critical',
      actionType: 'resolve_blocker',
      targetRoute: '/blockers',
      requiresReason: true,
    });
    expect(action.priority).toBe('critical');
    expect(action.requiresReason).toBe(true);
  });

  it('sortNextActions orders critical → high → medium → low', () => {
    const actions = [
      createNextAction({ title: 'M', role: 'seller', priority: 'medium', actionType: 'publish_lot', targetRoute: '/', seed: 'm' }),
      createNextAction({ title: 'C', role: 'seller', priority: 'critical', actionType: 'link_fgis', targetRoute: '/', seed: 'c' }),
      createNextAction({ title: 'L', role: 'seller', priority: 'low', actionType: 'create_rfq', targetRoute: '/', seed: 'l' }),
      createNextAction({ title: 'H', role: 'seller', priority: 'high', actionType: 'publish_lot', targetRoute: '/', seed: 'h' }),
    ];
    const sorted = sortNextActions(actions);
    expect(sorted.map((a) => a.priority)).toEqual(['critical', 'high', 'medium', 'low']);
  });
});

// ─── document-requirement-engine ─────────────────────────────────────────────

describe('document-requirement-engine', () => {
  it('not required document is always satisfied', () => {
    const doc = makeDoc({ required: false, status: 'required' });
    expect(isDocumentRequirementSatisfied(doc as never)).toBe(true);
  });

  it('status not_required is satisfied', () => {
    const doc = makeDoc({ required: true, status: 'not_required' });
    expect(isDocumentRequirementSatisfied(doc as never)).toBe(true);
  });

  it('rejected document is not satisfied', () => {
    const doc = makeDoc({ status: 'rejected' });
    expect(isDocumentRequirementSatisfied(doc as never)).toBe(false);
  });

  it('manual external system: uploaded satisfies', () => {
    const doc = makeDoc({ status: 'uploaded', externalSystem: 'manual' });
    expect(isDocumentRequirementSatisfied(doc as never)).toBe(true);
  });

  it('fgis external system: signed without confirmed externalStatus not satisfied', () => {
    const doc = makeDoc({ status: 'signed', externalSystem: 'fgis', externalStatus: 'required' });
    expect(isDocumentRequirementSatisfied(doc as never)).toBe(false);
  });

  it('fgis external system: signed with confirmed externalStatus satisfied', () => {
    const doc = makeDoc({ status: 'signed', externalSystem: 'fgis', externalStatus: 'подтверждено' });
    expect(isDocumentRequirementSatisfied(doc as never)).toBe(true);
  });

  it('buildDocumentRequirements EXW produces 5 documents', () => {
    const docs = buildDocumentRequirements({ dealId: 'D-001', relatedEntityId: 'D-001', basis: 'EXW', createdAt: NOW });
    expect(docs).toHaveLength(5);
  });

  it('buildDocumentRequirements CPT produces 10 documents', () => {
    const docs = buildDocumentRequirements({ dealId: 'D-001', relatedEntityId: 'D-001', basis: 'CPT', createdAt: NOW });
    expect(docs).toHaveLength(10);
  });

  it('summarizeDocuments counts correctly', () => {
    const docs = [
      makeDoc({ id: 'D1', status: 'uploaded', externalSystem: 'manual', blocksMoneyRelease: true }),
      makeDoc({ id: 'D2', status: 'required', blocksMoneyRelease: true }),
      makeDoc({ id: 'D3', required: false, status: 'required', blocksMoneyRelease: false }),
    ];
    const summary = summarizeDocuments(docs as never);
    expect(summary.total).toBe(3);
    expect(summary.ready).toBe(2);
    expect(summary.missing).toBe(1);
    expect(summary.blockingMoneyRelease).toBe(1);
  });

  it('documentBlockers only includes required, money-blocking, unsatisfied documents', () => {
    const docs = [
      makeDoc({ id: 'D1', status: 'required', blocksMoneyRelease: true }),
      makeDoc({ id: 'D2', status: 'uploaded', externalSystem: 'manual', blocksMoneyRelease: true }),
      makeDoc({ id: 'D3', status: 'required', blocksMoneyRelease: false }),
    ];
    const blockers = documentBlockers(docs as never);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].relatedEntityId).toBe('D1');
  });
});

// ─── sdiz-gate-engine ─────────────────────────────────────────────────────────

describe('sdiz-gate-engine', () => {
  it('buildSdizGates EXW produces 1 gate (realization only)', () => {
    const gates = buildSdizGates({ batchId: 'B-001', basis: 'EXW', responsibleSellerId: 'U-001', volumeTons: 100, createdAt: NOW });
    expect(gates).toHaveLength(1);
    expect(gates[0].operationType).toBe('realization');
    expect(gates[0].blockingMoneyRelease).toBe(true);
  });

  it('buildSdizGates CPT produces 4 gates', () => {
    const gates = buildSdizGates({ batchId: 'B-001', basis: 'CPT', responsibleSellerId: 'U-001', volumeTons: 100, createdAt: NOW });
    expect(gates).toHaveLength(4);
    expect(gates.map((g) => g.operationType)).toEqual(expect.arrayContaining(['realization', 'shipment', 'transportation', 'acceptance']));
  });

  it('getSdizGateBlockers returns empty for satisfied gates (redeemed)', () => {
    const gates = buildSdizGates({ batchId: 'B-001', basis: 'EXW', responsibleSellerId: 'U-001', volumeTons: 100, createdAt: NOW });
    const satisfied = gates.map((g) => ({ ...g, status: 'redeemed' as const }));
    expect(getSdizGateBlockers(satisfied)).toHaveLength(0);
  });

  it('getSdizGateBlockers returns blockers for required unsatisfied gate', () => {
    const gates = buildSdizGates({ batchId: 'B-001', basis: 'EXW', responsibleSellerId: 'U-001', volumeTons: 100, createdAt: NOW });
    const blockers = getSdizGateBlockers(gates);
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.some((b) => b.blocks === 'money_release')).toBe(true);
  });

  it('getSdizGateBlockers critical severity for error status', () => {
    const gates = buildSdizGates({ batchId: 'B-001', basis: 'EXW', responsibleSellerId: 'U-001', volumeTons: 100, createdAt: NOW });
    const errored = gates.map((g) => ({ ...g, status: 'error' as const }));
    const blockers = getSdizGateBlockers(errored);
    expect(blockers.every((b) => b.severity === 'critical')).toBe(true);
  });
});

// ─── logistics-incident-engine ────────────────────────────────────────────────

describe('logistics-incident-engine', () => {
  it('logisticsIncidentAdjustment returns null for resolved incident', () => {
    const incident = makeIncident({ status: 'resolved' });
    expect(logisticsIncidentAdjustment(incident as never)).toBeNull();
  });

  it('logisticsIncidentAdjustment returns null when moneyImpact is zero', () => {
    const incident = makeIncident({ moneyImpact: { value: 0, currency: 'RUB' } });
    expect(logisticsIncidentAdjustment(incident as never)).toBeNull();
  });

  it('logisticsIncidentAdjustment returns adjustment for open critical incident with impact', () => {
    const incident = makeIncident();
    const adj = logisticsIncidentAdjustment(incident as never);
    expect(adj).not.toBeNull();
    expect(adj!.amount.value).toBe(50000);
    expect(adj!.blocksFullRelease).toBe(true);
    expect(adj!.status).toBe('disputed');
  });

  it('logisticsIncidentBlockers returns empty for resolved incidents', () => {
    const incidents = [makeIncident({ status: 'resolved' }), makeIncident({ id: 'INC-002', status: 'closed' })];
    expect(logisticsIncidentBlockers(incidents as never)).toHaveLength(0);
  });

  it('logisticsIncidentBlockers includes critical route_deviation incident', () => {
    const incidents = [makeIncident()];
    const blockers = logisticsIncidentBlockers(incidents as never);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].blocks).toBe('money_release');
    expect(blockers[0].severity).toBe('critical');
  });
});

// ─── weight-balance-engine ────────────────────────────────────────────────────

describe('weight-balance-engine', () => {
  const baseParams = {
    id: 'WB-001',
    dealId: 'D-001',
    batchId: 'B-001',
    contractedVolumeTons: 100,
    pricePerTon: { value: 15000, currency: 'RUB' as const },
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('status not_started when no weights provided', () => {
    const wb = calculateWeightBalance(baseParams);
    expect(wb.status).toBe('not_started');
    expect(wb.weightDeviationMoneyImpact.value).toBe(0);
  });

  it('status loading_weight_captured when loaded net tons provided but not accepted', () => {
    const wb = calculateWeightBalance({ ...baseParams, loadedNetTons: 99 });
    expect(wb.status).toBe('loading_weight_captured');
  });

  it('within_tolerance when loss within default 0.5% tolerance', () => {
    const wb = calculateWeightBalance({ ...baseParams, acceptedNetTons: 99.6 });
    expect(wb.status).toBe('within_tolerance');
    expect(wb.weightDeviationMoneyImpact.value).toBe(0);
  });

  it('deviation status and positive impact when loss exceeds tolerance', () => {
    const wb = calculateWeightBalance({ ...baseParams, acceptedNetTons: 95 });
    expect(wb.status).toBe('deviation');
    expect(wb.weightDeviationMoneyImpact.value).toBeGreaterThan(0);
  });

  it('calculates loadedNetTons from gross minus tare', () => {
    const wb = calculateWeightBalance({ ...baseParams, loadedGrossTons: 105, loadedTareTons: 5 });
    expect(wb.loadedNetTons).toBe(100);
  });
});

// ─── quality-delta-engine ─────────────────────────────────────────────────────

describe('quality-delta-engine', () => {
  const baseParams = {
    id: 'QD-001',
    dealId: 'D-001',
    batchId: 'B-001',
    agreedQualityProfile: makeQualityProfile({ moisture: 14, gluten: 24, natWeight: 770 }),
    pricePerTon: { value: 15000, currency: 'RUB' as const },
    volumeTons: 100,
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('not_measured when no accepted quality profile', () => {
    const delta = calculateQualityDelta(baseParams as never);
    expect(delta.status).toBe('not_measured');
    expect(delta.totalHoldAmount.value).toBe(0);
    expect(delta.items).toHaveLength(0);
  });

  it('within_tolerance when actual matches agreed quality', () => {
    const delta = calculateQualityDelta({
      ...baseParams,
      acceptedQualityProfile: makeQualityProfile({ id: 'QP-002', moisture: 14, gluten: 24, natWeight: 770 }),
    } as never);
    expect(delta.status).toBe('within_tolerance');
    expect(delta.totalHoldAmount.value).toBe(0);
  });

  it('discount_required for small moisture deviation', () => {
    const delta = calculateQualityDelta({
      ...baseParams,
      acceptedQualityProfile: makeQualityProfile({ id: 'QP-002', moisture: 15.5, gluten: 24, natWeight: 770 }),
    } as never);
    expect(delta.status).toBe('discount_required');
    expect(delta.totalHoldAmount.value).toBeGreaterThan(0);
    expect(delta.items.length).toBeGreaterThan(0);
  });

  it('dispute_required when hold exceeds 1.5% of gross', () => {
    const delta = calculateQualityDelta({
      ...baseParams,
      pricePerTon: { value: 15000, currency: 'RUB' as const },
      volumeTons: 100,
      acceptedQualityProfile: makeQualityProfile({
        id: 'QP-002',
        moisture: 20,
        gluten: 15,
        natWeight: 700,
        weedImpurity: 5,
      }),
    } as never);
    expect(delta.status).toBe('dispute_required');
  });
});

// ─── money-release-engine ────────────────────────────────────────────────────

describe('money-release-engine', () => {
  it('createReleaseIdempotencyKey is deterministic', () => {
    const key1 = createReleaseIdempotencyKey({ dealId: 'D-001', operation: 'release', amount: 100000, currency: 'RUB' });
    const key2 = createReleaseIdempotencyKey({ dealId: 'D-001', operation: 'release', amount: 100000, currency: 'RUB' });
    expect(key1).toBe(key2);
  });

  it('createReleaseIdempotencyKey contains all params', () => {
    const key = createReleaseIdempotencyKey({ dealId: 'D-001', operation: 'release', amount: 100000, counterpartyId: 'CP-001', currency: 'RUB' });
    expect(key).toContain('D-001');
    expect(key).toContain('release');
    expect(key).toContain('CP-001');
    expect(key).toContain('RUB');
  });

  it('qualityAdjustment returns null for zero hold', () => {
    const delta = { id: 'QD-001', dealId: 'D-001', batchId: 'B-001', items: [], totalHoldAmount: { value: 0, currency: 'RUB' as const }, status: 'within_tolerance' as const, totalDiscount: { value: 0, currency: 'RUB' as const }, createdAt: NOW, updatedAt: NOW, agreedQualityProfileId: 'QP-001' };
    expect(qualityAdjustment(delta)).toBeNull();
  });

  it('qualityAdjustment returns adjustment for positive hold', () => {
    const delta = { id: 'QD-001', dealId: 'D-001', batchId: 'B-001', items: [], totalHoldAmount: { value: 5000, currency: 'RUB' as const }, status: 'discount_required' as const, totalDiscount: { value: 5000, currency: 'RUB' as const }, createdAt: NOW, updatedAt: NOW, agreedQualityProfileId: 'QP-001' };
    const adj = qualityAdjustment(delta);
    expect(adj).not.toBeNull();
    expect(adj!.amount.value).toBe(5000);
    expect(adj!.type).toBe('quality_discount');
  });

  it('weightAdjustment returns null for zero impact', () => {
    const wb = calculateWeightBalance({ id: 'WB-001', dealId: 'D-001', batchId: 'B-001', contractedVolumeTons: 100, acceptedNetTons: 99.8, pricePerTon: { value: 15000, currency: 'RUB' }, createdAt: NOW, updatedAt: NOW });
    expect(weightAdjustment(wb)).toBeNull();
  });

  it('weightAdjustment returns adjustment for positive deviation impact', () => {
    const wb = calculateWeightBalance({ id: 'WB-001', dealId: 'D-001', batchId: 'B-001', contractedVolumeTons: 100, acceptedNetTons: 95, pricePerTon: { value: 15000, currency: 'RUB' }, createdAt: NOW, updatedAt: NOW });
    const adj = weightAdjustment(wb);
    expect(adj).not.toBeNull();
    expect(adj!.type).toBe('weight_deviation');
  });

  it('documentAdjustment returns null for satisfied document', () => {
    const doc = makeDoc({ status: 'uploaded', externalSystem: 'manual', blocksMoneyRelease: true });
    expect(documentAdjustment(doc as never)).toBeNull();
  });

  it('calculateMoneyProjection: no blockers → releaseAllowed when readyToRelease > 0', () => {
    const proj = calculateMoneyProjection({ dealId: 'D-001', grossDealAmount: 1000000, reservedAmount: 1000000 });
    expect(proj.releaseAllowed).toBe(true);
    expect(proj.readyToReleaseAmount.value).toBe(1000000);
  });

  it('calculateMoneyProjection: bank not_requested → releaseAllowed false', () => {
    const proj = calculateMoneyProjection({ dealId: 'D-001', grossDealAmount: 1000000, reservedAmount: 1000000, bankConfirmationStatus: 'not_requested' });
    expect(proj.releaseAllowed).toBe(false);
    expect(proj.releaseBlockedReasons.length).toBeGreaterThan(0);
  });
});

// ─── readiness-engine ─────────────────────────────────────────────────────────

describe('readiness-engine (calculateBatchReadiness)', () => {
  it('zero available volume → blocked status with volume blocker', () => {
    const batch = makeBatch({ availableVolumeTons: 0 });
    const result = calculateBatchReadiness(batch as never);
    expect(result.status).toBe('blocked');
    expect(result.blockers.some((b) => b.type === 'volume')).toBe(true);
  });

  it('fgis not_linked → fgis blocker added', () => {
    const batch = makeBatch({ fgisStatus: 'not_linked' });
    const result = calculateBatchReadiness(batch as never);
    expect(result.blockers.some((b) => b.type === 'fgis')).toBe(true);
  });

  it('missing quality profile → quality blocker', () => {
    const batch = makeBatch({ qualityProfileId: undefined });
    const result = calculateBatchReadiness(batch as never);
    expect(result.blockers.some((b) => b.type === 'quality')).toBe(true);
  });

  it('missing storage → storage blocker and score deducted', () => {
    const batch = makeBatch({ storageLocationName: '', region: '' });
    const result = calculateBatchReadiness(batch as never);
    expect(result.blockers.some((b) => b.type === 'storage')).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  it('fully ready batch → ready_for_sale status and score ≥ 80', () => {
    const batch = makeBatch();
    const result = calculateBatchReadiness(batch as never);
    expect(result.status).toBe('ready_for_sale');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.nextActions.length).toBeGreaterThan(0);
  });
});

// ─── netback-engine ───────────────────────────────────────────────────────────

describe('netback-engine', () => {
  const baseNetback = {
    id: 'NB-001',
    batchId: 'B-001',
    offer: makeOffer(),
    createdAt: NOW,
  };

  it('grossAmount = pricePerTon × volume', () => {
    const nb = calculateNetback(baseNetback as never);
    expect(nb.grossAmount.value).toBe(15000 * 50);
  });

  it('EXW: logistics cost is zero (default, no CPT)', () => {
    const nb = calculateNetback(baseNetback as never);
    expect(nb.logisticsCost.value).toBe(0);
  });

  it('CPT: logistics cost is included (default 820/t)', () => {
    const offer = makeOffer({ basis: 'CPT' });
    const nb = calculateNetback({ ...baseNetback, offer } as never);
    expect(nb.logisticsCost.value).toBe(820 * 50);
  });

  it('netAmount is always ≥ 0', () => {
    const offer = makeOffer({ pricePerTon: { value: 1, currency: 'RUB' } });
    const nb = calculateNetback({ ...baseNetback, offer } as never);
    expect(nb.netAmount.value).toBeGreaterThanOrEqual(0);
  });

  it('rankOffersByNetback sorts by netPricePerTon descending', () => {
    const nb1 = calculateNetback({ ...baseNetback, id: 'NB-001', offer: makeOffer({ pricePerTon: { value: 15000, currency: 'RUB' } }) } as never);
    const nb2 = calculateNetback({ ...baseNetback, id: 'NB-002', offer: makeOffer({ id: 'OFF-002', pricePerTon: { value: 18000, currency: 'RUB' } }) } as never);
    const ranked = rankOffersByNetback([nb1, nb2]);
    expect(ranked[0].id).toBe('NB-002');
  });
});

// ─── matching-engine ──────────────────────────────────────────────────────────

describe('matching-engine', () => {
  it('calculateDeliveredPricePerTon: same region → lower logistics cost (uses 550/t)', () => {
    const batch = makeBatch({ region: 'Тамбовская область' });
    const rfq = makeRfq({ deliveryRegion: 'Тамбовская область', basis: 'CPT', requiresLogistics: true, maxPricePerTon: { value: 15000, currency: 'RUB' } });
    const price = calculateDeliveredPricePerTon(batch as never, rfq as never);
    expect(price.value).toBe(15000 + 550);
  });

  it('calculateDeliveredPricePerTon: readiness < 70 → 350 discount applied', () => {
    const batch = makeBatch({ region: 'Другой', readinessScore: 60 });
    const rfq = makeRfq({ deliveryRegion: 'Другой', requiresLogistics: false, maxPricePerTon: { value: 15000, currency: 'RUB' } });
    const price = calculateDeliveredPricePerTon(batch as never, rfq as never);
    expect(price.value).toBe(15000 - 350);
  });

  it('matchBatchesToRfq: crop match raises score above threshold', () => {
    const batch = makeBatch({ fgisStatus: 'linked', qualityProfileId: 'QP-001', readinessScore: 85, region: 'Тамбовская область' });
    const rfq = makeRfq({ crop: 'Пшеница', gostClass: '3', deliveryRegion: 'Тамбовская область', volumeTons: 50 });
    const results = matchBatchesToRfq(rfq as never, [batch as never]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThanOrEqual(35);
  });

  it('matchBatchesToRfq: filters out batches with score < 35', () => {
    const batch = makeBatch({ crop: 'Ячмень', region: 'Алтай', availableVolumeTons: 1, fgisStatus: 'blocked', qualityProfileId: undefined, readinessScore: 20 });
    const rfq = makeRfq({ crop: 'Пшеница', deliveryRegion: 'Москва', minVolumeTons: 500 });
    const results = matchBatchesToRfq(rfq as never, [batch as never]);
    expect(results).toHaveLength(0);
  });
});

// ─── sample-chain-engine ──────────────────────────────────────────────────────

describe('sample-chain-engine', () => {
  it('evaluateSampleChain: missing takenAt → manual_review with blocker', () => {
    const chain = makeChain({ status: 'sample_taken' });
    const result = evaluateSampleChain(chain as never);
    expect(result.status).toBe('manual_review');
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('evaluateSampleChain: complete chain → ready', () => {
    const chain = makeChain({
      status: 'protocol_ready',
      takenAt: NOW,
      takenByRole: 'elevator',
      takenByName: 'Петров',
      sealNumber: 'SEAL-001',
      photoIds: ['P-001'],
    });
    const result = evaluateSampleChain(chain as never);
    expect(result.status).toBe('ready');
    expect(result.blockers).toHaveLength(0);
  });

  it('nextSampleStep returns correct step for each status', () => {
    expect(nextSampleStep(makeChain({ status: 'not_started' }) as never)).toContain('Отобрать');
    expect(nextSampleStep(makeChain({ status: 'sealed' }) as never)).toContain('лаборатори');
    expect(nextSampleStep(makeChain({ status: 'closed' }) as never)).toContain('закрыта');
  });
});
