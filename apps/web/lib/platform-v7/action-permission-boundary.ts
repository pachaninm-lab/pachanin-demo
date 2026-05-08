import type { PlatformV7ExecutionServiceName } from './execution-service-registry-contract';
import { canPlatformV7RoleOpenRoute, type PlatformV7AccessDecision, type PlatformV7Role } from './role-access';

export type PlatformV7ActionPermissionId =
  | 'seller.create_batch'
  | 'seller.publish_lot'
  | 'buyer.create_rfq'
  | 'buyer.submit_offer'
  | 'seller.accept_offer'
  | 'deal.confirm_terms'
  | 'money.request_reserve'
  | 'bank.confirm_money_reserved'
  | 'bank.mark_money_ready_to_release'
  | 'bank.confirm_money_released'
  | 'logistics.assign_driver'
  | 'driver.confirm_checkpoint'
  | 'document.attach'
  | 'document.accept'
  | 'dispute.open'
  | 'support.create_case';

export type PlatformV7ActionPermissionPolicy = {
  readonly actionId: PlatformV7ActionPermissionId;
  readonly route: string;
  readonly allowedRoles: readonly PlatformV7Role[];
  readonly serviceName: PlatformV7ExecutionServiceName;
  readonly needsDurableWrite: true;
  readonly needsAuditEvent: true;
  readonly needsIdempotencyKey: true;
};

export const PLATFORM_V7_ACTION_PERMISSION_POLICIES: readonly PlatformV7ActionPermissionPolicy[] = [
  { actionId: 'seller.create_batch', route: '/platform-v7/batches/new', allowedRoles: ['seller', 'operator'], serviceName: 'batch', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'seller.publish_lot', route: '/platform-v7/lots/create', allowedRoles: ['seller', 'operator'], serviceName: 'lot', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'buyer.create_rfq', route: '/platform-v7/buyer/rfq/new', allowedRoles: ['buyer', 'operator'], serviceName: 'rfq', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'buyer.submit_offer', route: '/platform-v7/buyer', allowedRoles: ['buyer', 'operator'], serviceName: 'proposal', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'seller.accept_offer', route: '/platform-v7/seller', allowedRoles: ['seller', 'operator'], serviceName: 'proposal', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'deal.confirm_terms', route: '/platform-v7/deals', allowedRoles: ['seller', 'buyer', 'operator'], serviceName: 'deal', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'money.request_reserve', route: '/platform-v7/buyer', allowedRoles: ['buyer', 'operator'], serviceName: 'money', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'bank.confirm_money_reserved', route: '/platform-v7/bank', allowedRoles: ['bank'], serviceName: 'money', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'bank.mark_money_ready_to_release', route: '/platform-v7/bank', allowedRoles: ['bank', 'operator'], serviceName: 'money', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'bank.confirm_money_released', route: '/platform-v7/bank', allowedRoles: ['bank'], serviceName: 'money', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'logistics.assign_driver', route: '/platform-v7/logistics', allowedRoles: ['logistics', 'operator'], serviceName: 'logistics', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'driver.confirm_checkpoint', route: '/platform-v7/driver/field', allowedRoles: ['driver', 'operator'], serviceName: 'trip', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'document.attach', route: '/platform-v7/documents', allowedRoles: ['seller', 'buyer', 'logistics', 'elevator', 'lab', 'surveyor', 'operator'], serviceName: 'document', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'document.accept', route: '/platform-v7/compliance', allowedRoles: ['operator', 'compliance'], serviceName: 'document', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'dispute.open', route: '/platform-v7/disputes', allowedRoles: ['seller', 'buyer', 'operator', 'arbitrator', 'compliance'], serviceName: 'dispute', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
  { actionId: 'support.create_case', route: '/platform-v7/support/new', allowedRoles: ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator', 'arbitrator', 'compliance'], serviceName: 'support', needsDurableWrite: true, needsAuditEvent: true, needsIdempotencyKey: true },
];

export function getPlatformV7ActionPermissionPolicy(actionId: PlatformV7ActionPermissionId): PlatformV7ActionPermissionPolicy {
  const policy = PLATFORM_V7_ACTION_PERMISSION_POLICIES.find((item) => item.actionId === actionId);
  if (!policy) throw new Error(`Missing platform-v7 action permission policy: ${actionId}`);
  return policy;
}

export function canPlatformV7RoleInvokeAction(
  role: PlatformV7Role,
  actionId: PlatformV7ActionPermissionId,
): PlatformV7AccessDecision {
  const policy = getPlatformV7ActionPermissionPolicy(actionId);

  if (!policy.allowedRoles.includes(role)) {
    return { allowed: false, reason: 'Действие закрыто для роли.' };
  }

  return canPlatformV7RoleOpenRoute(role, policy.route);
}

export function getPlatformV7ActionPermissionBoundarySummary() {
  return {
    mode: 'contract_only_requires_runtime',
    actionCount: PLATFORM_V7_ACTION_PERMISSION_POLICIES.length,
    serviceCount: new Set(PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((policy) => policy.serviceName)).size,
    needsDurableWrite: PLATFORM_V7_ACTION_PERMISSION_POLICIES.every((policy) => policy.needsDurableWrite),
    needsAuditEvent: PLATFORM_V7_ACTION_PERMISSION_POLICIES.every((policy) => policy.needsAuditEvent),
    needsIdempotencyKey: PLATFORM_V7_ACTION_PERMISSION_POLICIES.every((policy) => policy.needsIdempotencyKey),
  };
}
