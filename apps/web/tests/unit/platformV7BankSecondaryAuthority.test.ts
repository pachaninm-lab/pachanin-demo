import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const factoring = read('apps/web/app/platform-v7/bank/factoring/page.tsx');
const aliases = [
  read('apps/web/app/platform-v7/bank/events/page.tsx'),
  read('apps/web/app/platform-v7/bank/events/[id]/page.tsx'),
  read('apps/web/app/platform-v7/bank/grain/page.tsx'),
];
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 bank secondary authority', () => {
  it('replaces browser-owned factoring state with a governed fail-closed workspace', () => {
    expect(factoring).toContain('OperationalDecisionCockpit');
    expect(factoring).toContain('getAuthProfile');
    expect(factoring).toContain('getDealsCanonical');
    expect(factoring).toContain('profile.available');
    expect(factoring).toContain('profile.orgId');
    expect(factoring).not.toMatch(forbiddenPresentation);
    for (const forbidden of ['useState', 'useMemo', 'runPlatformAction', 'P7ActionButton', 'initialApplications', 'FAC-201', '48 млн ₽', 'КС + 4.2%', 'factoring-advance']) {
      expect(factoring).not.toContain(forbidden);
    }
  });

  it('states the server and authenticated bank callback boundary in RU EN and ZH', () => {
    expect(factoring).toContain('Браузер не создаёт заявку');
    expect(factoring).toContain('The browser does not create an application');
    expect(factoring).toContain('浏览器不会创建申请');
    expect(factoring).toContain('audit/outbox');
    expect(factoring).toContain('authenticated callback with reconciliation');
    expect(factoring).toContain('带 reconciliation 的认证银行回调');
  });

  it('redirects obsolete event and grain surfaces to the canonical bank workspace', () => {
    for (const alias of aliases) {
      expect(alias).toContain("import { redirect } from 'next/navigation'");
      expect(alias).toContain('PLATFORM_V7_BANK_ROUTE');
      expect(alias).toContain('redirect(PLATFORM_V7_BANK_ROUTE)');
      expect(alias).not.toMatch(forbiddenPresentation);
      for (const forbidden of ['selectBankCallbackById', 'bankEvents', 'DL-9106', 'amountRub', 'use client']) expect(alias).not.toContain(forbidden);
    }
  });

  it('runs the full bank route family on minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/bank'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/bank/factoring/page.tsx');
    for (const file of [
      'apps/web/app/platform-v7/bank/events/page.tsx',
      'apps/web/app/platform-v7/bank/events/[id]/page.tsx',
      'apps/web/app/platform-v7/bank/grain/page.tsx',
    ]) expect(governance.governedRoots).toContain(file);
  });
});
