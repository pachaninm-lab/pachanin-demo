import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 premium execution shell', () => {
  it('wires root command center to the premium shell', () => {
    const hub = read('apps/web/components/v7r/PlatformCommandCenterHub.tsx');

    expect(hub).toContain('PremiumDealShell');
    expect(hub).toContain('PLATFORM_V7_EXECUTION_SOURCE');
    expect(hub).toContain('normalizeRole');
    expect(hub).toContain('denormalizeRole');
  });

  it('keeps driver role on the field shell path', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');

    expect(ui).toContain("driver: ['execution']");
    expect(ui).toContain("activeRole === 'driver'");
    expect(ui).toContain('DriverFieldShell');
  });

  it('keeps adaptive mobile primitives in scoped styles', () => {
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(css).toContain('100dvh');
    expect(css).toContain('safe-area-inset-bottom');
    expect(css).toContain('container-type: inline-size');
    expect(css).toContain('@container');
    expect(css).toContain('overflow-x: clip');
  });
});
