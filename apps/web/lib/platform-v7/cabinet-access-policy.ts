// Cabinet-level RBAC: какие кабинеты доступны активной роли.
//
// Дополняет action-level RBAC (access-control.ts, применяется в рантайме к
// операциям) гейтингом на уровне маршрутов-кабинетов. Для controlled pilot
// допускается открытый просмотр кабинетов, но enforced-режим должен быть
// логически согласован с навигацией роли и не открывать неизвестные рабочие
// маршруты только из-за fallback-роли.

import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_NAV_BY_ROLE } from './shellRoutes';
import { inferPlatformRoleFromPath } from './shell-role-policy';

export const PLATFORM_V7_RBAC_FLAG = 'NEXT_PUBLIC_PLATFORM_V7_RBAC';

// Надзорные роли с доступом ко всем кабинетам (только просмотр контроля).
const OVERSIGHT_ROLES: ReadonlySet<PlatformRole> = new Set(['operator', 'executive']);

// Маршруты, открытые любой аутентифицированной роли: вход и выбор кабинета.
const SHARED_PATHS = ['/platform-v7/roles', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register'];

export function platformV7RbacEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[PLATFORM_V7_RBAC_FLAG] === 'enforced'
    || env.NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT === 'production';
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
  if (isRouteInRoleNavigation(role, pathname)) return true;

  // Маршрут «принадлежит» роли по тому же выводу, что и оболочка. Unknown routes
  // intentionally fall back to operator so participant roles do not get accidental access.
  const owningRole = inferPlatformRoleFromPath(pathname, 'operator');
  return owningRole === role;
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
  env: NodeJS.ProcessEnv = process.env,
): CabinetAccessDecision {
  const enforced = platformV7RbacEnforced(env);
  if (!enforced) {
    return { allowed: true, enforced, redirectTo: null, reason: 'RBAC не применяется (пилот, открытый доступ).' };
  }
  if (canRoleAccessCabinet(role, pathname)) {
    return { allowed: true, enforced, redirectTo: null, reason: `Роль «${role}» имеет доступ к маршруту.` };
  }
  return {
    allowed: false,
    enforced,
    redirectTo: '/platform-v7',
    reason: `Роль «${role}» не имеет доступа к ${pathname}; возврат к выбору кабинета.`,
  };
}
