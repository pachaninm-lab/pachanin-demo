import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const driverFieldPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/driver/field/page.tsx'), 'utf8');

const anchorTargets = Array.from(driverFieldPage.matchAll(/href="#([^"]+)"/g), (match) => match[1]);
const sectionIds = new Set(Array.from(driverFieldPage.matchAll(/<section id="([^"]+)"/g), (match) => match[1]));

describe('platform-v7 driver field first screen', () => {
  it('shows the operational first-screen contract before workflow details', () => {
    expect(driverFieldPage).toContain("data-testid='platform-v7-driver-field-first-screen'");
    expect(driverFieldPage).toContain('Что произошло');
    expect(driverFieldPage).toContain('Что заблокировано');
    expect(driverFieldPage).toContain('Деньги под риском');
    expect(driverFieldPage).toContain('Кто отвечает');
    expect(driverFieldPage).toContain('Следующее действие');
    expect(driverFieldPage.indexOf("data-testid='platform-v7-driver-field-first-screen'")).toBeLessThan(driverFieldPage.indexOf('<CockpitHero'));
  });

  it('keeps visible driver actions wired to real in-page sections', () => {
    expect(anchorTargets).toEqual([
      'driver-next-action',
      'driver-offline-events',
      'driver-next-action',
      'driver-offline-events',
      'driver-photo-seal',
      'driver-route-status',
    ]);

    for (const target of anchorTargets) {
      expect(sectionIds.has(target), `${target} must exist as an in-page section`).toBe(true);
      expect(driverFieldPage).toContain(`<section id="${target}" style={driverFieldSection}>`);
    }
  });

  it('keeps the driver field pass mobile-bounded and role-scoped', () => {
    expect(driverFieldPage).toContain('controlled-pilot / pre-integration');
    expect(driverFieldPage).toContain('только свой рейс');
    expect(driverFieldPage).toContain('нет доступа к денежному контуру');
    expect(driverFieldPage).toContain("overflowX: 'clip'");
    expect(driverFieldPage).toContain('scrollMarginTop: 92');
    expect(driverFieldPage).not.toContain('/platform-v7/bank');
    expect(driverFieldPage).not.toContain('/platform-v7/buyer');
    expect(driverFieldPage).not.toContain('production ready');
    expect(driverFieldPage).not.toContain('полностью готов');
  });
});
