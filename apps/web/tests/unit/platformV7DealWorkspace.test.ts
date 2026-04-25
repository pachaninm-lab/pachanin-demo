import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_DEAL_WORKSPACE_TABS,
  platformV7DealWorkspaceModel,
  platformV7DealWorkspaceTabByHash,
  platformV7DealWorkspaceTabById,
} from '@/lib/platform-v7/deal-workspace';

describe('platform-v7 deal workspace model', () => {
  it('keeps the required five workspace tabs', () => {
    expect(PLATFORM_V7_DEAL_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      'overview',
      'documents',
      'logistics',
      'money',
      'dispute',
    ]);
  });

  it('builds workspace model with action hierarchy constraints', () => {
    expect(platformV7DealWorkspaceModel()).toEqual({
      tabs: PLATFORM_V7_DEAL_WORKSPACE_TABS,
      defaultTab: 'overview',
      maxPrimaryActions: 1,
      maxSecondaryActions: 2,
      mobileSidePanel: 'bottom-sheet',
    });
  });

  it('resolves tabs by hash and id with overview fallback', () => {
    expect(platformV7DealWorkspaceTabByHash('#money').id).toBe('money');
    expect(platformV7DealWorkspaceTabByHash('#unknown').id).toBe('overview');
    expect(platformV7DealWorkspaceTabById('documents').hash).toBe('#documents');
  });
});
