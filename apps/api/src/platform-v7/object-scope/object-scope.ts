import type { PlatformV7PermissionScope } from '../rbac/permissions';
import { platformV7TenantScopeDecision, type PlatformV7TenantScopedActor } from '../tenant-scope/tenant-scope';

export type PlatformV7ObjectScopedResource = Readonly<{
  tenantId: string;
  ownerActorIds: readonly string[];
}>;

export type PlatformV7ObjectDecision = Readonly<{
  allowed: boolean;
  reason: 'owner-match' | 'tenant-scope' | 'platform-readonly' | 'tenant-rejected' | 'missing-owner';
}>;

export function platformV7ObjectScopeDecision(
  actor: PlatformV7TenantScopedActor,
  resource: PlatformV7ObjectScopedResource,
  scope: PlatformV7PermissionScope,
): PlatformV7ObjectDecision {
  const tenantDecision = platformV7TenantScopeDecision(actor, resource, scope);

  if (!tenantDecision.allowed) {
    return { allowed: false, reason: 'tenant-rejected' };
  }

  if (scope === 'platform-readonly') {
    return { allowed: true, reason: 'platform-readonly' };
  }

  if (scope === 'tenant') {
    return { allowed: true, reason: 'tenant-scope' };
  }

  if (resource.ownerActorIds.includes(actor.actorId)) {
    return { allowed: true, reason: 'owner-match' };
  }

  return { allowed: false, reason: 'missing-owner' };
}

export function platformV7AssertObjectScope(
  actor: PlatformV7TenantScopedActor,
  resource: PlatformV7ObjectScopedResource,
  scope: PlatformV7PermissionScope,
): void {
  const decision = platformV7ObjectScopeDecision(actor, resource, scope);

  if (!decision.allowed) {
    throw new Error(`platform-v7 object scope rejected: ${decision.reason}`);
  }
}
