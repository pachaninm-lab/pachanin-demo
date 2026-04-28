import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_COMMAND_SECTION_ITEMS, platformV7CommandSectionItems } from '@/lib/platform-v7/command';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DATA_ROOM_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_OPERATOR_ROUTE,
  PLATFORM_V7_READINESS_ROUTE,
} from '@/lib/platform-v7/routes';

describe('platform-v7 command foundation', () => {
  it('keeps control tower command title in Russian', () => {
    expect(PLATFORM_V7_COMMAND_SECTION_ITEMS[0]).toMatchObject({
      id: 'sec-control',
      title: 'Центр управления',
      href: PLATFORM_V7_CONTROL_TOWER_ROUTE,
    });
  });

  it('keeps command section items centralized', () => {
    const items = platformV7CommandSectionItems();
    expect(items.length).toBeGreaterThanOrEqual(11);
    expect(items.map((item) => item.href)).toContain('/platform-v7/roles');
    expect(items.map((item) => item.href)).toContain('/platform-v7/control-tower/canonical-reconciliation');
    expect(items.every((item) => item.group === 'Разделы')).toBe(true);
  });

  it('keeps legacy search keywords for compatibility without changing visible label', () => {
    const control = platformV7CommandSectionItems()[0];
    expect(control?.title).toBe('Центр управления');
    expect(control?.keywords).toContain('control tower');
  });

  it('exposes canonical KPI reconciliation as a searchable engineering route', () => {
    const reconciliation = platformV7CommandSectionItems().find((item) => item.id === 'sec-canonical-kpi-reconciliation');
    expect(reconciliation).toMatchObject({
      title: 'Сверка показателей',
      href: '/platform-v7/control-tower/canonical-reconciliation',
    });
    expect(reconciliation?.keywords).toContain('canonical');
    expect(reconciliation?.keywords).toContain('kpi');
  });

  it('exposes execution machine routes through centralized command routes', () => {
    const commandHrefs = platformV7CommandSectionItems().map((item) => item.href);

    for (const route of PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES) {
      expect(commandHrefs).toContain(route);
    }

    expect(commandHrefs).toContain(PLATFORM_V7_BANK_ROUTE);
    expect(commandHrefs).toContain(PLATFORM_V7_OPERATOR_ROUTE);
    expect(commandHrefs).toContain(PLATFORM_V7_READINESS_ROUTE);
    expect(commandHrefs).toContain(PLATFORM_V7_DATA_ROOM_ROUTE);
    expect(commandHrefs).toContain(PLATFORM_V7_LOGISTICS_ROUTE);
    expect(commandHrefs).toContain(PLATFORM_V7_DISPUTES_ROUTE);
  });
});
