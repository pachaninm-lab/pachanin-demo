import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';
import {
  platformV7DealWorkspaceActionRuntimeServices,
  platformV7DealWorkspaceActions,
  type PlatformV7DealWorkspaceActionId,
} from '@/lib/platform-v7/deal-workspace-actions';
import type { PlatformV7ExecutionServiceName } from '@/lib/platform-v7/execution-service-registry-contract';

const WORKSPACE_ACTION_PERMISSION_IDS = {
  'request-release': ['money.request_reserve', 'bank.mark_money_ready_to_release'],
  'release-funds': ['bank.confirm_money_released'],
  'start-documents': ['document.attach'],
  'complete-documents': ['document.accept'],
  'open-dispute': ['dispute.open'],
  'resolve-dispute': ['arbitration.record_decision'],
  'open-bank': [],
  'open-disputes': [],
} as const satisfies Record<PlatformV7DealWorkspaceActionId, readonly PlatformV7ActionPermissionId[]>;

const policiesByActionId = new Map(
  PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((policy) => [policy.actionId, policy]),
);

describe('platform-v7 workspace permission invariant', () => {
  it('keeps every workspace action represented in the permission map', () => {
    expect(Object.keys(WORKSPACE_ACTION_PERMISSION_IDS)).toEqual(
      platformV7DealWorkspaceActions().map((action) => action.id),
    );
  });

  it('keeps mapped permission policies present and trace-gated', () => {
    for (const [workspaceActionId, permissionIds] of Object.entries(WORKSPACE_ACTION_PERMISSION_IDS)) {
      for (const permissionId of permissionIds) {
        const policy = policiesByActionId.get(permissionId);

        expect(policy, `${workspaceActionId}:${permissionId}`).toBeDefined();
        expect(policy?.needsDurableWrite, `${workspaceActionId}:${permissionId}`).toBe(true);
        expect(policy?.needsAuditEvent, `${workspaceActionId}:${permissionId}`).toBe(true);
        expect(policy?.needsIdempotencyKey, `${workspaceActionId}:${permissionId}`).toBe(true);
      }
    }
  });

  it('keeps workspace runtime services covered by mapped action policies', () => {
    for (const action of platformV7DealWorkspaceActions()) {
      const permissionIds = WORKSPACE_ACTION_PERMISSION_IDS[action.id];
      const policyServices = new Set<PlatformV7ExecutionServiceName>(
        permissionIds
          .map((permissionId) => policiesByActionId.get(permissionId)?.serviceName)
          .filter((serviceName): serviceName is PlatformV7ExecutionServiceName => Boolean(serviceName)),
      );

      const workspaceServices = platformV7DealWorkspaceActionRuntimeServices(action.id).filter(
        (serviceName) => serviceName !== 'audit' && serviceName !== 'notification' && serviceName !== 'integrations',
      );

      for (const serviceName of workspaceServices) {
        expect(policyServices.has(serviceName), `${action.id}:${serviceName}`).toBe(true);
      }
    }
  });

  it('keeps navigation-only workspace actions without mutating permission links', () => {
    const navigationActions = platformV7DealWorkspaceActions().filter((action) => action.href);

    expect(navigationActions.map((action) => action.id)).toEqual(['open-bank', 'open-disputes']);

    for (const action of navigationActions) {
      expect(WORKSPACE_ACTION_PERMISSION_IDS[action.id]).toHaveLength(0);
      expect(platformV7DealWorkspaceActionRuntimeServices(action.id)).toHaveLength(0);
    }
  });
});
