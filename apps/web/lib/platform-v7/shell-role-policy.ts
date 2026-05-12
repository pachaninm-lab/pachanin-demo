import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export const FIELD_SHELL_ROLES = ['driver', 'surveyor', 'elevator', 'lab'] as const satisfies readonly PlatformRole[];
export const FIELD_SHELL_PATHS = ['/platform-v7/driver', '/platform-v7/surveyor', '/platform-v7/elevator', '/platform-v7/lab'] as const;

export const ROLE_SCOPED_SHELL_ROLES = ['buyer', 'seller', 'logistics', 'bank', 'arbitrator', 'compliance'] as const satisfies readonly PlatformRole[];
export const ROLE_SCOPED_SHELL_PATHS = ['/platform-v7/buyer', '/platform-v7/seller', '/platform-v7/procurement', '/platform-v7/logistics', '/platform-v7/bank', '/platform-v7/arbitrator', '/platform-v7/compliance'] as const;

export type ShellPolicy = 'field' | 'role-scoped' | 'operator';

export function getShellPolicy(role: PlatformRole, pathname: string): ShellPolicy {
  if (FIELD_SHELL_ROLES.includes(role as never) || FIELD_SHELL_PATHS.some((path) => pathname.startsWith(path))) return 'field';
  if (ROLE_SCOPED_SHELL_ROLES.includes(role as never) || ROLE_SCOPED_SHELL_PATHS.some((path) => pathname.startsWith(path))) return 'role-scoped';
  return 'operator';
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
  return getShellPolicy(role, pathname) !== 'field';
}
