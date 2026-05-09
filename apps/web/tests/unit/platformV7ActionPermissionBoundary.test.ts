import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionBoundarySummary,
  getPlatformV7ActionPermissionPoliciesForRole,
  getPlatformV7ActionPermissionPoliciesForService,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
} from '@/lib/platform-v7/action-permission-boundary';
import { getPlatformV7ActionServiceName } from '@/lib/platform-v7/action-service-map';
import { PLATFORM_V7_EXECUTION_SERVICE_NAMES } from '@/lib/platform-v7/execution-service-registry-contract';
import { canPlatformV7RoleOpenRoute, type PlatformV7Role } from '@/lib/platform-v7/role-access';

const PLATFORM_V7_TEST_ROLES = [
  'seller',
  'buyer',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'operator',
  'arbitrator',
  'compliance',
  'investor',
  'executive',
] as const satisfies readonly PlatformV7Role[];

describe('platform-v7 action permission boundary', () => {
  it('keeps every action behind durable write, audit and idempotency requirements', () => {
    expect(getPlatformV7ActionPermissionBoundarySummary()).toEqual({
      mode: 'contract_only_requires_runtime',
      actionCount: PLATFORM_V7_ACTION_PERMISSION_POLICIES.length,
      serviceCount: 9,
      needsDurableWrite: true,
      needsAuditEvent: true,
      needsIdempotencyKey: true,
    });
  });

  it('keeps action ids unique, role-scoped and inside the platform-v7 route boundary', () => {
    const actionIds = PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((policy) => policy.actionId);

    expect(new Set(actionIds).size).toBe(actionIds.length);

    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.route.startsWith('/platform-v7/')).toBe(true);
      expect(policy.allowedRoles.length).toBeGreaterThan(0);

      for (const role of policy.allowedRoles) {
        expect(canPlatformV7RoleOpenRoute(role, policy.route).allowed).toBe(true);
      }
    }
  });

  it('keeps role action decisions aligned with route access decisions', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      for (const role of PLATFORM_V7_TEST_ROLES) {
        const decision = canPlatformV7RoleInvokeAction(role, policy.actionId);

        if (!policy.allowedRoles.includes(role)) {
          expect(decision.allowed).toBe(false);
          continue;
        }

        expect(decision).toEqual(canPlatformV7RoleOpenRoute(role, policy.route));
      }
    }
  });

  it('keeps every action mapped to an execution registry service', () => {
    const serviceNames = new Set<string>(PLATFORM_V7_EXECUTION_SERVICE_NAMES);

    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(serviceNames.has(policy.serviceName)).toBe(true);
    }
  });

  it('keeps every action mapped to its execution service boundary', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(getPlatformV7ActionServiceName(policy.actionId)).toBe(policy.serviceName);
    }
    expect(getPlatformV7ActionServiceName('driver.confirm_checkpoint')).toBe('trip');
    expect(getPlatformV7ActionServiceName('money.request_reserve')).toBe('money');
    expect(getPlatformV7ActionServiceName('bank.confirm_money_released')).toBe('money');
    expect(getPlatformV7ActionServiceName('document.accept')).toBe('document');
    expect(getPlatformV7ActionServiceName('arbitration.record_decision')).toBe('dispute');
    expect(getPlatformV7ActionServiceName('proposal.submit')).toBe('proposal');
    expect(getPlatformV7ActionServiceName('proposal.accept')).toBe('proposal');
  });

  it('returns stable action groups by service and role', () => {
    expect(getPlatformV7ActionPermissionPoliciesForService('money').map((policy) => policy.actionId)).toEqual([
      'money.request_reserve',
      'bank.confirm_money_reserved',
      'bank.mark_money_ready_to_release',
      'bank.confirm_money_released',
    ]);
    expect(getPlatformV7ActionPermissionPoliciesForService('proposal').map((policy) => policy.actionId)).toEqual([
      'buyer.submit_offer',
      'seller.accept_offer',
      'proposal.submit',
      'proposal.accept',
    ]);
    expect(getPlatformV7ActionPermissionPoliciesForService('support').map((policy) => policy.actionId)).toEqual([
      'support.create_case',
      'support.append_message',
    ]);
    expect(getPlatformV7ActionPermissionPoliciesForRole('driver').map((policy) => policy.actionId)).toEqual([
      'driver.confirm_checkpoint',
      'trip.open_incident',
      'support.create_case',
      'support.append_message',
    ]);
  });

  it('keeps driver limited to driver checkpoint and support actions', () => {
    expect(canPlatformV7RoleInvokeAction('driver', 'driver.confirm_checkpoint').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('driver', 'support.create_case').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('driver', 'seller.publish_lot').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'buyer.submit_offer').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'logistics.assign_driver').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'bank.confirm_money_released').allowed).toBe(false);
  });

  it('keeps bank money confirmations separate from buyer reserve request', () => {
    expect(canPlatformV7RoleInvokeAction('buyer', 'money.request_reserve').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('buyer', 'bank.confirm_money_reserved').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('buyer', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'bank.confirm_money_reserved').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('bank', 'bank.confirm_money_released').allowed).toBe(true);
  });

  it('keeps decision recording limited to arbitration, bank and operator roles', () => {
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'arbitration.record_decision').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('bank', 'arbitration.record_decision').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('operator', 'arbitration.record_decision').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('seller', 'arbitration.record_decision').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('buyer', 'arbitration.record_decision').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'arbitration.record_decision').allowed).toBe(false);
  });

  it('keeps neutral proposal API actions limited to seller and buyer roles', () => {
    expect(canPlatformV7RoleInvokeAction('seller', 'proposal.submit').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('buyer', 'proposal.submit').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('seller', 'proposal.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('buyer', 'proposal.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('operator', 'proposal.submit').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'proposal.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'proposal.submit').allowed).toBe(false);
  });

  it('keeps seller and buyer symmetric but separate', () => {
    expect(canPlatformV7RoleInvokeAction('seller', 'seller.create_batch').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('seller', 'seller.publish_lot').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('seller', 'buyer.create_rfq').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('buyer', 'buyer.create_rfq').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('buyer', 'buyer.submit_offer').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('buyer', 'seller.publish_lot').allowed).toBe(false);
  });

  it('does not claim runtime execution from the permission contract', () => {
    expect(getPlatformV7ActionPermissionBoundarySummary().mode).toBe('contract_only_requires_runtime');
  });
});
