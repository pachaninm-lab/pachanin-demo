import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffAccessService } from '../staff-access/staff-access.service';

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

/**
 * Роли Гекты выводятся из штатной роли платформы, которую сервер уже разрешил
 * по PostgreSQL и положил в `staffRoles`. Отдельного хранилища ролей нет:
 * иначе кабинет оператора был бы недостижим — платформенный токен не несёт
 * ни одной роли с префиксом GEKTA_.
 *
 * Соответствие намеренно узкое. Роль, которой здесь нет, не получает в Гекте
 * ничего, даже если на платформе она привилегированная.
 */
const STAFF_ROLE_TO_GEKTA: Readonly<Record<string, GektaOperatorRole>> = {
  PLATFORM_OWNER: 'GEKTA_OWNER',
  PLATFORM_ADMIN: 'GEKTA_ADMIN',
  SUPPORT_L2: 'GEKTA_OPERATOR',
  SUPPORT_L1: 'GEKTA_SUPPORT',
};

export function gektaRolesFromStaffRoles(staffRoles: readonly string[]): GektaOperatorRole[] {
  const mapped = new Set<GektaOperatorRole>();
  for (const role of staffRoles) {
    const gekta = STAFF_ROLE_TO_GEKTA[role];
    if (gekta) mapped.add(gekta);
  }
  return [...mapped];
}

/**
 * Роли берутся только из проверенного серверного контекста запроса. Ни тело
 * запроса, ни заголовок, ни cookie сюда не попадают.
 */
export function resolveGektaRoles(user: {
  gektaRoles?: unknown;
  staffRoles?: unknown;
} | undefined): GektaOperatorRole[] {
  const direct = Array.isArray(user?.gektaRoles) ? user.gektaRoles.filter((role): role is string => typeof role === 'string') : [];
  const known = direct.filter((role): role is GektaOperatorRole => (GEKTA_OPERATOR_ROLES as readonly string[]).includes(role));
  if (known.length) return known;
  const staff = Array.isArray(user?.staffRoles) ? user.staffRoles.filter((role): role is string => typeof role === 'string') : [];
  return gektaRolesFromStaffRoles(staff);
}

export const GEKTA_PERMISSION_KEY = 'gekta:permission';
export const RequireGektaPermission = (permission: GektaPermission) => SetMetadata(GEKTA_PERMISSION_KEY, permission);

/**
 * Штатные назначения читаются из PostgreSQL прямо здесь.
 *
 * Глобальный AppAuthGuard обогащает актора ролями только на маршрутах `/staff`
 * и по заголовку штатной сессии. Маршруты Гекты под это условие не подпадают,
 * и без собственного разрешения ролей кабинет оператора был бы недостижим для
 * всех — то есть остался бы кнопкой, которая ничего не делает.
 *
 * Условие AppAuthGuard намеренно не расширяется: это общий контур авторизации
 * платформы, и менять его ради одного продукта нельзя.
 */
type StaffActorResolver = { enrichActor: (user: { id: string }) => Promise<{ staffRoles?: string[] }> };

@Injectable()
export class GektaOperatorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(StaffAccessService)
    private readonly staffAccess?: StaffActorResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<GektaPermission | undefined>(GEKTA_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    if (this.staffAccess && request?.user?.id && !Array.isArray(request.user.staffRoles)) {
      const enriched = await this.staffAccess.enrichActor(request.user);
      request.user.staffRoles = enriched.staffRoles ?? [];
    }
    const roles = resolveGektaRoles(request?.user);

    if (!permissionsFor(roles).has(required)) {
      throw new ForbiddenException('gekta_permission_denied');
    }
    return true;
  }
}
