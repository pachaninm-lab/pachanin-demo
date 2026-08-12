import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Права кабинета Гекты проверяются только на сервере.
 *
 * Разделение построено вокруг приватности: поиск пользователя и работа с
 * метаданными — обычная работа поддержки, а чтение содержания диалогов —
 * отдельная привилегия, которая дополнительно требует согласия пользователя.
 */

export const GEKTA_OPERATOR_ROLES = ['GEKTA_SUPPORT', 'GEKTA_OPERATOR', 'GEKTA_ADMIN', 'GEKTA_OWNER'] as const;
export type GektaOperatorRole = (typeof GEKTA_OPERATOR_ROLES)[number];

export const GEKTA_PERMISSIONS = [
  'account.search',
  'account.read_metadata',
  'account.read_conversation_content',
  'entitlement.grant_manual',
  'entitlement.grant_lifetime',
  'entitlement.revoke_manual',
  'entitlement.reset_quota',
  'entitlement.extend_trial',
  'account.suspend',
  'billing.read_metadata',
  'metrics.read_global',
  'audit.read',
] as const;
export type GektaPermission = (typeof GEKTA_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<GektaOperatorRole, readonly GektaPermission[]> = {
  GEKTA_SUPPORT: ['account.search', 'account.read_metadata'],
  GEKTA_OPERATOR: ['account.search', 'account.read_metadata', 'entitlement.reset_quota', 'billing.read_metadata'],
  GEKTA_ADMIN: [
    'account.search',
    'account.read_metadata',
    'entitlement.grant_manual',
    'entitlement.revoke_manual',
    'entitlement.reset_quota',
    'entitlement.extend_trial',
    'account.suspend',
    'billing.read_metadata',
    'audit.read',
  ],
  GEKTA_OWNER: [...GEKTA_PERMISSIONS],
};

export function permissionsFor(roles: readonly string[]): ReadonlySet<GektaPermission> {
  const granted = new Set<GektaPermission>();
  for (const role of roles) {
    const known = (GEKTA_OPERATOR_ROLES as readonly string[]).includes(role) ? (role as GektaOperatorRole) : null;
    if (!known) continue;
    for (const permission of ROLE_PERMISSIONS[known]) granted.add(permission);
  }
  return granted;
}

export const GEKTA_PERMISSION_KEY = 'gekta:permission';
export const RequireGektaPermission = (permission: GektaPermission) => SetMetadata(GEKTA_PERMISSION_KEY, permission);

@Injectable()
export class GektaOperatorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<GektaPermission | undefined>(GEKTA_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const roles: string[] = Array.isArray(request?.user?.gektaRoles)
      ? request.user.gektaRoles
      : Array.isArray(request?.user?.roles)
        ? request.user.roles
        : [];

    if (!permissionsFor(roles).has(required)) {
      throw new ForbiddenException('gekta_permission_denied');
    }
    return true;
  }
}
