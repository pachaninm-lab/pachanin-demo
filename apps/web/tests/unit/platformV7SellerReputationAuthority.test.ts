import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/seller/reputation/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 seller reputation authority', () => {
  it('uses server-confirmed context and the governed v8 cockpit', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('getAuthProfile');
    expect(page).toContain('getDealsCanonical');
    expect(page).toContain('profile.available');
    expect(page).toContain('profile.orgId');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('removes the fixture rating and browser-owned risk authority', () => {
    expect(page).not.toContain('GrainWorkflowPage');
    expect(page).not.toContain("'use client'");
    expect(page).not.toContain('91/100');
    expect(page).not.toContain("value: 'стандартная'");
    expect(page).not.toContain('без критических событий');
    expect(page).not.toContain('резерв обязателен');
  });

  it('states the evidence and appeal boundary in RU EN and ZH', () => {
    expect(page).toContain('нет подтверждённых buyer-risk API');
    expect(page).toContain('no confirmed buyer-risk API');
    expect(page).toContain('没有已确认的 buyer-risk API');
    expect(page).toContain('Браузер не рассчитывает, не хранит и не меняет рейтинг покупателя');
    expect(page).toContain('The browser does not calculate, store or change a buyer rating');
    expect(page).toContain('浏览器不会计算、存储或更改买方评分');
    expect(page).toContain('процедуры оспаривания');
    expect(page).toContain('appeal procedure');
    expect(page).toContain('申诉流程');
  });

  it('registers the route in minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/seller/reputation'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/seller/reputation/page.tsx');
  });
});
