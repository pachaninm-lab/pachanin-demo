import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDesignSystemV8Route } from '@/lib/platform-v7/design-system-v8-routes';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const ACCEPTED_ROUTES = [
  '/platform-v7/control-tower',
  '/platform-v7/operator',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/driver/field',
  '/platform-v7/surveyor',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/executive',
  '/platform-v7/deals',
  '/platform-v7/deals/server-deal-id/execution',
  '/platform-v7/documents',
  '/platform-v7/disputes',
  '/platform-v7/bank/release-safety',
  '/platform-v7/money',
  '/platform-v7/auction',
  '/platform-v7/auction/import',
  '/platform-v7/auction/admission',
  '/platform-v7/auction/bids',
  '/platform-v7/auction/deal-basis',
  '/platform-v7/deal-logistics',
  '/platform-v7/deal-acceptance',
  '/platform-v7/deal-documents-basis',
] as const;

const HISTORICAL_ROUTES = [
  '/platform-v7/deals/server-deal-id/clean',
  '/platform-v7/deals/compare',
  '/platform-v7/notifications',
  '/platform-v7/execution-map',
] as const;

describe('Design System v8 legacy isolation', () => {
  it.each(ACCEPTED_ROUTES)('classifies %s as an accepted v8 route', (route) => {
    expect(isDesignSystemV8Route(route)).toBe(true);
  });

  it.each(HISTORICAL_ROUTES)('keeps %s behind the compatibility boundary', (route) => {
    expect(isDesignSystemV8Route(route)).toBe(false);
  });

  it('does not import legacy style bundles from the v8 runtime', () => {
    const runtime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');

    expect(runtime).toContain('packages/design-tokens/tokens.css');
    expect(runtime).not.toMatch(/@\/app\/v9(?:\.css)?/);
    expect(runtime).not.toMatch(/@\/styles\/platform-v7-/);
    expect(runtime).not.toContain('PlatformV7FullStyleRuntime');
  });

  it('keeps active shell controls free from runtime style injection', () => {
    for (const file of [
      'apps/web/components/platform-v7/ScopedShellGuard.tsx',
      'apps/web/components/platform-v7/CalculatorHeaderWidget.tsx',
      'apps/web/components/platform-v7/HeaderLanguageSwitch.tsx',
    ]) {
      const source = read(file);
      expect(source, file).not.toContain('dangerouslySetInnerHTML');
      expect(source, file).not.toMatch(/<style[\s>]/);
      expect(source, file).toContain('.module.css');
    }
  });

  it('keeps newly governed shell CSS tokenized and override-free', () => {
    for (const file of [
      'apps/web/components/platform-v7/ScopedShellGuard.module.css',
      'apps/web/components/platform-v7/CalculatorHeaderWidget.module.css',
      'apps/web/components/platform-v7/HeaderLanguageSwitch.module.css',
    ]) {
      const css = read(file);
      expect(css, file).not.toContain('!important');
      expect(css, file).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(css, file).not.toMatch(/\brgba?\s*\(/i);
      expect(css, file).toContain('var(--ds-');
    }
  });
});
