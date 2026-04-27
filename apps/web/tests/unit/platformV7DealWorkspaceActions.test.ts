import { describe, expect, it } from 'vitest';
import {
  platformV7DealWorkspaceActionById,
  platformV7DealWorkspaceActionHasFullReleaseGuard,
  platformV7DealWorkspaceActionPlan,
  platformV7DealWorkspaceActionPlanIsValid,
  platformV7DealWorkspaceActions,
  platformV7DealWorkspaceEvaluateAction,
  platformV7DealWorkspaceGateLabel,
  platformV7DealWorkspaceSafeActionPlan,
  type PlatformV7DealWorkspaceGateId,
  type PlatformV7DealWorkspaceGateState,
} from '@/lib/platform-v7/deal-workspace-actions';

const fullPassedGateSet: PlatformV7DealWorkspaceGateState[] = (
  ['money', 'documents', 'fgis', 'transport', 'quality', 'evidence', 'compliance', 'degradation'] satisfies PlatformV7DealWorkspaceGateId[]
).map((id) => ({ id, passed: true }));

describe('platform-v7 deal workspace actions', () => {
  it('keeps the canonical action catalog', () => {
    expect(platformV7DealWorkspaceActions().map((action) => action.id)).toEqual([
      'request-release',
      'release-funds',
      'start-documents',
      'complete-documents',
      'open-dispute',
      'resolve-dispute',
      'open-bank',
      'open-disputes',
    ]);
  });

  it('finds actions by id', () => {
    expect(platformV7DealWorkspaceActionById('open-bank')).toMatchObject({
      label: 'Банк',
      href: '/platform-v7/bank',
      kind: 'tertiary',
      maturityMode: 'controlled-pilot',
      irreversible: false,
    });
  });

  it('enforces one primary and two secondary actions in a plan', () => {
    const plan = platformV7DealWorkspaceActionPlan([
      'request-release',
      'release-funds',
      'start-documents',
      'complete-documents',
      'open-dispute',
      'open-bank',
      'open-disputes',
    ]);

    expect(plan.primary).toHaveLength(1);
    expect(plan.secondary).toHaveLength(2);
    expect(plan.tertiary).toHaveLength(2);
    expect(platformV7DealWorkspaceActionPlanIsValid(plan)).toBe(true);
  });

  it('requires full Gate Matrix before irreversible fund release', () => {
    const action = platformV7DealWorkspaceActionById('release-funds');

    expect(action.irreversible).toBe(true);
    expect(action.requiredGates).toEqual([
      'money',
      'documents',
      'fgis',
      'transport',
      'quality',
      'evidence',
      'compliance',
      'degradation',
    ]);
    expect(platformV7DealWorkspaceActionHasFullReleaseGuard('release-funds')).toBe(true);
  });

  it('blocks direct money release when any gate is missing or failed', () => {
    const evaluation = platformV7DealWorkspaceEvaluateAction('release-funds', [
      ...fullPassedGateSet.filter((gate) => gate.id !== 'fgis' && gate.id !== 'transport'),
      { id: 'fgis', passed: false, reason: 'СДИЗ не подтверждён во внешнем контуре.' },
    ]);

    expect(evaluation.enabled).toBe(false);
    expect(evaluation.blockers).toEqual([
      { gateId: 'fgis', label: 'FGISGate', reason: 'СДИЗ не подтверждён во внешнем контуре.' },
      { gateId: 'transport', label: 'TransportGate', reason: 'TransportGate не подтверждён.' },
    ]);
  });

  it('enables money release only after every required gate passes', () => {
    const evaluation = platformV7DealWorkspaceEvaluateAction('release-funds', fullPassedGateSet);

    expect(evaluation.enabled).toBe(true);
    expect(evaluation.blockers).toHaveLength(0);
    expect(evaluation.maturityMode).toBe('controlled-pilot');
    expect(evaluation.rollback).toContain('refund/dispute flow');
  });

  it('keeps safe action plan hierarchy with gate evaluations', () => {
    const plan = platformV7DealWorkspaceSafeActionPlan([
      'release-funds',
      'start-documents',
      'resolve-dispute',
      'open-bank',
    ], fullPassedGateSet);

    expect(plan.primary).toHaveLength(1);
    expect(plan.primary[0].enabled).toBe(true);
    expect(plan.secondary).toHaveLength(2);
    expect(plan.tertiary).toHaveLength(1);
  });

  it('keeps user-facing gate labels stable', () => {
    expect(platformV7DealWorkspaceGateLabel('money')).toBe('MoneyGate');
    expect(platformV7DealWorkspaceGateLabel('degradation')).toBe('DegradationGate');
  });
});
