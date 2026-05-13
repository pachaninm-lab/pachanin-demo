import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export const FIELD_SHELL_ROLES = ['driver', 'surveyor', 'elevator', 'lab'] as const satisfies readonly PlatformRole[];
export const FIELD_SHELL_PATHS = ['/platform-v7/driver', '/platform-v7/surveyor', '/platform-v7/elevator', '/platform-v7/lab'] as const;

export const ROLE_SCOPED_SHELL_ROLES = ['buyer', 'seller', 'logistics', 'bank', 'arbitrator', 'compliance'] as const satisfies readonly PlatformRole[];
export const ROLE_SCOPED_SHELL_PATHS = ['/platform-v7/buyer', '/platform-v7/seller', '/platform-v7/procurement', '/platform-v7/logistics', '/platform-v7/bank', '/platform-v7/arbitrator', '/platform-v7/compliance'] as const;

export const COMMERCIAL_HEADER_ROLES = ['seller', 'buyer', 'logistics'] as const satisfies readonly PlatformRole[];
export const CONTROL_HEADER_ROLES = ['bank', 'arbitrator', 'compliance'] as const satisfies readonly PlatformRole[];
export const OPERATOR_HEADER_ROLES = ['operator', 'executive', 'seller', 'buyer', 'logistics', 'bank', 'arbitrator', 'compliance'] as const satisfies readonly PlatformRole[];

export type ShellPolicy = 'field' | 'role-scoped' | 'operator';

export function inferPlatformRoleFromPath(pathname: string, fallback: PlatformRole): PlatformRole {
  if (pathname.startsWith('/platform-v7/control-tower') || pathname.startsWith('/platform-v7/operator')) return 'operator';
  if (pathname.startsWith('/platform-v7/executive') || pathname.startsWith('/platform-v7/analytics')) return 'executive';
  if (pathname.startsWith('/platform-v7/buyer') || pathname.startsWith('/platform-v7/procurement')) return 'buyer';
  if (pathname.startsWith('/platform-v7/seller') || pathname.startsWith('/platform-v7/lots')) return 'seller';
  if (pathname.startsWith('/platform-v7/logistics')) return 'logistics';
  if (pathname.startsWith('/platform-v7/driver')) return 'driver';
  if (pathname.startsWith('/platform-v7/surveyor')) return 'surveyor';
  if (pathname.startsWith('/platform-v7/elevator')) return 'elevator';
  if (pathname.startsWith('/platform-v7/lab')) return 'lab';
  if (pathname.startsWith('/platform-v7/bank')) return 'bank';
  if (pathname.startsWith('/platform-v7/arbitrator') || pathname.startsWith('/platform-v7/disputes')) return 'arbitrator';
  if (pathname.startsWith('/platform-v7/compliance') || pathname.startsWith('/platform-v7/connectors')) return 'compliance';
  return fallback;
}

export function getShellPolicy(role: PlatformRole, pathname: string): ShellPolicy {
  if (FIELD_SHELL_ROLES.includes(role as never) || FIELD_SHELL_PATHS.some((path) => pathname.startsWith(path))) return 'field';
  if (ROLE_SCOPED_SHELL_ROLES.includes(role as never) || ROLE_SCOPED_SHELL_PATHS.some((path) => pathname.startsWith(path))) return 'role-scoped';
  return 'operator';
}

export function getHeaderSelectableRoles(role: PlatformRole, pathname: string): readonly PlatformRole[] {
  const pathRole = inferPlatformRoleFromPath(pathname, role);
  const pathPolicy = getShellPolicy(pathRole, pathname);
  if (pathPolicy === 'field') return [];
  if (pathPolicy === 'operator') return OPERATOR_HEADER_ROLES;
  if (COMMERCIAL_HEADER_ROLES.includes(pathRole as never)) return COMMERCIAL_HEADER_ROLES;
  if (CONTROL_HEADER_ROLES.includes(pathRole as never)) return CONTROL_HEADER_ROLES;
  return [pathRole];
}

export function canShowRoleSwitcher(role: PlatformRole, pathname: string): boolean {
  return getShellPolicy(role, pathname) === 'operator';
}

export function canShowGlobalSearch(role: PlatformRole, pathname: string): boolean {
  return getShellPolicy(role, pathname) === 'operator';
}

export function canShowGlobalStatuses(role: PlatformRole, pathname: string): boolean {
  return getShellPolicy(role, pathname) === 'operator';
}

export function canShowDrawer(role: PlatformRole, pathname: string): boolean {
  return getShellPolicy(role, pathname) === 'operator';
}

export function canShowPortalRoleSwitcher(role: PlatformRole, pathname: string): boolean {
  const selectableRoles = getHeaderSelectableRoles(role, pathname);
  const pathPolicy = getShellPolicy(inferPlatformRoleFromPath(pathname, role), pathname);
  return pathPolicy === 'role-scoped' && selectableRoles.length > 1;
}
