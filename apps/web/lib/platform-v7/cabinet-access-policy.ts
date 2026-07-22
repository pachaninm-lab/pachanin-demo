import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { platformV7RoleCanOpenHref, platformV7RoleRoute } from './shellRoutes';

export const PLATFORM_V7_RBAC_FLAG = 'NEXT_PUBLIC_PLATFORM_V7_RBAC';

const OVERSIGHT_ROLES: ReadonlySet<PlatformRole> = new Set(['operator', 'executive']);
const SHARED_PATHS = [
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/notifications',
  '/platform-v7/api-docs',
  '/platform-v7/commodity-profiles',
];
const INTERNAL_OVERSIGHT_ROUTES = ['/platform-v7/support'];
const NON_CORE_OVERSIGHT_ROUTES = ['/platform-v7/investor'];

export function platformV7RbacEnforced(): boolean {
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

export function isPlatformV7InternalRoute(pathname: string): boolean {
  const clean = normalize(pathname);
  return INTERNAL_OVERSIGHT_ROUTES.some((route) => matchesPath(clean, route));
}

export function isPlatformV7NonCoreRoute(pathname: string): boolean {
  const clean = normalize(pathname);
  return NON_CORE_OVERSIGHT_ROUTES.some((route) => matchesPath(clean, route));
}

export function canRoleAccessCabinet(role: PlatformRole, pathname: string): boolean {
  const clean = normalize(pathname);
  if (!clean.startsWith('/platform-v7')) return true;
  if (isSharedPath(clean)) return true;
  if (OVERSIGHT_ROLES.has(role)) return true;
  if (isPlatformV7InternalRoute(clean) || isPlatformV7NonCoreRoute(clean)) return false;
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
  const redirectTo = platformV7RoleRoute(role) || '/platform-v7/login';
  return {
    allowed: false,
    enforced,
    redirectTo,
    reason: `Роль «${role}» не имеет доступа к ${clean}; возврат в свой кабинет.`,
  };
}
