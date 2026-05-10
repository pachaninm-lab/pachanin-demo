import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
} from '@/lib/platform-v7/action-permission-boundary';
import {
  canPlatformV7RoleOpenRoute,
  getPlatformV7RoleHomeRoute,
  isPlatformV7SurfaceForbiddenForRole,
  PLATFORM_V7_ROLE_FORBIDDEN_SURFACES,
} from '@/lib/platform-v7/role-access';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7'))
  ? process.cwd()
  : path.join(process.cwd(), 'apps/web');

const fieldPagePath = path.join(root, 'app/platform-v7/driver/field/page.tsx');
const fieldRuntimePath = path.join(root, 'components/v7r/FieldDriverRuntime.tsx');

describe('platform-v7 driver field shell no-regression', () => {
  it('driver field page source contains no direct bank, investor, money or control-tower route links', () => {
    expect(existsSync(fieldPagePath)).toBe(true);

    const content = readFileSync(fieldPagePath, 'utf8');

    expect(content).toContain('FieldDriverRuntime');
    expect(content).toContain('compact');
    expect(content).not.toContain("from 'next/link'");
    expect(content).not.toContain("href='/platform-v7/bank'");
    expect(content).not.toContain("href='/platform-v7/investor'");
    expect(content).not.toContain("href='/platform-v7/control-tower'");
    expect(content).not.toContain("href='/platform-v7/roles'");
    expect(content).not.toContain("href='/platform-v7/seller'");
    expect(content).not.toContain("href='/platform-v7/buyer'");
    expect(content).not.toContain('money');
    expect(content).not.toContain('reserve');
    expect(content).not.toContain('release');
  });

  it('FieldDriverRuntime guards deal and elevator cross-role links behind compact=false — field page is always compact', () => {
    expect(existsSync(fieldRuntimePath)).toBe(true);

    const content = readFileSync(fieldRuntimePath, 'utf8');

    const compactGuardIndex = content.indexOf('!compact');
    const elevatorLinkIndex = content.indexOf("'/platform-v7/elevator'");
    const dealsLinkIndex = content.indexOf('/platform-v7/deals/');

    expect(compactGuardIndex).toBeGreaterThan(-1);
    expect(elevatorLinkIndex).toBeGreaterThan(-1);
    expect(dealsLinkIndex).toBeGreaterThan(-1);

    expect(elevatorLinkIndex).toBeGreaterThan(compactGuardIndex);
    expect(dealsLinkIndex).toBeGreaterThan(compactGuardIndex);
  });

  it('driver home route is the field shell — not a bank, investor or commercial route', () => {
    const home = getPlatformV7RoleHomeRoute('driver');
    expect(home).toBe('/platform-v7/driver/field');
    expect(home).not.toContain('/bank');
    expect(home).not.toContain('/investor');
    expect(home).not.toContain('/seller');
    expect(home).not.toContain('/buyer');
    expect(home).not.toContain('/control-tower');
  });

  it('driver forbidden surfaces cover all financial and privileged operations', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'bankReserve')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'moneyRelease')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'investorMode')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'controlTower')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'roleSwitcher')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'grainPrice')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'thirdPartyBids')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'providerDebug')).toBe(true);
    expect(PLATFORM_V7_ROLE_FORBIDDEN_SURFACES['driver']).toHaveLength(8);
  });

  it('driver route access blocks all financial, privileged and cross-role routes', () => {
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/bank').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/bank/release-safety').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/investor').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/control-tower').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/buyer').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/seller').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/connectors').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/roles').allowed).toBe(false);
  });

  it('driver field shell route remains open to driver — the field page is their home', () => {
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/driver/field').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/driver').allowed).toBe(true);
  });

  it('driver cannot invoke any money, bank, logistics or arbitration action', () => {
    expect(canPlatformV7RoleInvokeAction('driver', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'bank.confirm_money_reserved').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'bank.mark_money_ready_to_release').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'logistics.assign_driver').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'document.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'arbitration.record_decision').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'deal.confirm_terms').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('driver', 'dispute.open').allowed).toBe(false);
  });

  it('driver field execution actions remain allowed — checkpoint and incident are not regressed', () => {
    expect(canPlatformV7RoleInvokeAction('driver', 'driver.confirm_checkpoint').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('driver', 'trip.open_incident').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('driver', 'support.create_case').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('driver', 'support.append_message').allowed).toBe(true);
  });
});
