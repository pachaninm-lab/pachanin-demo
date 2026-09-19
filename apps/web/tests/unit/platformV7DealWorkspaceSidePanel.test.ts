import { describe, expect, it } from 'vitest';
import {
  platformV7DealWorkspaceNextOwnerTone,
  platformV7DealWorkspaceSidePanelIsValid,
  platformV7DealWorkspaceSidePanelModel,
} from '@/lib/platform-v7/deal-workspace-sidepanel';
import type { PlatformV7DealTimelineEvent } from '@/lib/platform-v7/deal-workspace-timeline';
import type { PlatformV7DealWorkspaceGateId, PlatformV7DealWorkspaceGateState } from '@/lib/platform-v7/deal-workspace-actions';

const timeline: PlatformV7DealTimelineEvent[] = [
  { id: 'e1', type: 'document', actor: 'Оператор', action: 'Документы собраны', at: '2026-04-25T10:00:00.000Z', severity: 'success' },
  { id: 'e2', type: 'money', actor: 'Банк', action: 'Запрошен выпуск', at: '2026-04-25T11:00:00.000Z', severity: 'warning' },
  { id: 'e3', type: 'dispute', actor: 'Арбитр', action: 'Спор открыт', at: '2026-04-25T09:00:00.000Z', severity: 'danger' },
];

const passedGates: PlatformV7DealWorkspaceGateState[] = (
  ['money', 'documents', 'fgis', 'transport', 'quality', 'evidence', 'compliance', 'degradation'] satisfies PlatformV7DealWorkspaceGateId[]
).map((id) => ({ id, passed: true }));

describe('platform-v7 deal workspace side panel', () => {
  it('builds side panel model with filtered timeline and action hierarchy', () => {
    const model = platformV7DealWorkspaceSidePanelModel({
      nextOwner: { role: 'bank', label: 'Банк', slaDeadline: '2026-04-26', critical: false },
      actionIds: ['request-release', 'release-funds', 'start-documents', 'complete-documents', 'open-bank'],
      timeline,
      timelineFilter: { type: 'money' },
    });

    expect(model.timeline.map((event) => event.id)).toEqual(['e2']);
    expect(model.actions.primary).toHaveLength(1);
    expect(model.actions.secondary).toHaveLength(2);
    expect(model.actions.tertiary).toHaveLength(1);
    expect(model.safeActions).toBeNull();
    expect(model.releaseGuard).toEqual({
      enabled: false,
      blockerCount: 0,
      blockerLabels: [],
      maturityMode: 'not-requested',
    });
    expect(model.timelineCount).toBe(1);
    expect(platformV7DealWorkspaceSidePanelIsValid(model)).toBe(true);
  });

  it('adds safe action evaluation when gate states are provided', () => {
    const model = platformV7DealWorkspaceSidePanelModel({
      nextOwner: { role: 'bank', label: 'Банк', critical: false },
      actionIds: ['release-funds', 'start-documents', 'open-bank'],
      gateStates: passedGates,
      timeline,
    });

    expect(model.safeActions).not.toBeNull();
    expect(model.safeActions?.primary[0].action.id).toBe('release-funds');
    expect(model.safeActions?.primary[0].enabled).toBe(true);
    expect(model.releaseGuard).toEqual({
      enabled: true,
      blockerCount: 0,
      blockerLabels: [],
      maturityMode: 'controlled-pilot',
    });
    expect(platformV7DealWorkspaceSidePanelIsValid(model)).toBe(true);
  });

  it('surfaces release blockers without breaking legacy action hierarchy', () => {
    const model = platformV7DealWorkspaceSidePanelModel({
      nextOwner: { role: 'operator', label: 'Оператор', critical: true },
      actionIds: ['release-funds', 'complete-documents', 'open-dispute'],
      gateStates: [
        ...passedGates.filter((gate) => gate.id !== 'evidence' && gate.id !== 'compliance'),
        { id: 'evidence', passed: false, reason: 'Evidence pack неполный.' },
        { id: 'compliance', passed: false, reason: 'Комплаенс не подтвердил сделку.' },
      ],
      timeline,
    });

    expect(model.actions.primary).toHaveLength(1);
    expect(model.actions.secondary).toHaveLength(2);
    expect(model.releaseGuard.enabled).toBe(false);
    expect(model.releaseGuard.blockerCount).toBe(2);
    expect(model.releaseGuard.blockerLabels).toEqual(['EvidenceGate', 'ComplianceGate']);
    expect(model.safeActions?.primary[0].blockers.map((blocker) => blocker.reason)).toEqual([
      'Evidence pack неполный.',
      'Комплаенс не подтвердил сделку.',
    ]);
  });

  it('maps next owner tone from SLA criticality', () => {
    expect(platformV7DealWorkspaceNextOwnerTone({ role: 'operator', label: 'Оператор', critical: true })).toBe('danger');
    expect(platformV7DealWorkspaceNextOwnerTone({ role: 'bank', label: 'Банк', slaDeadline: '2026-04-26', critical: false })).toBe('warning');
    expect(platformV7DealWorkspaceNextOwnerTone({ role: 'seller', label: 'Продавец', critical: false })).toBe('neutral');
  });
});
