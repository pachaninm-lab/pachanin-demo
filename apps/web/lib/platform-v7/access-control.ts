export type PlatformV7AccessRole =
  | 'platformAdmin'
  | 'operator'
  | 'seller'
  | 'buyer'
  | 'logisticsManager'
  | 'carrier'
  | 'driver'
  | 'elevatorOperator'
  | 'labSpecialist'
  | 'surveyor'
  | 'bankOfficer'
  | 'complianceOfficer'
  | 'arbitrator'
  | 'supportAgent'
  | 'executiveViewer';

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
  | 'preview';

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
  readonly role: PlatformV7AccessRole;
  readonly resources: readonly PlatformV7ResourceType[];
  readonly actions: readonly PlatformV7Action[];
  readonly scope: 'platform' | 'ownOrg' | 'buyerOrg' | 'sellerOrg' | 'carrierOrg' | 'assignedDriver' | 'assignedLab' | 'assignedElevator' | 'assignedSurveyor' | 'bankOrg' | 'readOnlyAggregate';
};

export type PlatformV7AccessPolicy = PlatformV7AccessRule;

export interface PlatformV7EffectivePermission {
  readonly role: PlatformV7AccessRole;
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
  readonly action: PlatformV7Action;
  readonly resourceType: PlatformV7ResourceType;
  readonly resourceId: string;
  readonly reason: string;
  readonly correlationId?: string;
  readonly auditId?: string;
  readonly createdAt: string;
}

export class PlatformV7PermissionError extends Error {
  readonly decision: PlatformV7AccessDecision;
  readonly request: PlatformV7AccessRequest;

  constructor(decision: PlatformV7AccessDecision, request: PlatformV7AccessRequest) {
    super(decision.reason);
    this.name = 'PlatformV7PermissionError';
    this.decision = decision;
    this.request = request;
  }
}

const ACCESS_RULES: readonly PlatformV7AccessRule[] = [
  { role: 'platformAdmin', resources: ['auditLog'], actions: ['read', 'export'], scope: 'platform' },
  { role: 'operator', resources: ['grainBatch', 'lot', 'rfq', 'offer', 'deal', 'trip', 'money', 'document', 'labProtocol', 'dispute', 'evidence', 'auditLog', 'aggregateReport'], actions: ['create', 'read', 'update', 'submit', 'accept', 'assign', 'confirm', 'request', 'hold', 'export', 'preview'], scope: 'platform' },
  { role: 'supportAgent', resources: ['deal', 'trip', 'document', 'dispute', 'evidence', 'auditLog'], actions: ['read', 'update', 'request', 'preview'], scope: 'platform' },
  { role: 'seller', resources: ['grainBatch', 'lot'], actions: ['create', 'read', 'update', 'submit'], scope: 'ownOrg' },
  { role: 'seller', resources: ['offer', 'deal', 'document', 'dispute', 'evidence'], actions: ['create', 'read', 'update', 'submit', 'accept', 'request'], scope: 'sellerOrg' },
  { role: 'seller', resources: ['money'], actions: ['read', 'request'], scope: 'sellerOrg' },
  { role: 'buyer', resources: ['rfq', 'offer'], actions: ['create', 'read', 'update', 'submit', 'accept'], scope: 'ownOrg' },
  { role: 'buyer', resources: ['deal', 'money', 'document', 'dispute', 'evidence'], actions: ['create', 'read', 'update', 'request'], scope: 'buyerOrg' },
  { role: 'logisticsManager', resources: ['trip', 'evidence'], actions: ['create', 'read', 'update', 'assign', 'confirm', 'request'], scope: 'carrierOrg' },
  { role: 'carrier', resources: ['trip', 'evidence'], actions: ['read', 'update', 'assign', 'confirm'], scope: 'carrierOrg' },
  { role: 'driver', resources: ['trip', 'evidence'], actions: ['read', 'update', 'confirm'], scope: 'assignedDriver' },
  { role: 'elevatorOperator', resources: ['trip', 'document', 'evidence'], actions: ['read', 'update', 'confirm', 'request'], scope: 'assignedElevator' },
  { role: 'labSpecialist', resources: ['labProtocol', 'document', 'evidence'], actions: ['create', 'read', 'update', 'confirm'], scope: 'assignedLab' },
  { role: 'surveyor', resources: ['trip', 'document', 'evidence', 'dispute'], actions: ['create', 'read', 'update', 'confirm'], scope: 'assignedSurveyor' },
  { role: 'bankOfficer', resources: ['deal', 'money', 'document', 'dispute', 'auditLog'], actions: ['read', 'confirm', 'hold', 'release', 'export'], scope: 'bankOrg' },
  { role: 'complianceOfficer', resources: ['deal', 'document', 'auditLog'], actions: ['read', 'update', 'confirm', 'hold'], scope: 'platform' },
  { role: 'arbitrator', resources: ['dispute', 'evidence', 'document', 'money'], actions: ['read', 'request', 'decide'], scope: 'platform' },
  { role: 'executiveViewer', resources: ['aggregateReport'], actions: ['read', 'export'], scope: 'readOnlyAggregate' },
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
    case 'readOnlyAggregate':
      return resource.resourceType === 'aggregateReport' && request.action === 'read';
    default:
      return false;
  }
}

export function platformV7AccessDecision(request: PlatformV7AccessRequest): PlatformV7AccessDecision {
  const activeRole = request.actor.activeRole;

  if (!request.actor.roles.includes(activeRole)) {
    return { allowed: false, reason: 'Active role is not granted to user membership.', auditCode: 'ROLE_NOT_GRANTED' };
  }

  const matchingRule = ACCESS_RULES.find((rule) =>
    rule.role === activeRole
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

  return ACCESS_RULES
    .filter((rule) => rule.role === actor.activeRole)
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
  if (!decision.allowed) throw new PlatformV7PermissionError(decision, request);
  return decision;
}

export function auditDeniedAccess(
  request: PlatformV7AccessRequest,
  decision: PlatformV7AccessDecision = canPerformAction(request),
): PlatformV7DeniedAccessAuditEvent | null {
  if (decision.allowed) return null;

  return {
    eventType: 'access.denied',
    auditCode: decision.auditCode,
    actorId: request.actor.userId,
    organizationId: request.actor.organizationId,
    role: request.actor.activeRole,
    action: request.action,
    resourceType: request.resource.resourceType,
    resourceId: request.resource.resourceId,
    reason: decision.reason,
    correlationId: request.correlationId,
    auditId: request.auditId,
    createdAt: new Date().toISOString(),
  };
}
