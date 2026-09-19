import type { PlatformV7PermissionScope } from '../rbac/permissions';

export type PlatformV7TenantScopedActor = Readonly<{
  actorId: string;
  tenantId: string;
}>;

export type PlatformV7TenantScopedResource = Readonly<{
  tenantId: string;
}>;

export type PlatformV7TenantDecision = Readonly<{
  allowed: boolean;
  reason: 'tenant-match' | 'platform-readonly' | 'tenant-mismatch' | 'missing-tenant';
}>;

export function platformV7TenantScopeDecision(
  actor: PlatformV7TenantScopedActor,
  resource: PlatformV7TenantScopedResource,
  scope: PlatformV7PermissionScope,
): PlatformV7TenantDecision {
  if (!actor.tenantId || !resource.tenantId) {
    return { allowed: false, reason: 'missing-tenant' };
  }

  if (scope === 'platform-readonly') {
    return { allowed: true, reason: 'platform-readonly' };
  }

  if (actor.tenantId === resource.tenantId) {
    return { allowed: true, reason: 'tenant-match' };
  }

  return { allowed: false, reason: 'tenant-mismatch' };
}

export function platformV7AssertTenantScope(
  actor: PlatformV7TenantScopedActor,
  resource: PlatformV7TenantScopedResource,
  scope: PlatformV7PermissionScope,
): void {
  const decision = platformV7TenantScopeDecision(actor, resource, scope);

  if (!decision.allowed) {
    throw new Error(`platform-v7 tenant scope rejected: ${decision.reason}`);
  }
}
