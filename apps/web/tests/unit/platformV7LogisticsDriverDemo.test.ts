import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7')) ? process.cwd() : path.join(process.cwd(), 'apps/web');

function read(relativePath: string) {
  const target = path.join(root, relativePath);
  expect(existsSync(target)).toBe(true);
  return readFileSync(target, 'utf8');
}

describe('platform-v7 logistics driver simulation', () => {
  it('connects lot winner to logistics inbox and driver trip', () => {
    const lot = read('app/platform-v7/lots/[id]/page.tsx');
    const inbox = read('app/platform-v7/logistics/inbox/page.tsx');
    const driver = read('app/platform-v7/driver/page.tsx');
    const demo = read('app/platform-v7/demo/run/page.tsx');

    for (const content of [lot, inbox, driver, demo]) {
      expect(content).toContain('TRIP-SIM-001');
    }

    expect(lot).toContain('/platform-v7/logistics/inbox');
    expect(inbox).toContain('LOG-REQ-2403');
    expect(driver).toContain('Трекер маршрута');
    expect(demo).toContain('/platform-v7/driver');
  });
});
