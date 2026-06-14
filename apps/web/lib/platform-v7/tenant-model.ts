// PR-1 Tenant/RBAC hardening — явная multi-tenant модель поверх access-control.
//
// Движок прав (access-control.ts) уже изолирует доступ по организации через
// scope-правила. Этот модуль формализует tenant-семантику: организация →
// пользователи/членство → объекты сделки, и даёт production-shaped API «доступ
// только к своим объектам», не дублируя сам движок правил. Работает без внешнего
// провайдера identity (ЕСИА/СберБизнес ID подключаются позже как источник
// PlatformV7User, контракт не меняется).

import {
  assertPermission,
  canAccessResource,
  platformV7AccessDecision,
  type PlatformV7AccessActor,
  type PlatformV7AccessDecision,
  type PlatformV7AccessRole,
  type PlatformV7Action,
  type PlatformV7ResourceScope,
} from './access-control';
import { toPlatformV7CanonicalRole } from './role-canonical';

export type PlatformV7OrganizationKind =
  | 'seller'
  | 'buyer'
  | 'carrier'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'platform'
  | 'compliance';

export interface PlatformV7Organization {
  readonly id: string;
  readonly name: string;
  readonly kind: PlatformV7OrganizationKind;
}

export interface PlatformV7User {
  readonly id: string;
  readonly organizationId: string;
  readonly roles: readonly PlatformV7AccessRole[];
  readonly displayName?: string;
}

export interface PlatformV7Membership {
  readonly userId: string;
  readonly organizationId: string;
  readonly role: PlatformV7AccessRole;
}

// Роли с платформенным охватом (надзор/контроль) — для них tenant-изоляция по
// организации объекта не применяется (доступ задаётся правилами access-control).
const PLATFORM_SCOPED_ROLES: ReadonlySet<string> = new Set([
  'platform_admin',
  'operator',
  'compliance_officer',
  'arbitrator',
  'executive_viewer',
  'investor',
  'support_agent',
]);

export function platformV7BuildActor(user: PlatformV7User, activeRole: PlatformV7AccessRole): PlatformV7AccessActor {
  return {
    userId: user.id,
    organizationId: user.organizationId,
    roles: user.roles,
    activeRole,
  };
}

// Все организации, участвующие в объекте (владелец/продавец/покупатель/перевозчик/
// банк/назначенные исполнители/связанные). Используется для tenant-фильтрации
// списков и для проверки «своего» объекта.
export function platformV7ResolveObjectOrganizations(scope: PlatformV7ResourceScope): readonly string[] {
  const ids = [
    scope.ownerOrganizationId,
    scope.buyerOrganizationId,
    scope.sellerOrganizationId,
    scope.carrierOrganizationId,
    scope.bankOrganizationId,
    scope.assignedLabOrganizationId,
    scope.assignedElevatorOrganizationId,
    scope.assignedSurveyorOrganizationId,
    scope.supportOrganizationId,
    scope.roleScopeOrganizationId,
    ...(scope.linkedOrganizationIds ?? []),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0);
  return [...new Set(ids)];
}

function isPlatformScopedRole(activeRole: PlatformV7AccessRole): boolean {
  const canonical = toPlatformV7CanonicalRole(activeRole);
  return canonical !== null && PLATFORM_SCOPED_ROLES.has(canonical);
}

// Попытка пересечь границу арендатора: участник-роль обращается к объекту, в
// котором его организация (а для водителя — пользователь) не участвует.
export function platformV7IsCrossTenant(actor: PlatformV7AccessActor, scope: PlatformV7ResourceScope): boolean {
  if (isPlatformScopedRole(actor.activeRole)) return false;
  if (scope.assignedDriverUserId) {
    return scope.assignedDriverUserId !== actor.userId
      && !platformV7ResolveObjectOrganizations(scope).includes(actor.organizationId);
  }
  return !platformV7ResolveObjectOrganizations(scope).includes(actor.organizationId);
}

// Доступ к объекту сделки с учётом роли, действия и арендатора. Авторитетное
// решение делегируется движку прав; tenant-слой добавляет явную семантику.
export function platformV7TenantAccessDecision(
  actor: PlatformV7AccessActor,
  scope: PlatformV7ResourceScope,
  action: PlatformV7Action = 'read',
): PlatformV7AccessDecision {
  return platformV7AccessDecision({ actor, action, resource: scope });
}

export function platformV7CanAccessOwnObject(
  actor: PlatformV7AccessActor,
  scope: PlatformV7ResourceScope,
  action: PlatformV7Action = 'read',
): boolean {
  return canAccessResource(actor, scope, action).allowed;
}

// Бросает PlatformRbacError при отказе (для серверных границ операций).
export function platformV7AssertTenantAccess(
  actor: PlatformV7AccessActor,
  scope: PlatformV7ResourceScope,
  action: PlatformV7Action = 'read',
): PlatformV7AccessDecision {
  return assertPermission({ actor, action, resource: scope });
}
