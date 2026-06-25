import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const driverFieldPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/driver/field/page.tsx'), 'utf8');

describe('platform-v7 driver field first screen', () => {
  it('shows the operational first-screen contract before workflow details', () => {
    expect(driverFieldPage).toContain("data-testid='platform-v7-driver-field-first-screen'");
    expect(driverFieldPage).toContain('Что произошло');
    expect(driverFieldPage).toContain('Что заблокировано');
    expect(driverFieldPage).toContain('Деньги под риском');
    expect(driverFieldPage).toContain('Кто отвечает');
    expect(driverFieldPage).toContain('Следующее действие');
    expect(driverFieldPage.indexOf("data-testid='platform-v7-driver-field-first-screen'")).toBeLessThan(driverFieldPage.indexOf("<CockpitHero"));
  });

  it('keeps visible first-screen actions wired to real sections', () => {
    expect(driverFieldPage).toContain('<a href="#driver-next-action" style={compactAction}>Открыть действие</a>');
    expect(driverFieldPage).toContain('<a href="#driver-offline-events" style={compactGhostAction}>Проверить очередь</a>');
    expect(driverFieldPage).toContain('<section id="driver-next-action">');
    expect(driverFieldPage).toContain('<section id="driver-offline-events">');
    expect(driverFieldPage).toContain('<section id="driver-photo-seal">');
    expect(driverFieldPage).toContain('<section id="driver-route-status">');
  });

  it('keeps the driver field pass honest and role-scoped', () => {
    expect(driverFieldPage).toContain('controlled-pilot / pre-integration');
    expect(driverFieldPage).toContain('только свой рейс');
    expect(driverFieldPage).toContain('нет доступа к выплатам');
    expect(driverFieldPage).not.toContain('production ready');
    expect(driverFieldPage).not.toContain('полностью готов');
  });
});
