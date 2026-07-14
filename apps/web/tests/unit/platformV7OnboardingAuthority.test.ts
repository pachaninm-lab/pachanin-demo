import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/onboarding/page.tsx');
const profileReader = read('apps/web/lib/auth-profile-server.ts');
const dealReader = read('apps/web/lib/reporting-server.ts');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 onboarding authority', () => {
  it('uses the governed v8 cockpit without route-local visual overrides', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('InlineNotice');
    expect(page).toContain('StatusChip');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('derives readiness only from authenticated profile and participant-scoped Deals', () => {
    expect(page).toContain('getAuthProfile');
    expect(page).toContain('getReportingRegistry');
    expect(page).toContain('profile.available');
    expect(page).toContain('profile.membershipId');
    expect(page).toContain('profile.mfaVerified');
    expect(page).toContain('registry.available');
    expect(page).toContain('registry.deals.length');
    expect(page).toContain("profile.surfaceRole || profile.role");
    expect(page).toContain('encodeURIComponent(firstDeal.id)');
  });

  it('keeps both server readers authenticated, bounded and fail-closed', () => {
    expect(profileReader).toContain("serverApiUrl('/auth/me')");
    expect(profileReader).toContain('serverAuthHeaders()');
    expect(profileReader).toContain("cache: 'no-store'");
    expect(profileReader).toContain('UNAVAILABLE');
    expect(dealReader).toContain("serverApiUrl('/deals')");
    expect(dealReader).toContain('serverAuthHeaders()');
    expect(dealReader).toContain("cache: 'no-store'");
    expect(dealReader).toContain('value.slice(0, 100)');
    expect(dealReader).toContain('UNAVAILABLE');
  });

  it('does not select roles or manufacture onboarding readiness in the browser', () => {
    for (const forbidden of [
      'getPlatformV7OpenWalkthroughState',
      'CockpitHero',
      'statePill',
      'Сначала выбирается роль',
      'Оператор связывает роль',
      'controlled-pilot',
      'pre-integration',
      'localStorage',
      'sessionStorage',
      'useState',
      'setTimeout',
      '?role=',
    ]) {
      expect(page).not.toContain(forbidden);
    }
    expect(page).toContain('не выбирает роль');
    expect(page).toContain('does not select a role');
    expect(page).toContain('不会在浏览器中选择角色');
  });

  it('keeps external systems outside the onboarding authority boundary', () => {
    expect(page).toContain('не подключает банк, ФГИС, ЭДО или ЭПД');
    expect(page).toContain('connect a bank, grain registry, EDI or transport system');
    expect(page).toContain('连接银行、粮食登记、电子单证或运输系统');
    expect(page).toContain("href: '/platform-v7/connectors'");
  });

  it('runs on the minimal v8 runtime and remains governed', () => {
    expect(routePolicy).toContain("'/platform-v7/onboarding'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/onboarding/page.tsx');
    expect(governance.governedRoots).toContain('apps/web/lib/auth-profile-server.ts');
    expect(governance.governedRoots).toContain('apps/web/lib/reporting-server.ts');
  });
});
