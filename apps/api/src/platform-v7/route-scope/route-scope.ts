import { platformV7ObjectScopeDecision, type PlatformV7ObjectScopedResource } from '../object-scope';
import {
  platformV7PermissionFor,
  type PlatformV7Action,
  type PlatformV7Role,
} from '../rbac';
import type { PlatformV7TenantScopedActor } from '../tenant-scope';

export type PlatformV7RouteId =
  | 'deal.detail'
  | 'deal.edit'
  | 'logistics.board'
  | 'logistics.dispatch'
  | 'quality.results'
  | 'quality.submit'
  | 'money.ledger'
  | 'money.basis'
  | 'money.release.request'
  | 'dispute.case'
  | 'dispute.update'
  | 'audit.trail'
  | 'support.case';

export type PlatformV7RouteScopedActor = PlatformV7TenantScopedActor &
  Readonly<{
    role: PlatformV7Role;
  }>;

export type PlatformV7RouteScopedResource = PlatformV7ObjectScopedResource &
  Readonly<{
    objectId: string;
  }>;

export type PlatformV7RouteDecisionReason =
  | 'route-allowed'
  | 'unknown-route'
  | 'permission-denied'
  | 'scope-rejected';

export type PlatformV7RouteDecision = Readonly<{
  allowed: boolean;
  reason: PlatformV7RouteDecisionReason;
  action: PlatformV7Action | null;
  scopeReason: string | null;
}>;

export const PLATFORM_V7_ROUTE_ACTIONS: Readonly<Record<PlatformV7RouteId, PlatformV7Action>> = {
  'deal.detail': 'deal.read',
  'deal.edit': 'deal.write',
  'logistics.board': 'logistics.read',
  'logistics.dispatch': 'logistics.write',
  'quality.results': 'quality.read',
  'quality.submit': 'quality.write',
  'money.ledger': 'money.read',
  'money.basis': 'money.basis.review',
  'money.release.request': 'money.release.request',
  'dispute.case': 'dispute.read',
  'dispute.update': 'dispute.write',
  'audit.trail': 'audit.read',
  'support.case': 'support.read',
} as const;

export function platformV7ActionForRoute(routeId: string): PlatformV7Action | null {
  return PLATFORM_V7_ROUTE_ACTIONS[routeId as PlatformV7RouteId] ?? null;
}

export function platformV7RouteScopeDecision(
  actor: PlatformV7RouteScopedActor,
  routeId: string,
  resource: PlatformV7RouteScopedResource,
): PlatformV7RouteDecision {
  const action = platformV7ActionForRoute(routeId);

  if (action === null) {
    return { allowed: false, reason: 'unknown-route', action: null, scopeReason: null };
  }

  const permission = platformV7PermissionFor(actor.role, action);

  if (permission === null) {
    return { allowed: false, reason: 'permission-denied', action, scopeReason: null };
  }

  const scopeDecision = platformV7ObjectScopeDecision(actor, resource, permission.scope);

  if (!scopeDecision.allowed) {
    return { allowed: false, reason: 'scope-rejected', action, scopeReason: scopeDecision.reason };
  }

  return { allowed: true, reason: 'route-allowed', action, scopeReason: scopeDecision.reason };
}

export function platformV7AssertRouteScope(
  actor: PlatformV7RouteScopedActor,
  routeId: string,
  resource: PlatformV7RouteScopedResource,
): void {
  const decision = platformV7RouteScopeDecision(actor, routeId, resource);

  if (!decision.allowed) {
    throw new Error(`platform-v7 route scope rejected: ${decision.reason}`);
  }
}
