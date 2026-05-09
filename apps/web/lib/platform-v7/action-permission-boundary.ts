import type { PlatformV7ExecutionServiceName } from './execution-service-registry-contract';
import { canPlatformV7RoleOpenRoute, type PlatformV7AccessDecision, type PlatformV7Role } from './role-access';

export type PlatformV7ActionPermissionId =
  | 'seller.create_batch'
  | 'seller.publish_lot'
  | 'buyer.create_rfq'
  | 'buyer.submit_offer'
  | 'seller.accept_offer'
  | 'proposal.submit'
  | 'proposal.accept'
  | 'deal.confirm_terms'
  | 'money.request_reserve'
  | 'bank.confirm_money_reserved'
  | 'bank.mark_money_ready_to_release'
  | 'bank.confirm_money_released'
  | 'logistics.assign_driver'
  | 'driver.confirm_checkpoint'
  | 'trip.accept'
  | 'trip.open_incident'
  | 'document.attach'
  | 'document.accept'
  | 'dispute.open'
  | 'arbitration.record_decision'
  | 'support.create_case'
  | 'support.append_message';

export type PlatformV7ActionPermissionPolicy = {
  readonly actionId: PlatformV7ActionPermissionId;
  readonly route: string;
  readonly allowedRoles: readonly PlatformV7Role[];
  readonly serviceName: PlatformV7ExecutionServiceName;
  readonly needsDurableWrite: true;
  readonly needsAuditEvent: true;
  readonly needsIdempotencyKey: true;
};

type PlatformV7ActionPermissionDefinition = Omit<
  PlatformV7ActionPermissionPolicy,
  'needsDurableWrite' | 'needsAuditEvent' | 'needsIdempotencyKey'
>;

export const PLATFORM_V7_ACTION_RUNTIME_REQUIREMENTS = {
  needsDurableWrite: true,
  needsAuditEvent: true,
  needsIdempotencyKey: true,
} as const;

const SELLER_OPERATOR_ROLES = ['seller', 'operator'] as const satisfies readonly PlatformV7Role[];
const BUYER_OPERATOR_ROLES = ['buyer', 'operator'] as const satisfies readonly PlatformV7Role[];
const PROPOSAL_COUNTERPARTY_ROLES = ['seller', 'buyer'] as const satisfies readonly PlatformV7Role[];
const DEAL_COUNTERPARTY_ROLES = ['seller', 'buyer', 'operator'] as const satisfies readonly PlatformV7Role[];
const MONEY_BANK_ROLES = ['bank'] as const satisfies readonly PlatformV7Role[];
const MONEY_RELEASE_REVIEW_ROLES = ['bank', 'operator'] as const satisfies readonly PlatformV7Role[];
const LOGISTICS_OPERATOR_ROLES = ['logistics', 'operator'] as const satisfies readonly PlatformV7Role[];
const DRIVER_CHECKPOINT_ROLES = ['driver', 'operator'] as const satisfies readonly PlatformV7Role[];
const TRIP_ACCEPTANCE_ROLES = ['elevator', 'surveyor', 'operator'] as const satisfies readonly PlatformV7Role[];
const TRIP_INCIDENT_ROLES = ['logistics', 'driver', 'elevator', 'surveyor', 'operator'] as const satisfies readonly PlatformV7Role[];
const DOCUMENT_ATTACHMENT_ROLES = [
  'seller',
  'buyer',
  'logistics',
  'elevator',
  'lab',
  'surveyor',
  'operator',
] as const satisfies readonly PlatformV7Role[];
const DOCUMENT_ACCEPTANCE_ROLES = ['operator', 'compliance'] as const satisfies readonly PlatformV7Role[];
const DISPUTE_OPEN_ROLES = ['seller', 'buyer', 'operator', 'arbitrator', 'compliance'] as const satisfies readonly PlatformV7Role[];
const ARBITRATION_DECISION_ROLES = ['arbitrator', 'bank', 'operator'] as const satisfies readonly PlatformV7Role[];
const SUPPORT_PARTICIPANT_ROLES = [
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
] as const satisfies readonly PlatformV7Role[];

function definePlatformV7ActionPermissionPolicy(
  definition: PlatformV7ActionPermissionDefinition,
): PlatformV7ActionPermissionPolicy {
  return {
    ...definition,
    ...PLATFORM_V7_ACTION_RUNTIME_REQUIREMENTS,
  };
}

export const PLATFORM_V7_ACTION_PERMISSION_POLICIES: readonly PlatformV7ActionPermissionPolicy[] = [
  definePlatformV7ActionPermissionPolicy({
    actionId: 'seller.create_batch',
    route: '/platform-v7/batches/new',
    allowedRoles: SELLER_OPERATOR_ROLES,
    serviceName: 'batch',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'seller.publish_lot',
    route: '/platform-v7/lots/create',
    allowedRoles: SELLER_OPERATOR_ROLES,
    serviceName: 'lot',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'buyer.create_rfq',
    route: '/platform-v7/buyer/rfq/new',
    allowedRoles: BUYER_OPERATOR_ROLES,
    serviceName: 'rfq',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'buyer.submit_offer',
    route: '/platform-v7/buyer',
    allowedRoles: BUYER_OPERATOR_ROLES,
    serviceName: 'proposal',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'seller.accept_offer',
    route: '/platform-v7/seller',
    allowedRoles: SELLER_OPERATOR_ROLES,
    serviceName: 'proposal',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'proposal.submit',
    route: '/platform-v7/deals',
    allowedRoles: PROPOSAL_COUNTERPARTY_ROLES,
    serviceName: 'proposal',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'proposal.accept',
    route: '/platform-v7/deals',
    allowedRoles: PROPOSAL_COUNTERPARTY_ROLES,
    serviceName: 'proposal',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'deal.confirm_terms',
    route: '/platform-v7/deals',
    allowedRoles: DEAL_COUNTERPARTY_ROLES,
    serviceName: 'deal',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'money.request_reserve',
    route: '/platform-v7/buyer',
    allowedRoles: BUYER_OPERATOR_ROLES,
    serviceName: 'money',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'bank.confirm_money_reserved',
    route: '/platform-v7/bank',
    allowedRoles: MONEY_BANK_ROLES,
    serviceName: 'money',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'bank.mark_money_ready_to_release',
    route: '/platform-v7/bank',
    allowedRoles: MONEY_RELEASE_REVIEW_ROLES,
    serviceName: 'money',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'bank.confirm_money_released',
    route: '/platform-v7/bank',
    allowedRoles: MONEY_BANK_ROLES,
    serviceName: 'money',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'logistics.assign_driver',
    route: '/platform-v7/logistics',
    allowedRoles: LOGISTICS_OPERATOR_ROLES,
    serviceName: 'logistics',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'driver.confirm_checkpoint',
    route: '/platform-v7/driver/field',
    allowedRoles: DRIVER_CHECKPOINT_ROLES,
    serviceName: 'trip',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'trip.accept',
    route: '/platform-v7/deals',
    allowedRoles: TRIP_ACCEPTANCE_ROLES,
    serviceName: 'trip',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'trip.open_incident',
    route: '/platform-v7/logistics',
    allowedRoles: TRIP_INCIDENT_ROLES,
    serviceName: 'trip',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'document.attach',
    route: '/platform-v7/documents',
    allowedRoles: DOCUMENT_ATTACHMENT_ROLES,
    serviceName: 'document',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'document.accept',
    route: '/platform-v7/compliance',
    allowedRoles: DOCUMENT_ACCEPTANCE_ROLES,
    serviceName: 'document',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'dispute.open',
    route: '/platform-v7/disputes',
    allowedRoles: DISPUTE_OPEN_ROLES,
    serviceName: 'dispute',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'arbitration.record_decision',
    route: '/platform-v7/disputes',
    allowedRoles: ARBITRATION_DECISION_ROLES,
    serviceName: 'dispute',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'support.create_case',
    route: '/platform-v7/support/new',
    allowedRoles: SUPPORT_PARTICIPANT_ROLES,
    serviceName: 'support',
  }),
  definePlatformV7ActionPermissionPolicy({
    actionId: 'support.append_message',
    route: '/platform-v7/support',
    allowedRoles: SUPPORT_PARTICIPANT_ROLES,
    serviceName: 'support',
  }),
];

export function getPlatformV7ActionPermissionPolicy(actionId: PlatformV7ActionPermissionId): PlatformV7ActionPermissionPolicy {
  const policy = PLATFORM_V7_ACTION_PERMISSION_POLICIES.find((item) => item.actionId === actionId);
  if (!policy) throw new Error(`Missing platform-v7 action permission policy: ${actionId}`);
  return policy;
}

export function getPlatformV7ActionPermissionPoliciesForService(
  serviceName: PlatformV7ExecutionServiceName,
): PlatformV7ActionPermissionPolicy[] {
  return PLATFORM_V7_ACTION_PERMISSION_POLICIES.filter((policy) => policy.serviceName === serviceName);
}

export function getPlatformV7ActionPermissionPoliciesForRole(
  role: PlatformV7Role,
): PlatformV7ActionPermissionPolicy[] {
  return PLATFORM_V7_ACTION_PERMISSION_POLICIES.filter((policy) => policy.allowedRoles.includes(role));
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
