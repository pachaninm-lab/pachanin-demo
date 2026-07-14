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
  it('uses the governed v8 cockpit and server-confirmed context', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('getAuthProfile');
    expect(page).toContain('getDealsCanonical');
    expect(page).toContain('profile.available');
    expect(page).toContain('profile.orgId');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('removes fixture scoring and unsupported payment conclusions', () => {
    for (const forbidden of [
      "'use client'",
      'GrainWorkflowPage',
      "value: '91/100'",
      "value: 'стандартная'",
      "value: 'без критических событий'",
      "value: 'резерв обязателен'",
      "primaryHref='/platform-v7/trust'",
    ]) expect(page).not.toContain(forbidden);
  });

  it('states the evidence authority boundary in RU EN and ZH', () => {
    expect(page).toContain('нет подтверждённых buyer-risk API');
    expect(page).toContain('no confirmed buyer-risk API');
    expect(page).toContain('没有已确认的 buyer-risk API');
    expect(page).toContain('Браузер не рассчитывает, не хранит и не меняет рейтинг покупателя');
    expect(page).toContain('The browser does not calculate, store or change a buyer rating');
    expect(page).toContain('浏览器不会计算、存储或更改买方评分');
    expect(page).toContain('immutable provenance');
    expect(page).toContain('audit/outbox');
    expect(page).toContain('процедуры оспаривания');
  });

  it('registers the route in minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/seller/reputation'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/seller/reputation/page.tsx');
  });
});
