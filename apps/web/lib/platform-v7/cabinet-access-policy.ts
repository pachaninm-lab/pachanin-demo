// Cabinet-level RBAC: какие кабинеты доступны активной роли.
//
// Дополняет action-level RBAC (access-control.ts, применяется в рантайме к
// операциям) гейтингом на уровне маршрутов-кабинетов. Для controlled pilot
// route access must be strict: participant roles cannot walk through shared
// workspaces such as deals/disputes into another cabinet.

import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_NAV_BY_ROLE, PLATFORM_V7_ROLE_ROUTES } from './shellRoutes';
import { PLATFORM_V7_AI_ROUTE } from './routes';

export const PLATFORM_V7_RBAC_FLAG = 'NEXT_PUBLIC_PLATFORM_V7_RBAC';

// Надзорные роли с доступом ко всем кабинетам (операторский/управленческий просмотр).
const OVERSIGHT_ROLES: ReadonlySet<PlatformRole> = new Set(['operator', 'executive']);

// Маршруты, открытые без выбора роли: вход, регистрация, открытая карточка.
const SHARED_PATHS = ['/platform-v7/roles', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register'];

// Role-neutral route inside the platform shell. It must stay within platform-v7
// and must not be treated as a cabinet switch.
const ROLE_NEUTRAL_SHELL_PATHS = [PLATFORM_V7_AI_ROUTE];

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

function isRoleNeutralShellPath(pathname: string): boolean {
  const clean = normalize(pathname);
  return ROLE_NEUTRAL_SHELL_PATHS.some((p) => matchesPath(clean, p));
}

function isRouteInRoleNavigation(role: PlatformRole, pathname: string): boolean {
  const clean = normalize(pathname);
  const items = PLATFORM_V7_NAV_BY_ROLE[role] || [];
  return items.some((item) => matchesPath(clean, item.href));
}

export function canRoleAccessCabinet(role: PlatformRole, pathname: string): boolean {
  const clean = normalize(pathname);
  if (!clean.startsWith('/platform-v7')) return true;
  if (isSharedPath(clean)) return true;
  if (isRoleNeutralShellPath(clean)) return true;
  if (OVERSIGHT_ROLES.has(role)) return true;
  return isRouteInRoleNavigation(role, clean);
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
    redirectTo: PLATFORM_V7_ROLE_ROUTES[role] ?? '/platform-v7/login',
    reason: `Роль «${role}» не имеет доступа к ${clean}; возврат в свой кабинет.`,
  };
}
