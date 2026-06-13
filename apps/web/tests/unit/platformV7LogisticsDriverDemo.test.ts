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
    const lot = read('app/platform-v7/lots/[lotId]/page.tsx');
    const inbox = read('app/platform-v7/logistics/inbox/page.tsx');
    const driver = read('app/platform-v7/driver/field/page.tsx');
    const demo = read('app/platform-v7/demo/run/page.tsx');
    const runtimeSource = read('lib/platform-v7/deal-execution-source-of-truth.ts');

    // Trip id stays canonical across lot, inbox, demo and the runtime source.
    for (const content of [lot, inbox, demo, runtimeSource]) {
      expect(content).toContain('TRIP-2403-001');
    }

    // VP-5: driver cockpit is runtime-bound (reads the mission from Stage 5),
    // so the trip id is no longer a literal in the page — it comes from runtime.
    expect(driver).toContain('getPlatformV7DriverCockpitState');

    expect(lot).toContain('/platform-v7/logistics/inbox');
    expect(inbox).toContain('LOG-REQ-2403');
    expect(driver).toContain('Текущий рейс');
    expect(demo).toContain('/platform-v7/driver');
  });
});
