// Cabinet-level RBAC: какие кабинеты доступны активной роли.
//
// Дополняет action-level RBAC (access-control.ts, применяется в рантайме к
// операциям) гейтингом на уровне маршрутов-кабинетов. Для controlled pilot
// route access must be strict: participant roles cannot walk through shared
// workspaces such as deals/disputes into another cabinet.

import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_NAV_BY_ROLE } from './shellRoutes';

export const PLATFORM_V7_RBAC_FLAG = 'NEXT_PUBLIC_PLATFORM_V7_RBAC';

// Надзорные роли с доступом ко всем кабинетам (операторский/управленческий просмотр).
const OVERSIGHT_ROLES: ReadonlySet<PlatformRole> = new Set(['operator', 'executive']);

// Маршруты, открытые без выбора роли: вход, регистрация, открытая карточка.
const SHARED_PATHS = ['/platform-v7/roles', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register'];

export function platformV7RbacEnforced(): boolean {
  // Controlled pilot now requires strict route boundaries by default. The old
  // pilot-open mode allowed participants to enter shared cross-role surfaces.
  return true;
}

function isSharedPath(pathname: string): boolean {
  if (pathname === '/platform-v7') return true;
  return SHARED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isRouteInRoleNavigation(role: PlatformRole, pathname: string): boolean {
  const items = PLATFORM_V7_NAV_BY_ROLE[role] || [];
  return items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function canRoleAccessCabinet(role: PlatformRole, pathname: string): boolean {
  if (!pathname.startsWith('/platform-v7')) return true;
  if (isSharedPath(pathname)) return true;
  if (OVERSIGHT_ROLES.has(role)) return true;
  return isRouteInRoleNavigation(role, pathname);
}

export interface CabinetAccessDecision {
  readonly allowed: boolean;
  readonly enforced: boolean;
  readonly redirectTo: string | null;
  readonly reason: string;
}

export function cabinetAccessDecision(
  role: PlatformRole,
  pathname: string,
): CabinetAccessDecision {
  const enforced = platformV7RbacEnforced();
  if (canRoleAccessCabinet(role, pathname)) {
    return { allowed: true, enforced, redirectTo: null, reason: `Роль «${role}» имеет доступ к маршруту.` };
  }
  return {
    allowed: false,
    enforced,
    redirectTo: '/platform-v7/login',
    reason: `Роль «${role}» не имеет доступа к ${pathname}; возврат к единому входу.`,
  };
}
