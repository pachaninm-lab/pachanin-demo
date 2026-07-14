import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const ai = read('apps/web/app/platform-v7/ai/page.tsx');
const assistant = read('apps/web/app/platform-v7/assistant/page.tsx');
const antiBypass = read('apps/web/app/platform-v7/anti-bypass/page.tsx');
const grainAntiBypass = read('apps/web/app/platform-v7/anti-bypass/grain/page.tsx');
const executionMap = read('apps/web/app/platform-v7/execution-map/page.tsx');
const deals = read('apps/web/app/platform-v7/deals/page.tsx');
const controlTower = read('apps/web/app/platform-v7/control-tower/page.tsx');
const dealFlow = read('apps/web/app/platform-v7/deal-flow/page.tsx');
const scope = read('scripts/check-design-system-v8-pr-scope.mjs');

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 AI, anti-bypass and execution-map compatibility', () => {
  it('routes browser-role AI menus to the canonical Deal authority', () => {
    for (const legacyPage of [ai, assistant]) {
      expect(legacyPage).toContain("import { redirect } from 'next/navigation'");
      expect(legacyPage).toContain("redirect('/platform-v7/deals')");
      expect(legacyPage).not.toContain("'use client'");
      expect(legacyPage).not.toContain('usePlatformV7RStore');
      expect(legacyPage).not.toContain('sessionStorage');
      expect(legacyPage).not.toContain('useSearchParams');
      expect(legacyPage).not.toMatch(forbiddenPresentation);
    }
    expect(deals).toContain('CanonicalDealsList');
  });

  it('routes hardcoded anti-bypass rules and risk fixtures to control-tower authority', () => {
    for (const legacyPage of [antiBypass, grainAntiBypass]) {
      expect(legacyPage).toContain("redirect('/platform-v7/control-tower')");
      expect(legacyPage).not.toMatch(forbiddenPresentation);
    }
    for (const fixture of ['P7DealWorkbench', 'P7ExecutionMachineReadOnlyStrip', 'BR-101', '72/100', 'критический риск', 'LIKELY_BYPASS']) {
      expect(antiBypass).not.toContain(fixture);
      expect(grainAntiBypass).not.toContain(fixture);
    }
    expect(controlTower).toContain('OperationalDecisionCockpit');
  });

  it('routes the static execution sandbox to the public canonical deal flow', () => {
    expect(executionMap).toContain("redirect('/platform-v7/deal-flow')");
    for (const fixture of ['const stages', 'const principles', 'Проверочный контур · песочница', '/platform-v7/trading', '/platform-v7/fgis-to-lot']) {
      expect(executionMap).not.toContain(fixture);
    }
    expect(executionMap).not.toMatch(forbiddenPresentation);
    expect(dealFlow).toContain('export default');
  });

  it('keeps all compatibility routes inside the exact migration scope', () => {
    for (const file of [
      'apps/web/app/platform-v7/ai/page.tsx',
      'apps/web/app/platform-v7/assistant/page.tsx',
      'apps/web/app/platform-v7/anti-bypass/page.tsx',
      'apps/web/app/platform-v7/anti-bypass/grain/page.tsx',
      'apps/web/app/platform-v7/execution-map/page.tsx',
      'apps/web/tests/unit/platformV7AiAntiBypassCompatibility.test.ts',
    ]) {
      expect(scope).toContain(`'${file}'`);
    }
  });
});
