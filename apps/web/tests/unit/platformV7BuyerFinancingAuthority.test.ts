import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/buyer/financing/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 buyer financing authority', () => {
  it('uses the governed v8 cockpit and server-confirmed context', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('getAuthProfile');
    expect(page).toContain('getDealsCanonical');
    expect(page).toContain('profile.available');
    expect(page).toContain('profile.orgId');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('removes the local credit simulation and browser-owned application state', () => {
    for (const forbidden of [
      "'use client'",
      'SANDBOX_APPLICATIONS',
      'CREDIT_LIMITS',
      'CreditApplication',
      'useState',
      'handleSubmit',
      'showForm',
      'setSubmitted',
      'cr-001',
      'cr-002',
      '20_000_000',
      '14.5',
      'Подать заявку',
      'Заявка создана в проверочном контуре',
    ]) expect(page).not.toContain(forbidden);
  });

  it('states the server and bank authority boundary in RU EN and ZH', () => {
    expect(page).toContain('нет подтверждённых financing API');
    expect(page).toContain('no confirmed financing API');
    expect(page).toContain('没有已确认的 financing API');
    expect(page).toContain('Браузер не создаёт заявку');
    expect(page).toContain('The browser does not create an application');
    expect(page).toContain('浏览器不会创建申请');
    expect(page).toContain('callback и reconciliation');
    expect(page).toContain('callback and reconciliation');
    expect(page).toContain('callback 和 reconciliation');
  });

  it('registers the route in minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/buyer/financing'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/buyer/financing/page.tsx');
  });
});
