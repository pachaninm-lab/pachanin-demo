import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  PLATFORM_V7_BUYER_ROUTE,
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_COMPLIANCE_ROUTE,
  PLATFORM_V7_FIELD_ROUTE,
  PLATFORM_V7_OPERATOR_ROUTE,
  PLATFORM_V7_ROLES_ROUTE,
  PLATFORM_V7_SELLER_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
  PLATFORM_V7R_ARBITRATOR_ROUTE,
  PLATFORM_V7R_DRIVER_ROUTE,
  PLATFORM_V7R_ELEVATOR_ROUTE,
  PLATFORM_V7R_LAB_ROUTE,
  PLATFORM_V7R_ROLES_ROUTE,
  PLATFORM_V7R_SURVEYOR_ROUTE,
} from '@/lib/platform-v7/routes';
import { platformV7RoleRoute as platformV7MainRoleRoute } from '@/lib/platform-v7/navigation';
import {
  platformV7NavByRole as platformV7ShellNavByRole,
  platformV7RoleRoute as platformV7ShellRoleRoute,
} from '@/lib/platform-v7/shellRoutes';

const roles: PlatformRole[] = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
];

const canonicalShellRoles: PlatformRole[] = ['driver', 'surveyor', 'elevator', 'lab', 'arbitrator', 'executive'];

describe('platform-v7 role route registry', () => {
  it('keeps role hub and operator routes in the command surface', () => {
    expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(PLATFORM_V7_ROLES_ROUTE);
    expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(PLATFORM_V7_OPERATOR_ROUTE);
  });

  it('keeps operational role routes in shell surface', () => {
    const shellRoleRoutes = [
      PLATFORM_V7_BUYER_ROUTE,
      PLATFORM_V7_SELLER_ROUTE,
      PLATFORM_V7_FIELD_ROUTE,
      PLATFORM_V7_OPERATOR_ROUTE,
      PLATFORM_V7_COMPLIANCE_ROUTE,
      PLATFORM_V7R_ROLES_ROUTE,
      PLATFORM_V7R_DRIVER_ROUTE,
      PLATFORM_V7R_SURVEYOR_ROUTE,
      PLATFORM_V7R_ELEVATOR_ROUTE,
      PLATFORM_V7R_LAB_ROUTE,
      PLATFORM_V7R_ARBITRATOR_ROUTE,
    ];

    for (const route of shellRoleRoutes) {
      expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain(route);
    }
  });

  it('keeps role routes inside platform-v7 or platform-v7r families only', () => {
    const allRoleRoutes = [
      PLATFORM_V7_ROLES_ROUTE,
      PLATFORM_V7_OPERATOR_ROUTE,
      PLATFORM_V7_BUYER_ROUTE,
      PLATFORM_V7_SELLER_ROUTE,
      PLATFORM_V7_FIELD_ROUTE,
      PLATFORM_V7_COMPLIANCE_ROUTE,
      PLATFORM_V7R_ROLES_ROUTE,
      PLATFORM_V7R_DRIVER_ROUTE,
      PLATFORM_V7R_SURVEYOR_ROUTE,
      PLATFORM_V7R_ELEVATOR_ROUTE,
      PLATFORM_V7R_LAB_ROUTE,
      PLATFORM_V7R_ARBITRATOR_ROUTE,
    ];

    for (const route of allRoleRoutes) {
      expect(route.startsWith('/platform-v7')).toBe(true);
      expect(route.includes('/platform-v4')).toBe(false);
      expect(route.includes('/platform-v9')).toBe(false);
    }
  });

  it('keeps shell role routes aligned with the canonical navigation role routes', () => {
    for (const role of roles) {
      expect(platformV7ShellRoleRoute(role)).toBe(platformV7MainRoleRoute(role));
    }
  });

  it('keeps canonical shell role routes out of the legacy v7r role layer', () => {
    for (const role of canonicalShellRoles) {
      expect(platformV7ShellRoleRoute(role).startsWith('/platform-v7/')).toBe(true);
      expect(platformV7ShellRoleRoute(role).startsWith('/platform-v7r/')).toBe(false);
    }
  });

  it('keeps driver shell navigation isolated to the own field route', () => {
    const driverNav = platformV7ShellNavByRole('driver');

    expect(driverNav).toEqual([{ href: '/platform-v7/driver/field', label: 'Мой маршрут' }]);
    expect(driverNav.map((item) => item.href).join(' ')).not.toContain('/platform-v7/deals');
    expect(driverNav.map((item) => item.href).join(' ')).not.toContain('/platform-v7/logistics');
  });
});