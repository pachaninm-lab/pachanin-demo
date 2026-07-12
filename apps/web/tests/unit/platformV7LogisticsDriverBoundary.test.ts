import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  platformV7CommandNavByRole,
  platformV7NavByRole,
  platformV7RoleCanOpenHref,
} from '@/lib/platform-v7/shellRoutes';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const logisticsPage = read('apps/web/app/platform-v7/logistics/page.tsx');
const logisticsDriversPage = read('apps/web/app/platform-v7/logistics/drivers/page.tsx');

describe('platform-v7 logistics and driver role boundary', () => {
  it('does not permit the logistics role to open the driver field cabinet', () => {
    expect(platformV7RoleCanOpenHref('logistics', '/platform-v7/driver/field')).toBe(false);
    expect(platformV7RoleCanOpenHref('logistics', '/platform-v7/logistics/drivers')).toBe(true);
    expect(platformV7RoleCanOpenHref('driver', '/platform-v7/logistics')).toBe(false);
  });

  it('keeps logistics navigation inside logistics-owned routes', () => {
    const logisticsLinks = [
      ...platformV7NavByRole('logistics'),
      ...platformV7CommandNavByRole('logistics'),
    ];
    expect(logisticsLinks.some((item) => item.href.startsWith('/platform-v7/driver'))).toBe(false);
    expect(logisticsLinks.some((item) => item.href === '/platform-v7/logistics/drivers')).toBe(true);
  });

  it('removes direct driver-cabinet links from the logistics dashboard', () => {
    expect(logisticsPage).not.toContain("href='/platform-v7/driver/field'");
    expect(logisticsPage).not.toContain("href: '/platform-v7/driver/field'");
    expect(logisticsPage).toContain("href='/platform-v7/logistics/drivers'");
    expect(logisticsPage).toContain("href: '/platform-v7/deal-logistics'");
  });

  it('provides a separate dispatcher view for managing drivers', () => {
    expect(logisticsDriversPage).toContain('Водители и машины');
    expect(logisticsDriversPage).toContain('Это экран логиста, а не личный кабинет водителя.');
    expect(logisticsDriversPage).not.toContain('/platform-v7/driver/field');
  });
});
