import { toPlatformV7CanonicalRole, type PlatformV7CanonicalRole } from './role-canonical';

export type PlatformV7AccessRole =
  | 'platformAdmin'
  | 'platform_admin'
  | 'operator'
  | 'seller'
  | 'buyer'
  | 'logisticsManager'
  | 'logistics_manager'
  | 'carrier'
  | 'driver'
  | 'elevatorOperator'
  | 'elevator_operator'
  | 'labSpecialist'
  | 'lab_specialist'
  | 'surveyor'
  | 'bankOfficer'
  | 'bank_officer'
  | 'complianceOfficer'
  | 'compliance_officer'
  | 'arbitrator'
  | 'supportAgent'
  | 'support_agent'
  | 'executiveViewer'
  | 'executive_viewer'
  | 'investor';

export type PlatformV7ResourceType =
  | 'grainBatch'
  | 'lot'
  | 'rfq'
  | 'offer'
  | 'deal'
  | 'trip'
  | 'money'
  | 'document'
  | 'labProtocol'
  | 'dispute'
  | 'evidence'
  | 'auditLog'
  | 'auditEvent'
  | 'audit_event'
  | 'supportCase'
  | 'support_case'
  | 'roles'
  | 'analytics'
  | 'bank'
  | 'driverField'
  | 'driver_field'
  | 'other_deal'
  | 'aggregateReport';

export type PlatformV7Action =
  | 'create'
  | 'read'
  | 'update'
  | 'submit'
  | 'accept'
  | 'assign'
  | 'confirm'
  | 'request'
  | 'release'
  | 'hold'
  | 'decide'
  | 'export'
  | 'preview'
  | 'EXECUTE_RELEASE'
  | 'EXECUTE_REFUND'
  | 'CONFIRM_BANK_RELEASE'
  | 'CONFIRM_BANK_RESERVE'
  | 'CONFIRM_BANK_REFUND';

export interface PlatformV7AccessActor {
  readonly userId: string;
  readonly organizationId: string;
  readonly roles: readonly PlatformV7AccessRole[];
  readonly activeRole: PlatformV7AccessRole;
}

export interface PlatformV7ResourceScope {
  readonly resourceType: PlatformV7ResourceType;
  readonly resourceId: string;
  readonly ownerOrganizationId?: string;
  readonly buyerOrganizationId?: string;
  readonly sellerOrganizationId?: string;
  readonly carrierOrganizationId?: string;
  readonly linkedOrganizationIds?: readonly string[];
  readonly roleScopeOrganizationId?: string;
  readonly supportOrganizationId?: string;
  readonly assignedDriverUserId?: string;
  readonly assignedLabOrganizationId?: string;
  readonly assignedElevatorOrganizationId?: string;
  readonly assignedSurveyorOrganizationId?: string;
  readonly bankOrganizationId?: string;
  readonly disputeId?: string;
}

export interface PlatformV7AccessRequest {
  readonly actor: PlatformV7AccessActor;
  readonly action: PlatformV7Action;
  readonly resource: PlatformV7ResourceScope;
  readonly correlationId?: string;
  readonly auditId?: string;
}

export interface PlatformV7AccessDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly auditCode: string;
}

type PlatformV7AccessRule = {
  readonly role: PlatformV7CanonicalRole;
  readonly resources: readonly PlatformV7ResourceType[];
  readonly actions: readonly PlatformV7Action[];
  readonly scope: 'platform' | 'ownOrg' | 'buyerOrg' | 'sellerOrg' | 'carrierOrg' | 'assignedDriver' | 'assignedLab' | 'assignedElevator' | 'assignedSurveyor' | 'bankOrg' | 'roleScope' | 'readOnlyAggregate';
};

export type PlatformV7AccessPolicy = PlatformV7AccessRule;

export interface PlatformV7EffectivePermission {
  readonly role: PlatformV7CanonicalRole;
  readonly resourceType: PlatformV7ResourceType;
  readonly action: PlatformV7Action;
  readonly scope: PlatformV7AccessPolicy['scope'];
}

export interface PlatformV7DeniedAccessAuditEvent {
  readonly eventType: 'access.denied';
  readonly auditCode: string;
  readonly actorId: string;
  readonly organizationId: string;
  readonly role: PlatformV7AccessRole;
  readonly resource: PlatformV7ResourceScope;
  readonly action: PlatformV7Action;
  readonly resourceType: PlatformV7ResourceType;
  readonly resourceId: string;
  readonly reason: string;
  readonly correlationId?: string;
  readonly auditId?: string;
  readonly createdAt: string;
}

export class PlatformRbacError extends Error {
  readonly decision: PlatformV7AccessDecision;
  readonly request: PlatformV7AccessRequest;
  readonly deniedPayload: PlatformV7DeniedAccessAuditEvent;

  constructor(decision: PlatformV7AccessDecision, request: PlatformV7AccessRequest) {
    super(decision.reason);
    this.name = 'PlatformRbacError';
    this.decision = decision;
    this.request = request;
    this.deniedPayload = buildDeniedAccessPayload(request, decision);
  }
}

export { PlatformRbacError as PlatformV7PermissionError };

type PlatformV7ExplicitDenyRule = {
  readonly roles: readonly PlatformV7CanonicalRole[];
  readonly resources: readonly PlatformV7ResourceType[];
  readonly actions?: readonly PlatformV7Action[];
  readonly reason: string;
};

const BANK_CONFIRMATION_ACTIONS: readonly PlatformV7Action[] = [
  'confirm',
  'release',
  'EXECUTE_RELEASE',
  'EXECUTE_REFUND',
  'CONFIRM_BANK_RELEASE',
  'CONFIRM_BANK_RESERVE',
  'CONFIRM_BANK_REFUND',
];

const MONEY_WRITE_ACTIONS: readonly PlatformV7Action[] = [
  'create',
  'update',
  'submit',
  'accept',
  'assign',
  'confirm',
  'request',
  'release',
  'hold',
  'decide',
  'EXECUTE_RELEASE',
  'EXECUTE_REFUND',
  'CONFIRM_BANK_RELEASE',
  'CONFIRM_BANK_RESERVE',
  'CONFIRM_BANK_REFUND',
];

const EXPLICIT_DENY_RULES: readonly PlatformV7ExplicitDenyRule[] = [
  { roles: ['support_agent'], resources: ['money'], reason: 'SupportAgent cannot access or move money.' },
  { roles: ['arbitrator'], resources: ['money'], reason: 'Arbitrator decides disputes but cannot access or move money.' },
  { roles: ['arbitrator'], resources: ['bank'], actions: BANK_CONFIRMATION_ACTIONS, reason: 'Arbitrator cannot execute bank money actions.' },
  { roles: ['investor', 'executive_viewer'], resources: ['deal', 'money', 'document', 'trip', 'auditEvent', 'audit_event', 'supportCase', 'support_case'], reason: 'Read-only aggregate roles cannot access operational resources.' },
  { roles: ['bank_officer'], resources: ['trip', 'supportCase', 'support_case', 'driverField', 'driver_field'], reason: 'BankOfficer is isolated from field execution and support case work.' },
  { roles: ['driver'], resources: ['money', 'bank', 'auditEvent', 'audit_event', 'roles', 'analytics', 'deal', 'other_deal'], reason: 'Driver is limited to the assigned trip contour.' },
  { roles: ['seller', 'buyer'], resources: ['money', 'bank'], actions: BANK_CONFIRMATION_ACTIONS, reason: 'Seller and Buyer cannot perform bank confirmation actions.' },
  { roles: ['lab_specialist'], resources: ['money'], reason: 'LabSpecialist cannot access or change money.' },
  { roles: ['elevator_operator'], resources: ['labProtocol'], actions: MONEY_WRITE_ACTIONS, reason: 'ElevatorOperator cannot mutate lab protocols.' },
];

const ACCESS_RULES: readonly PlatformV7AccessRule[] = [
  { role: 'platform_admin', resources: ['auditLog', 'auditEvent'], actions: ['read', 'export'], scope: 'platform' },
  { role: 'operator', resources: ['grainBatch', 'lot', 'rfq', 'offer', 'deal', 'trip', 'money', 'document', 'labProtocol', 'dispute', 'evidence', 'auditLog', 'aggregateReport'], actions: ['create', 'read', 'update', 'submit', 'accept', 'assign', 'confirm', 'request', 'hold', 'export', 'preview'], scope: 'platform' },
  { role: 'support_agent', resources: ['deal'], actions: ['read', 'preview'], scope: 'roleScope' },
  { role: 'support_agent', resources: ['supportCase', 'support_case'], actions: ['create', 'read', 'update', 'request', 'preview'], scope: 'roleScope' },
  { role: 'seller', resources: ['grainBatch', 'lot'], actions: ['create', 'read', 'update', 'submit'], scope: 'ownOrg' },
  { role: 'seller', resources: ['offer', 'deal', 'document', 'dispute', 'evidence'], actions: ['create', 'read', 'update', 'submit', 'accept', 'request'], scope: 'sellerOrg' },
  { role: 'seller', resources: ['money'], actions: ['read', 'request'], scope: 'sellerOrg' },
  { role: 'buyer', resources: ['rfq', 'offer'], actions: ['create', 'read', 'update', 'submit', 'accept'], scope: 'ownOrg' },
  { role: 'buyer', resources: ['deal', 'money', 'document', 'dispute', 'evidence'], actions: ['create', 'read', 'update', 'request'], scope: 'buyerOrg' },
  { role: 'logistics_manager', resources: ['trip', 'evidence'], actions: ['create', 'read', 'update', 'assign', 'confirm', 'request'], scope: 'carrierOrg' },
  { role: 'carrier', resources: ['trip', 'evidence'], actions: ['read', 'update', 'assign', 'confirm'], scope: 'carrierOrg' },
  { role: 'driver', resources: ['trip', 'evidence'], actions: ['read', 'update', 'confirm'], scope: 'assignedDriver' },
  { role: 'elevator_operator', resources: ['trip', 'document', 'evidence'], actions: ['read', 'update', 'confirm', 'request'], scope: 'assignedElevator' },
  { role: 'lab_specialist', resources: ['labProtocol', 'document', 'evidence'], actions: ['create', 'read', 'update', 'confirm'], scope: 'assignedLab' },
  { role: 'surveyor', resources: ['trip', 'document', 'evidence', 'dispute'], actions: ['create', 'read', 'update', 'confirm'], scope: 'assignedSurveyor' },
  { role: 'bank_officer', resources: ['deal', 'money', 'document', 'dispute', 'auditLog', 'auditEvent'], actions: ['read', 'confirm', 'hold', 'release', 'export', 'CONFIRM_BANK_RELEASE', 'CONFIRM_BANK_RESERVE', 'CONFIRM_BANK_REFUND'], scope: 'bankOrg' },
  { role: 'compliance_officer', resources: ['deal', 'document', 'auditLog', 'auditEvent'], actions: ['read', 'update', 'confirm', 'hold'], scope: 'platform' },
  { role: 'arbitrator', resources: ['dispute', 'evidence', 'document'], actions: ['read', 'request', 'decide'], scope: 'platform' },
  { role: 'executive_viewer', resources: ['aggregateReport'], actions: ['read', 'export'], scope: 'readOnlyAggregate' },
  { role: 'investor', resources: ['aggregateReport'], actions: ['read', 'export'], scope: 'readOnlyAggregate' },
];

function matchesScope(rule: PlatformV7AccessRule, request: PlatformV7AccessRequest): boolean {
  const { actor, resource } = request;

  switch (rule.scope) {
    case 'platform':
      return true;
    case 'ownOrg':
      return resource.ownerOrganizationId === actor.organizationId;
    case 'buyerOrg':
      return resource.buyerOrganizationId === actor.organizationId;
    case 'sellerOrg':
      return resource.sellerOrganizationId === actor.organizationId;
    case 'carrierOrg':
      return resource.carrierOrganizationId === actor.organizationId;
    case 'assignedDriver':
      return resource.assignedDriverUserId === actor.userId;
    case 'assignedLab':
      return resource.assignedLabOrganizationId === actor.organizationId;
    case 'assignedElevator':
      return resource.assignedElevatorOrganizationId === actor.organizationId;
    case 'assignedSurveyor':
      return resource.assignedSurveyorOrganizationId === actor.organizationId;
    case 'bankOrg':
      return resource.bankOrganizationId === actor.organizationId;
    case 'roleScope':
      return Boolean(
        resource.roleScopeOrganizationId === actor.organizationId
        || resource.supportOrganizationId === actor.organizationId
        || resource.linkedOrganizationIds?.includes(actor.organizationId),
      );
    case 'readOnlyAggregate':
      return resource.resourceType === 'aggregateReport' && request.action === 'read';
    default:
      return false;
  }
}

function normalizeAccessRole(role: PlatformV7AccessRole): PlatformV7CanonicalRole | null {
  return toPlatformV7CanonicalRole(role);
}

function findExplicitDeny(request: PlatformV7AccessRequest, canonicalRole: PlatformV7CanonicalRole): PlatformV7ExplicitDenyRule | null {
  return EXPLICIT_DENY_RULES.find((rule) =>
    rule.roles.includes(canonicalRole)
    && rule.resources.includes(request.resource.resourceType)
    && (!rule.actions || rule.actions.includes(request.action))
  ) ?? null;
}

export function platformV7AccessDecision(request: PlatformV7AccessRequest): PlatformV7AccessDecision {
  const activeRole = request.actor.activeRole;
  const canonicalRole = normalizeAccessRole(activeRole);

  if (!request.actor.roles.includes(activeRole)) {
    return { allowed: false, reason: 'Active role is not granted to user membership.', auditCode: 'ROLE_NOT_GRANTED' };
  }

  if (!canonicalRole) {
    return { allowed: false, reason: 'Active role is not mapped to a canonical platform-v7 role.', auditCode: 'ROLE_NOT_CANONICAL' };
  }

  const explicitDeny = findExplicitDeny(request, canonicalRole);
  if (explicitDeny) {
    return { allowed: false, reason: explicitDeny.reason, auditCode: 'EXPLICIT_DENY' };
  }

  const matchingRule = ACCESS_RULES.find((rule) =>
    rule.role === canonicalRole
    && rule.resources.includes(request.resource.resourceType)
    && rule.actions.includes(request.action)
    && matchesScope(rule, request)
  );

  if (!matchingRule) {
    return { allowed: false, reason: 'No matching access policy for role, action and object scope.', auditCode: 'DENY_BY_DEFAULT' };
  }

  return { allowed: true, reason: 'Allowed by platform-v7 object-scope access policy.', auditCode: 'ALLOW_BY_POLICY' };
}

export function platformV7Can(request: PlatformV7AccessRequest): boolean {
  return platformV7AccessDecision(request).allowed;
}

export function canPerformAction(request: PlatformV7AccessRequest): PlatformV7AccessDecision {
  return platformV7AccessDecision(request);
}

export function canAccessResource(
  actor: PlatformV7AccessActor,
  resource: PlatformV7ResourceScope,
  action: PlatformV7Action = 'read',
): PlatformV7AccessDecision {
  return canPerformAction({ actor, resource, action });
}

export function getEffectivePermissions(
  actor: PlatformV7AccessActor,
  resource?: PlatformV7ResourceScope,
): PlatformV7EffectivePermission[] {
  if (!actor.roles.includes(actor.activeRole)) return [];
  const canonicalRole = normalizeAccessRole(actor.activeRole);
  if (!canonicalRole) return [];

  return ACCESS_RULES
    .filter((rule) => rule.role === canonicalRole)
    .flatMap((rule) =>
      rule.resources.flatMap((resourceType) =>
        rule.actions.flatMap((action) => {
          if (resource && resource.resourceType !== resourceType) return [];
          if (resource && !matchesScope(rule, { actor, resource, action })) return [];

          return [{
            role: rule.role,
            resourceType,
            action,
            scope: rule.scope,
          }];
        }),
      ),
    );
}

export function assertPermission(request: PlatformV7AccessRequest): PlatformV7AccessDecision {
  const decision = canPerformAction(request);
  if (!decision.allowed) throw new PlatformRbacError(decision, request);
  return decision;
}

function buildDeniedAccessPayload(
  request: PlatformV7AccessRequest,
  decision: PlatformV7AccessDecision,
): PlatformV7DeniedAccessAuditEvent {
  return {
    eventType: 'access.denied',
    auditCode: decision.auditCode,
    actorId: request.actor.userId,
    organizationId: request.actor.organizationId,
    role: request.actor.activeRole,
    resource: request.resource,
    action: request.action,
    resourceType: request.resource.resourceType,
    resourceId: request.resource.resourceId,
    reason: decision.reason,
    correlationId: request.correlationId,
    auditId: request.auditId,
    createdAt: new Date().toISOString(),
  };
}

export function auditDeniedAccess(
  request: PlatformV7AccessRequest,
  decision: PlatformV7AccessDecision = canPerformAction(request),
): PlatformV7DeniedAccessAuditEvent | null {
  if (decision.allowed) return null;
  return buildDeniedAccessPayload(request, decision);
}
