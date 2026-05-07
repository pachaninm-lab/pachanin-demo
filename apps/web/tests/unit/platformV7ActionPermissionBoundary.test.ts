import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionBoundarySummary,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 action permission boundary', () => {
  it('keeps every action behind durable write, audit and idempotency requirements', () => {
    expect(getPlatformV7ActionPermissionBoundarySummary()).toEqual({
      mode: 'contract_only_requires_runtime',
      actionCount: PLATFORM_V7_ACTION_PERMISSION_POLICIES.length,
      needsDurableWrite: true,
      needsAuditEvent: true,
      needsIdempotencyKey: true,
    });
  });

  it('keeps driver limited to driver checkpoint and support actions', () => {
    expect(canPlatformV7RoleInvokeAction('driver', 'driver.confirm_checkpoint').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('driver', 'support.create_case').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('driver', 'seller.publish_lot').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'buyer.submit_offer').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'logistics.assign_driver').allowed).toBe(false);
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
