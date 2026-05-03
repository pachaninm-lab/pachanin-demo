import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7')) ? process.cwd() : path.join(process.cwd(), 'apps/web');
const driverPagePath = path.join(root, 'app/platform-v7/driver/page.tsx');

describe('platform-v7 driver role isolation', () => {
  it('keeps the driver page focused on field events without cross-role links', () => {
    expect(existsSync(driverPagePath)).toBe(true);

    const content = readFileSync(driverPagePath, 'utf8');

    expect(content).toContain('Полевой экран водителя');
    expect(content).toContain('Водитель фиксирует события рейса');
    expect(content).not.toContain("from 'next/link'");
    expect(content).not.toContain("href='/platform-v7/logistics'");
    expect(content).not.toContain("href='/platform-v7/elevator'");
    expect(content).not.toContain("href='/platform-v7/bank'");
    expect(content).not.toContain("href='/platform-v7/investor'");
  });
});
