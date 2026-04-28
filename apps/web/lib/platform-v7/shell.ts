import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { getPlatformV7Environment, type PlatformEnvironmentInfo } from './environment';
import { platformV7Breadcrumbs, shouldShowPlatformV7Breadcrumbs, type PlatformV7BreadcrumbItem } from './breadcrumbs';
import { platformV7NavItems, platformV7RoleStage, type PlatformV7NavItem } from './navigation';
import { platformV7RoleLabel, PLATFORM_V7_ROLE_LABELS } from './shellLabels';
import {
  platformV7UnreadShellNotifications,
  platformV7CriticalShellNotifications,
  type PlatformV7ShellNotification,
} from './shellNotifications';
import {
  platformV7ShellRegistryEntries,
  platformV7ShellRegistryShortcutEntries,
  type PlatformV7ShellRegistryEntry,
} from './shellRegistry';
import { platformV7QuickJumpItems, type PlatformV7QuickJumpItem } from './shellQuickJump';
import { platformV7ShortcutHelpItems, type PlatformV7ShortcutHelpItem } from './shellShortcuts';

export interface PlatformV7ShellModel {
  role: PlatformRole;
  roleLabel: string;
  stage: ReturnType<typeof platformV7RoleStage>;
  environment: PlatformEnvironmentInfo;
  navItems: PlatformV7NavItem[];
  breadcrumbs: PlatformV7BreadcrumbItem[];
  showBreadcrumbs: boolean;
  unreadNotifications: readonly PlatformV7ShellNotification[];
  criticalNotifications: readonly PlatformV7ShellNotification[];
  shortcuts: readonly PlatformV7ShortcutHelpItem[];
  quickJumpEntries: readonly PlatformV7QuickJumpItem[];
  registryEntries: readonly PlatformV7ShellRegistryEntry[];
  registryShortcutEntries: readonly PlatformV7ShellRegistryEntry[];
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
    shortcuts: platformV7ShortcutHelpItems(),
    quickJumpEntries: platformV7QuickJumpItems(),
    registryEntries: platformV7ShellRegistryEntries(),
    registryShortcutEntries: platformV7ShellRegistryShortcutEntries(),
  };
}
