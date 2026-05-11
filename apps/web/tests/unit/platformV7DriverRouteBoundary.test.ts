import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canPlatformV7RoleOpenRoute,
  getPlatformV7RoleHomeRoute,
  isPlatformV7SurfaceForbiddenForRole,
} from '@/lib/platform-v7/role-access';
import { canPlatformV7RoleInvokeAction } from '@/lib/platform-v7/action-permission-boundary';
import { platformV7NavItems, platformV7RoleRoute } from '@/lib/platform-v7/navigation';

function readSourceFile(...pathParts: string[]): string {
  const candidates = [
    join(process.cwd(), ...pathParts),
    join(process.cwd(), 'apps/web', ...pathParts),
  ];
  const sourcePath = candidates.find((candidate) => existsSync(candidate));
  if (!sourcePath) throw new Error(`Missing source file: ${pathParts.join('/')}`);
  return readFileSync(sourcePath, 'utf8');
}

const fieldPageSource = readSourceFile('app/platform-v7/driver/field/page.tsx');

describe('platform-v7 driver route boundary', () => {
  it('keeps driver home and role navigation on the field route', () => {
    expect(getPlatformV7RoleHomeRoute('driver')).toBe('/platform-v7/driver/field');
    expect(platformV7RoleRoute('driver')).toBe('/platform-v7/driver/field');
    expect(platformV7NavItems('driver')).toEqual([
      { href: '/platform-v7/driver/field', label: 'Маршрут', icon: 'logistics' },
    ]);
  });

  it('blocks driver from privileged office routes', () => {
    [
      '/platform-v7/bank',
      '/platform-v7/control-tower',
      '/platform-v7/investor',
      '/platform-v7/buyer',
      '/platform-v7/seller',
      '/platform-v7/connectors',
      '/platform-v7/roles',
    ].forEach((route) => {
      expect(canPlatformV7RoleOpenRoute('driver', route)).toMatchObject({ allowed: false });
    });
  });

  it('forbids driver money, bank, investor and switcher surfaces', () => {
    ([
      'bankReserve',
      'moneyRelease',
      'grainPrice',
      'thirdPartyBids',
      'investorMode',
      'controlTower',
      'roleSwitcher',
      'providerDebug',
    ] as const).forEach((surface) => {
      expect(isPlatformV7SurfaceForbiddenForRole('driver', surface)).toBe(true);
    });
  });

  it('allows driver field actions but blocks cross-role execution actions', () => {
    expect(canPlatformV7RoleInvokeAction('driver', 'driver.confirm_checkpoint')).toMatchObject({ allowed: true });
    expect(canPlatformV7RoleInvokeAction('driver', 'trip.open_incident')).toMatchObject({ allowed: true });
    expect(canPlatformV7RoleInvokeAction('driver', 'support.create_case')).toMatchObject({ allowed: true });
    expect(canPlatformV7RoleInvokeAction('driver', 'support.append_message')).toMatchObject({ allowed: true });

    ([
      'money.request_reserve',
      'bank.confirm_money_reserved',
      'bank.mark_money_ready_to_release',
      'bank.confirm_money_released',
      'logistics.assign_driver',
      'document.accept',
      'dispute.open',
      'arbitration.record_decision',
    ] as const).forEach((actionId) => {
      expect(canPlatformV7RoleInvokeAction('driver', actionId)).toMatchObject({ allowed: false });
    });
  });

  it('keeps the field page source free of direct privileged route links', () => {
    expect(fieldPageSource).not.toContain('next/link');
    [
      '/platform-v7/bank',
      '/platform-v7/control-tower',
      '/platform-v7/investor',
      '/platform-v7/buyer',
      '/platform-v7/seller',
      '/platform-v7/connectors',
      '/platform-v7/roles',
      '/platform-v7/demo',
    ].forEach((route) => {
      expect(fieldPageSource).not.toContain(route);
    });
  });
});
