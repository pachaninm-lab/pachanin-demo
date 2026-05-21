import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getHeaderSelectableRoles } from '@/lib/platform-v7/shell-role-policy';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7')) ? process.cwd() : path.join(process.cwd(), 'apps/web');
const driverFieldPath = path.join(root, 'app/platform-v7/driver/field/page.tsx');

describe('driver-isolation', () => {
  it('does not expose role switching on driver and field routes', () => {
    for (const route of ['/platform-v7/driver', '/platform-v7/driver/field', '/platform-v7/elevator', '/platform-v7/lab']) {
      expect(getHeaderSelectableRoles('operator', route)).toEqual([]);
    }
  });

  it('keeps the driver field page scoped to route, ETA, photos, seal and offline queue', () => {
    expect(existsSync(driverFieldPath)).toBe(true);

    const content = readFileSync(driverFieldPath, 'utf8');
    const forbiddenVisibleTerms = ['банк', 'резерв', 'сумма сделки', 'продавец', 'покупатель', 'control-tower', 'executive'];

    expect(content).toContain('Полевой режим · только рейс');
    expect(content).toContain('Офлайн-события');
    expect(content).toContain('Фото и пломба');
    expect(content).toContain('GPS / вес');

    for (const term of forbiddenVisibleTerms) {
      expect(content.toLowerCase()).not.toContain(term);
    }
  });
});
