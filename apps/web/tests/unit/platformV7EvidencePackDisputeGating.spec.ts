import { describe, expect, it } from 'vitest';
import { calculateEvidencePackReadiness, canPrepareDisputeDecision, evidencePackBlocker, prepareDisputeDecision } from '@/lib/platform-v7/grain-execution/automation/evidence-pack-engine';
import { money } from '@/lib/platform-v7/grain-execution/format';
import type { Dispute, EvidencePack } from '@/lib/platform-v7/grain-execution/types';

const createdAt = '2026-05-05T09:00:00.000Z';

const completePack: EvidencePack = {
  id: 'EVP-1',
  dealId: 'DL-1',
  batchId: 'BATCH-1',
  documentIds: ['DOC-1'],
  weightEvidenceIds: ['WEIGHT-1'],
  photoIds: ['PHOTO-1'],
  routeEventIds: ['ROUTE-1'],
  labProtocolIds: ['LAB-1'],
  sampleChainIds: ['SAMPLE-1'],
  supportMessageIds: [],
  decisionIds: [],
  createdAt,
  updatedAt: createdAt,
};

const dispute: Dispute = {
  id: 'DSP-1',
  dealId: 'DL-1',
  batchId: 'BATCH-1',
  logisticsOrderId: 'LOG-1',
  reason: 'quality',
  status: 'under_review',
  disputedAmount: money(203_000),
  undisputedAmount: money(3_355_466),
  openedByRole: 'buyer',
  openedByPartyId: 'BUYER-1',
  evidencePackId: 'EVP-1',
  createdAt,
  updatedAt: createdAt,
};

describe('platform-v7 evidence pack dispute decision gating', () => {
  it('scores complete evidence pack as ready for dispute decision', () => {
    expect(calculateEvidencePackReadiness(completePack)).toEqual({
      evidencePackId: 'EVP-1',
      ready: true,
      score: 100,
      missing: [],
      present: ['documents', 'weight', 'photos', 'route', 'lab', 'sample_chain'],
    });
    expect(evidencePackBlocker(completePack)).toBeNull();
    expect(canPrepareDisputeDecision(completePack)).toBe(true);
  });

  it('blocks dispute decision when evidence pack is incomplete', () => {
    const incompletePack: EvidencePack = {
      ...completePack,
      labProtocolIds: [],
      sampleChainIds: [],
      routeEventIds: [],
    };

    expect(calculateEvidencePackReadiness(incompletePack)).toEqual({
      evidencePackId: 'EVP-1',
      ready: false,
      score: 50,
      missing: ['route', 'lab', 'sample_chain'],
      present: ['documents', 'weight', 'photos'],
    });
    expect(evidencePackBlocker(incompletePack)).toEqual(expect.objectContaining({
      id: 'EVP-1-dispute-decision-block',
      type: 'dispute',
      severity: 'critical',
      blocks: 'deal_closing',
      responsibleRole: 'operator',
      relatedEntityType: 'evidence_pack',
      relatedEntityId: 'EVP-1',
    }));
    expect(evidencePackBlocker(incompletePack)?.description).toContain('лабораторный протокол');
    expect(prepareDisputeDecision({ dispute, evidencePack: incompletePack, decision: 'partial_hold', reason: 'Недостаточно доказательств.', createdAt })).toBeNull();
  });

  it('prepares dispute decision only after required evidence is complete', () => {
    expect(prepareDisputeDecision({
      dispute,
      evidencePack: completePack,
      decision: 'partial_hold',
      reason: 'Подтверждены отклонения качества и веса.',
      releaseAmount: money(100_000),
      holdAmount: money(103_000),
      decidedByName: 'Оператор сделки',
      createdAt,
    })).toEqual({
      id: 'DD-DSP-1',
      disputeId: 'DSP-1',
      dealId: 'DL-1',
      decision: 'partial_hold',
      reason: 'Подтверждены отклонения качества и веса.',
      releaseAmount: money(100_000),
      holdAmount: money(103_000),
      penaltyAmount: undefined,
      decidedByRole: 'operator',
      decidedByName: 'Оператор сделки',
      createdAt,
    });
  });
});
