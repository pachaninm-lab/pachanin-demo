// Cabinet-level RBAC: какие кабинеты доступны активной роли.
//
// Дополняет action-level RBAC (access-control.ts, применяется в рантайме к
// операциям) гейтингом на уровне маршрутов-кабинетов. Для controlled pilot
// route access must be strict: participant roles cannot walk through shared
// workspaces such as deals/disputes into another cabinet.

import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { platformV7RoleCanOpenHref, platformV7RoleRoute } from './shellRoutes';

export const PLATFORM_V7_RBAC_FLAG = 'NEXT_PUBLIC_PLATFORM_V7_RBAC';

// Надзорные роли с доступом ко всем кабинетам (операторский/управленческий просмотр).
const OVERSIGHT_ROLES: ReadonlySet<PlatformRole> = new Set(['operator', 'executive']);

// Маршруты, открытые без выбора роли: главная, открытая карточка, вход, регистрация.
const SHARED_PATHS = ['/platform-v7/open', '/platform-v7/login', '/platform-v7/register'];

export function platformV7RbacEnforced(): boolean {
  // Controlled pilot now requires strict route boundaries by default. The old
  // pilot-open mode allowed participants to enter shared cross-role surfaces.
  return true;
}

function normalize(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function matchesPath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isSharedPath(pathname: string): boolean {
  const clean = normalize(pathname);
  if (clean === '/platform-v7') return true;
  return SHARED_PATHS.some((p) => matchesPath(clean, p));
}

export function canRoleAccessCabinet(role: PlatformRole, pathname: string): boolean {
  const clean = normalize(pathname);
  if (!clean.startsWith('/platform-v7')) return true;
  if (isSharedPath(clean)) return true;
  if (OVERSIGHT_ROLES.has(role)) return true;
  return platformV7RoleCanOpenHref(role, clean);
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
  const clean = normalize(pathname);
  if (canRoleAccessCabinet(role, clean)) {
    return { allowed: true, enforced, redirectTo: null, reason: `Роль «${role}» имеет доступ к маршруту.` };
  }
  return {
    allowed: false,
    enforced,
    redirectTo: platformV7RoleRoute(role) ?? '/platform-v7/login',
    reason: `Роль «${role}» не имеет доступа к ${clean}; возврат в свой кабинет.`,
  };
}
