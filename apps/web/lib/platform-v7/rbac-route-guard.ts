import {
  PlatformRbacError,
  assertPermission,
  auditDeniedAccess,
  type PlatformV7AccessActor,
  type PlatformV7AccessRequest,
  type PlatformV7DeniedAccessAuditEvent,
} from './access-control';

export type PlatformV7GuardedSurface = 'driver_field' | 'bank_workspace' | 'executive_workspace';

export interface PlatformV7RouteGuardResult {
  readonly allowed: boolean;
  readonly request: PlatformV7AccessRequest;
  readonly deniedPayload: PlatformV7DeniedAccessAuditEvent | null;
  readonly reason: string;
}

const DEFAULT_ACTORS: Record<PlatformV7GuardedSurface, PlatformV7AccessActor> = {
  driver_field: {
    userId: 'driver-1',
    organizationId: 'carrier-1',
    roles: ['driver'],
    activeRole: 'driver',
  },
  bank_workspace: {
    userId: 'bank-1',
    organizationId: 'bank-1',
    roles: ['bankOfficer'],
    activeRole: 'bankOfficer',
  },
  executive_workspace: {
    userId: 'executive-1',
    organizationId: 'exec-1',
    roles: ['executiveViewer'],
    activeRole: 'executiveViewer',
  },
};

export function platformV7RouteGuardRequest(
  surface: PlatformV7GuardedSurface,
  actor: PlatformV7AccessActor = DEFAULT_ACTORS[surface],
): PlatformV7AccessRequest {
  if (surface === 'driver_field') {
    return {
      actor,
      action: 'read',
      resource: {
        resourceType: 'trip',
        resourceId: 'assigned-driver-trip',
        assignedDriverUserId: actor.userId,
      },
      correlationId: `route-${surface}`,
      auditId: `audit-${surface}`,
    };
  }

  if (surface === 'bank_workspace') {
    return {
      actor,
      action: 'read',
      resource: {
        resourceType: 'money',
        resourceId: 'bank-workspace-money',
        bankOrganizationId: actor.organizationId,
      },
      correlationId: `route-${surface}`,
      auditId: `audit-${surface}`,
    };
  }

  return {
    actor,
    action: 'read',
    resource: {
      resourceType: 'aggregateReport',
      resourceId: 'executive-workspace-aggregate',
    },
    correlationId: `route-${surface}`,
    auditId: `audit-${surface}`,
  };
}

export function evaluatePlatformV7RouteGuard(request: PlatformV7AccessRequest): PlatformV7RouteGuardResult {
  try {
    const decision = assertPermission(request);
    return {
      allowed: true,
      request,
      deniedPayload: null,
      reason: decision.reason,
    };
  } catch (error) {
    if (error instanceof PlatformRbacError) {
      return {
        allowed: false,
        request,
        deniedPayload: auditDeniedAccess(request, error.decision),
        reason: error.decision.reason,
      };
    }

    throw error;
  }
}
