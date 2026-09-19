import 'server-only';

export type StaffTaskId =
  | 'browse_organizations'
  | 'view_cabinet'
  | 'investigate_deal'
  | 'assist_user'
  | 'review_money'
  | 'manage_staff'
  | 'diagnostics';

export type StaffTaskCatalogItem = {
  id: StaffTaskId;
  accessMode: 'CONTROL_PLANE' | 'VIEW_AS' | 'ASSISTED' | 'OPERATIONS' | 'JIT_PRIVILEGED';
  defaultDurationMinutes: 5 | 10 | 15 | 30 | 60;
  approvalLevel: 'automatic' | 'one_approver' | 'two_approvers';
  requiresOrganization: boolean;
  requiresCabinetRole: boolean;
  allowsDeal: boolean;
  permissionsByRole: Record<string, string[]>;
};

/**
 * Server-owned presentation catalogue. It maps a human task to the smallest
 * permission set that can satisfy it. The API remains the authority: it
 * revalidates assignment, role ceiling, mode, scope, MFA, TTL and approvals.
 */
const TASKS: readonly StaffTaskCatalogItem[] = [
  {
    id: 'browse_organizations',
    accessMode: 'CONTROL_PLANE',
    defaultDurationMinutes: 10,
    approvalLevel: 'automatic',
    requiresOrganization: false,
    requiresCabinetRole: false,
    allowsDeal: false,
    permissionsByRole: {
      PLATFORM_OWNER: ['organization:list', 'organization:read'],
      PLATFORM_ADMIN: ['organization:list', 'organization:read'],
      COMPLIANCE_STAFF: ['organization:list', 'organization:read'],
    },
  },
  {
    id: 'view_cabinet',
    accessMode: 'VIEW_AS',
    defaultDurationMinutes: 15,
    approvalLevel: 'automatic',
    requiresOrganization: true,
    requiresCabinetRole: true,
    allowsDeal: true,
    permissionsByRole: {
      PLATFORM_OWNER: ['cabinet:view-as', 'deal:read', 'document:metadata:read'],
      PLATFORM_ADMIN: ['cabinet:view-as', 'deal:read'],
      SUPPORT_L2: ['cabinet:view-as', 'deal:read', 'document:metadata:read'],
      OPERATIONS_AGENT: ['cabinet:view-as', 'deal:read', 'document:metadata:read'],
      OPERATIONS_SUPERVISOR: ['cabinet:view-as', 'deal:read', 'document:metadata:read'],
      COMPLIANCE_STAFF: ['cabinet:view-as', 'deal:read', 'document:metadata:read'],
    },
  },
  {
    id: 'investigate_deal',
    accessMode: 'OPERATIONS',
    defaultDurationMinutes: 30,
    approvalLevel: 'one_approver',
    requiresOrganization: true,
    requiresCabinetRole: false,
    allowsDeal: true,
    permissionsByRole: {
      PLATFORM_OWNER: ['deal:list', 'deal:read', 'deal:blocker:read', 'document:metadata:read'],
      OPERATIONS_AGENT: ['deal:list', 'deal:read', 'deal:blocker:read', 'document:metadata:read'],
      OPERATIONS_SUPERVISOR: ['deal:list', 'deal:read', 'deal:blocker:read', 'document:metadata:read'],
    },
  },
  {
    id: 'assist_user',
    accessMode: 'ASSISTED',
    defaultDurationMinutes: 15,
    approvalLevel: 'one_approver',
    requiresOrganization: true,
    requiresCabinetRole: false,
    allowsDeal: true,
    permissionsByRole: {
      PLATFORM_OWNER: ['cabinet:assisted-action', 'deal:read', 'critical-action:request'],
      SUPPORT_L2: ['cabinet:assisted-action', 'deal:read'],
    },
  },
  {
    id: 'review_money',
    accessMode: 'JIT_PRIVILEGED',
    defaultDurationMinutes: 15,
    approvalLevel: 'two_approvers',
    requiresOrganization: true,
    requiresCabinetRole: false,
    allowsDeal: true,
    permissionsByRole: {
      PLATFORM_OWNER: ['payment:metadata:read', 'payment:reconciliation:read', 'payment:manual-review', 'critical-action:request'],
      FINANCE_OPS: ['payment:metadata:read', 'payment:reconciliation:read', 'payment:manual-review', 'critical-action:request'],
      OPERATIONS_SUPERVISOR: ['payment:metadata:read', 'payment:reconciliation:read', 'payment:manual-review', 'critical-action:request'],
    },
  },
  {
    id: 'manage_staff',
    accessMode: 'CONTROL_PLANE',
    defaultDurationMinutes: 15,
    approvalLevel: 'automatic',
    requiresOrganization: false,
    requiresCabinetRole: false,
    allowsDeal: false,
    permissionsByRole: {
      PLATFORM_OWNER: ['staff-assignment:read', 'staff-assignment:write', 'staff-request:read', 'staff-request:approve', 'staff-session:read', 'staff-session:revoke', 'audit:read'],
      PLATFORM_ADMIN: ['staff-assignment:read', 'staff-assignment:write', 'staff-request:read', 'staff-request:approve', 'staff-session:read', 'staff-session:revoke', 'audit:read'],
      OPERATIONS_SUPERVISOR: ['staff-request:read', 'staff-request:approve'],
      COMPLIANCE_STAFF: ['staff-request:read', 'staff-request:approve', 'audit:read'],
      SECURITY_AUDITOR: ['staff-assignment:read', 'staff-request:read', 'staff-session:read', 'audit:read'],
    },
  },
  {
    id: 'diagnostics',
    accessMode: 'JIT_PRIVILEGED',
    defaultDurationMinutes: 15,
    approvalLevel: 'two_approvers',
    requiresOrganization: false,
    requiresCabinetRole: false,
    allowsDeal: false,
    permissionsByRole: {
      PLATFORM_OWNER: ['diagnostic:read', 'deployment:read', 'feature-flag:read', 'critical-action:request'],
      DEVELOPER: ['diagnostic:read', 'deployment:read', 'feature-flag:read'],
      SRE_ONCALL: ['diagnostic:read', 'deployment:read', 'feature-flag:read'],
      BREAK_GLASS_ADMIN: ['diagnostic:read', 'deployment:read', 'feature-flag:read'],
    },
  },
] as const;

export function staffAccessTaskCatalog(): StaffTaskCatalogItem[] {
  return TASKS.map((task) => ({
    ...task,
    permissionsByRole: Object.fromEntries(
      Object.entries(task.permissionsByRole).map(([role, permissions]) => [role, [...permissions]]),
    ),
  }));
}
