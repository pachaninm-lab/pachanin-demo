import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_REQUIRED_SERVICE_NAMES, type PlatformV7RequiredServiceName } from '@/lib/platform-v7/service-contracts';
import {
  platformV7DealWorkspaceActionHasRuntimeRequirements,
  platformV7DealWorkspaceActionRequiresTraceableWrite,
  platformV7DealWorkspaceActionRuntimeServices,
  platformV7DealWorkspaceActions,
} from '@/lib/platform-v7/deal-workspace-actions';

const serviceNames = new Set<PlatformV7RequiredServiceName>(PLATFORM_V7_REQUIRED_SERVICE_NAMES);

describe('platform-v7 deal workspace action service contracts', () => {
  it('keeps non-navigation actions backed by runtime requirements', () => {
    for (const action of platformV7DealWorkspaceActions()) {
      if (action.href) {
        expect(platformV7DealWorkspaceActionHasRuntimeRequirements(action.id), action.id).toBe(false);
        continue;
      }

      expect(platformV7DealWorkspaceActionHasRuntimeRequirements(action.id), action.id).toBe(true);
      expect(platformV7DealWorkspaceActionRequiresTraceableWrite(action.id), action.id).toBe(true);
    }
  });

  it('keeps runtime service names aligned with the service registry', () => {
    for (const action of platformV7DealWorkspaceActions()) {
      for (const requirement of action.runtimeRequirements) {
        expect(serviceNames.has(requirement.service), `${action.id}:${requirement.service}`).toBe(true);
        expect(requirement.operation.trim(), action.id).toBe(requirement.operation);
        expect(requirement.operation.length, action.id).toBeGreaterThan(0);
      }
    }
  });

  it('keeps payment-facing actions tied to traceable services', () => {
    expect(platformV7DealWorkspaceActionRuntimeServices('request-release')).toEqual([
      'money',
      'audit',
      'notification',
    ]);
    expect(platformV7DealWorkspaceActionRuntimeServices('release-funds')).toEqual([
      'money',
      'integrations',
      'audit',
    ]);
    expect(platformV7DealWorkspaceActionRequiresTraceableWrite('request-release')).toBe(true);
    expect(platformV7DealWorkspaceActionRequiresTraceableWrite('release-funds')).toBe(true);
  });

  it('keeps irreversible actions below live maturity until external runtime is proven', () => {
    const irreversibleActions = platformV7DealWorkspaceActions().filter((action) => action.irreversible);

    expect(irreversibleActions.map((action) => action.id)).toEqual(['release-funds']);

    for (const action of irreversibleActions) {
      expect(action.maturityMode, action.id).not.toBe('live');
      expect(action.runtimeRequirements.every((requirement) => requirement.requiresTraceableWrite), action.id).toBe(true);
    }
  });
});
