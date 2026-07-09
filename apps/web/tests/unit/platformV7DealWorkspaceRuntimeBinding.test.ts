import { describe, expect, it } from 'vitest';
import type { DomainDeal } from '@/lib/domain/types';
import { buildP7DealWorkspaceRuntimeBinding, platformV7WorkspaceRuntimeStateToDeal360State } from '@/lib/platform-v7/deal-workspace-runtime-binding';

const baseDeal: DomainDeal = {
  id: 'DL-VP3-1',
  version: 1,
  sourceOfTruth: 'MANUAL',
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:00:00.000Z',
  grain: 'Пшеница',
  quantity: 100,
  unit: 'т',
  seller: { name: 'КФХ' },
  buyer: { name: 'Покупатель' },
  status: 'docs_complete',
  reservedAmount: 1_000_000,
  holdAmount: 0,
  riskScore: 12,
  slaDeadline: null,
  blockers: [],
  releaseAmount: 1_000_000,
};

describe('VP-3 deal workspace runtime binding', () => {
  it('builds a child-readable next step without claiming direct money movement', () => {
    const binding = buildP7DealWorkspaceRuntimeBinding({ deal: baseDeal, disputes: [], scenarioReleaseAllowed: true });

    expect(binding.dealId).toBe('DL-VP3-1');
    expect(binding.nextStepTitle).toBe('Передать основание в банк');
    expect(binding.nextStepInstruction).toContain('Движение денег остаётся внешним банковским событием');
    expect(binding.actionBoundary.safeReason).toContain('UI не меняет деньги напрямую');
    expect(binding.journey.map((step) => step.id)).toContain('bank_basis');
  });

  it('blocks bank basis when there is an open dispute', () => {
    const binding = buildP7DealWorkspaceRuntimeBinding({
      deal: baseDeal,
      disputes: [{
        id: 'DSP-1',
        version: 1,
        sourceOfTruth: 'MANUAL',
        createdAt: '2026-07-09T00:00:00.000Z',
        updatedAt: '2026-07-09T00:00:00.000Z',
        dealId: baseDeal.id,
        type: 'weight',
        title: 'Отклонение веса',
        reasonCode: 'weight_delta',
        holdAmount: 100_000,
        slaDaysLeft: 2,
        ballAt: 'arbitrator',
        status: 'open',
        evidence: { total: 2, uploaded: 1 },
        description: 'Нужно решение по спору.',
      }],
      scenarioReleaseAllowed: true,
    });

    expect(binding.blocked).toBe(true);
    expect(binding.nextStepTitle).toBe('Сначала убрать красный блокер');
    expect(binding.blockedReason).toContain('открытый спор');
    expect(binding.journey.find((step) => step.id === 'bank_basis')?.state).toBe('blocked');
  });

  it('maps runtime UI states to Deal360 visual states', () => {
    expect(platformV7WorkspaceRuntimeStateToDeal360State('done')).toBe('ok');
    expect(platformV7WorkspaceRuntimeStateToDeal360State('current')).toBe('wait');
    expect(platformV7WorkspaceRuntimeStateToDeal360State('wait')).toBe('manual');
    expect(platformV7WorkspaceRuntimeStateToDeal360State('blocked')).toBe('stop');
  });
});
