import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { getPlatformV7Environment, type PlatformEnvironmentInfo } from './environment';
import { platformV7Breadcrumbs, shouldShowPlatformV7Breadcrumbs, type PlatformV7BreadcrumbItem } from './breadcrumbs';
import { platformV7NavItems, platformV7RoleLabel, platformV7RoleStage, type PlatformV7NavItem } from './navigation';
import {
  platformV7CriticalShellNotifications,
  platformV7UnreadShellNotifications,
  type PlatformV7ShellNotification,
} from './shellNotifications';

export interface PlatformV7ShellModel {
  role: PlatformRole;
  roleLabel: string;
  stage: ReturnType<typeof platformV7RoleStage>;
  environment: PlatformEnvironmentInfo;
  navItems: PlatformV7NavItem[];
  breadcrumbs: PlatformV7BreadcrumbItem[];
  showBreadcrumbs: boolean;
  unreadNotifications: PlatformV7ShellNotification[];
  criticalNotifications: PlatformV7ShellNotification[];
}

export function inferPlatformV7RoleFromPath(pathname: string, currentRole: PlatformRole): PlatformRole {
  if (pathname.startsWith('/platform-v7/control-tower')) return 'operator';
  if (pathname.startsWith('/platform-v7/buyer') || pathname.startsWith('/platform-v7/procurement')) return 'buyer';
  if (pathname.startsWith('/platform-v7/seller') || pathname.startsWith('/platform-v7/lots')) return 'seller';
  if (pathname.startsWith('/platform-v7/logistics')) return 'logistics';
  if (pathname.startsWith('/platform-v7/driver')) return 'driver';
  if (pathname.startsWith('/platform-v7/surveyor')) return 'surveyor';
  if (pathname.startsWith('/platform-v7/elevator')) return 'elevator';
  if (pathname.startsWith('/platform-v7/lab')) return 'lab';
  if (pathname.startsWith('/platform-v7/bank')) return 'bank';
  if (pathname.startsWith('/platform-v7/arbitrator')) return 'arbitrator';
  if (pathname.startsWith('/platform-v7/compliance')) return 'compliance';
  if (pathname.startsWith('/platform-v7/analytics') || pathname.startsWith('/platform-v7/executive')) return 'executive';
  return currentRole;
}

export function platformV7ShellModel(pathname: string, currentRole: PlatformRole): PlatformV7ShellModel {
  const role = inferPlatformV7RoleFromPath(pathname, currentRole);
  return {
    role,
    roleLabel: platformV7RoleLabel(role),
    stage: platformV7RoleStage(role),
    environment: getPlatformV7Environment(),
    navItems: platformV7NavItems(role),
    breadcrumbs: platformV7Breadcrumbs(pathname),
    showBreadcrumbs: shouldShowPlatformV7Breadcrumbs(pathname),
    unreadNotifications: platformV7UnreadShellNotifications(),
    criticalNotifications: platformV7CriticalShellNotifications(),
  };
}
