import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const root = read('apps/web/app/platform-v7/buyer/rfq/page.tsx');
const aliasFiles = [
  'apps/web/app/platform-v7/buyer/rfq/new/page.tsx',
  'apps/web/app/platform-v7/buyer/rfq/create/page.tsx',
  'apps/web/app/platform-v7/buyer/rfq/detail/page.tsx',
  'apps/web/app/platform-v7/buyer/rfq/[rfqId]/page.tsx',
];
const aliases = aliasFiles.map(read);
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 buyer RFQ authority', () => {
  it('uses the governed v8 cockpit and server-confirmed context', () => {
    expect(root).toContain('OperationalDecisionCockpit');
    expect(root).toContain('OperationalQueueLink');
    expect(root).toContain('getAuthProfile');
    expect(root).toContain('getDealsCanonical');
    expect(root).toContain('profile.available');
    expect(root).toContain('profile.orgId');
    expect(root).not.toMatch(forbiddenPresentation);
  });

  it('fails closed instead of rendering the fixture RFQ runtime', () => {
    for (const forbidden of [
      'GrainExecutionPage',
      "mode='rfq-list'",
      "mode='rfq-new'",
      "mode='rfq-detail'",
      'mock-data',
      'mocks/fixtures/rfq.json',
      'useBuyerRuntimeStore',
      'localStorage',
      'sessionStorage',
      'useState',
      'setTimeout',
    ]) {
      expect(root).not.toContain(forbidden);
      for (const alias of aliases) expect(alias).not.toContain(forbidden);
    }
    expect(root).toContain('нет подтверждённых RFQ read/write API');
    expect(root).toContain('no confirmed RFQ read/write API');
    expect(root).toContain('没有已确认的 RFQ 读写 API');
  });

  it('routes every old create and detail URL to the single governed workspace', () => {
    for (const alias of aliases) {
      expect(alias).toContain("import { redirect } from 'next/navigation'");
      expect(alias).toContain('PLATFORM_V7_BUYER_RFQ_ROUTE');
      expect(alias).toContain('redirect(PLATFORM_V7_BUYER_RFQ_ROUTE)');
      expect(alias).not.toMatch(forbiddenPresentation);
    }
  });

  it('states the server command and atomic Deal handoff boundary in RU EN and ZH', () => {
    expect(root).toContain('Браузер не создаёт закупочный запрос');
    expect(root).toContain('The browser does not create a procurement request');
    expect(root).toContain('浏览器不会创建采购请求');
    expect(root).toContain('audit/outbox');
    expect(root).toContain('creates the canonical Deal atomically');
    expect(root).toContain('原子创建规范交易');
    expect(root).toContain("status: 'Проверить состояние системы'");
    expect(root).toContain("status: 'Check system status'");
    expect(root).toContain("status: '检查系统状态'");
  });

  it('runs the full RFQ route family on minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/buyer/rfq'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/buyer/rfq/page.tsx');
    for (const file of aliasFiles) expect(governance.governedRoots).toContain(file);
    expect(governance.governedRoots).toContain('apps/web/lib/organization-team-server.ts');
  });
});
