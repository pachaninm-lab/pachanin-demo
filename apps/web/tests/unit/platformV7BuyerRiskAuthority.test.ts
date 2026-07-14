import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const matches = read('apps/web/app/platform-v7/buyer/matches/page.tsx');
const reputation = read('apps/web/app/platform-v7/buyer/reputation/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 buyer matching and reputation authority', () => {
  it('routes the fictional matching dashboard to the governed RFQ boundary', () => {
    expect(matches).toContain("import { redirect } from 'next/navigation'");
    expect(matches).toContain('PLATFORM_V7_BUYER_RFQ_ROUTE');
    expect(matches).toContain('redirect(PLATFORM_V7_BUYER_RFQ_ROUTE)');
    expect(matches).not.toContain('88%');
    expect(matches).not.toContain('GrainWorkflowPage');
    expect(matches).not.toContain('style=');
  });

  it('uses the governed v8 cockpit and server-confirmed context for counterparty assessment', () => {
    expect(reputation).toContain('OperationalDecisionCockpit');
    expect(reputation).toContain('getAuthProfile');
    expect(reputation).toContain('getDealsCanonical');
    expect(reputation).toContain('profile.available');
    expect(reputation).toContain('profile.orgId');
    expect(reputation).not.toMatch(forbiddenPresentation);
  });

  it('removes fictional scores and browser-owned scoring authority', () => {
    for (const forbidden of ["'use client'", '92/100', 'GrainWorkflowPage', 'useState', 'localStorage', 'sessionStorage']) {
      expect(reputation).not.toContain(forbidden);
    }
    expect(reputation).toContain('нет подтверждённых counterparty-risk API');
    expect(reputation).toContain('no confirmed counterparty-risk API');
    expect(reputation).toContain('没有已确认的 counterparty-risk API');
  });

  it('states explainability, provenance and appeal boundaries in RU EN and ZH', () => {
    expect(reputation).toContain('Браузер не рассчитывает, не хранит и не изменяет рейтинг');
    expect(reputation).toContain('The browser does not calculate, store or change a rating');
    expect(reputation).toContain('浏览器不会计算、存储或更改评分');
    expect(reputation).toContain('версия модели');
    expect(reputation).toContain('model version');
    expect(reputation).toContain('模型版本');
    expect(reputation).toContain('процедуры оспаривания');
    expect(reputation).toContain('appeal procedure');
    expect(reputation).toContain('申诉流程');
  });

  it('registers the reputation route in minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/buyer/reputation'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/buyer/reputation/page.tsx');
  });
});
