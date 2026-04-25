import { describe, expect, it } from 'vitest';
import {
  platformV7DealWorkspaceNextOwnerTone,
  platformV7DealWorkspaceSidePanelIsValid,
  platformV7DealWorkspaceSidePanelModel,
} from '@/lib/platform-v7/deal-workspace-sidepanel';
import type { PlatformV7DealTimelineEvent } from '@/lib/platform-v7/deal-workspace-timeline';

const timeline: PlatformV7DealTimelineEvent[] = [
  { id: 'e1', type: 'document', actor: 'Оператор', action: 'Документы собраны', at: '2026-04-25T10:00:00.000Z', severity: 'success' },
  { id: 'e2', type: 'money', actor: 'Банк', action: 'Запрошен выпуск', at: '2026-04-25T11:00:00.000Z', severity: 'warning' },
  { id: 'e3', type: 'dispute', actor: 'Арбитр', action: 'Спор открыт', at: '2026-04-25T09:00:00.000Z', severity: 'danger' },
];

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
    expect(model.timelineCount).toBe(1);
    expect(platformV7DealWorkspaceSidePanelIsValid(model)).toBe(true);
  });

  it('maps next owner tone from SLA criticality', () => {
    expect(platformV7DealWorkspaceNextOwnerTone({ role: 'operator', label: 'Оператор', critical: true })).toBe('danger');
    expect(platformV7DealWorkspaceNextOwnerTone({ role: 'bank', label: 'Банк', slaDeadline: '2026-04-26', critical: false })).toBe('warning');
    expect(platformV7DealWorkspaceNextOwnerTone({ role: 'seller', label: 'Продавец', critical: false })).toBe('neutral');
  });
});
