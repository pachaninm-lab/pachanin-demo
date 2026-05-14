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
    expect(ui).toContain('return <DriverFieldShell task={deal.driverTask} theme={theme} />');
  });

  it('keeps adaptive mobile primitives in scoped styles', () => {
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(css).toContain('100dvh');
    expect(css).toContain('safe-area-inset-bottom');
    expect(css).toContain('container-type: inline-size');
    expect(css).toContain('@container');
    expect(css).toContain('overflow-x: clip');
  });

  it('keeps money reconciliation as one reserved amount split into controlled buckets', () => {
    const money = read('apps/web/lib/platform-v7/premium/money.ts');

    expect(money).toContain('money.reservedRub - (money.readyToReleaseRub + money.heldRub + money.awaitingDocsRub + money.disputedRub + money.releasedRub)');
    expect(money).toContain('Math.abs(getMoneyBalanceDelta(money)) < 1');
  });

  it('keeps unsafe maturity and guarantee claims out of premium UI sources', () => {
    const files = [
      'apps/web/components/platform-v7/premium/ExecutionUi.tsx',
      'apps/web/components/v7r/PlatformCommandCenterHub.tsx',
      'apps/web/lib/platform-v7/premium/copy.ts',
    ];

    const source = files.map(read).join('\n');

    expect(source).not.toContain('production-ready');
    expect(source).not.toContain('fully live');
    expect(source).not.toContain('fully integrated');
    expect(source).not.toContain('marketplace');
    expect(source).not.toContain('sandbox');
    expect(source).not.toContain('guarantee payment');
    expect(source).not.toContain('risk-free deal');
  });

  it('keeps role adapter explicit between product roles and stored platform roles', () => {
    const hub = read('apps/web/components/v7r/PlatformCommandCenterHub.tsx');

    expect(hub).toContain("if (role === 'arbitrator') return 'arbiter';");
    expect(hub).toContain("if (role === 'arbiter') return 'arbitrator';");
    expect(hub).toContain('onRoleChange={(nextRole) => setRole(denormalizeRole(nextRole))}');
  });
});
