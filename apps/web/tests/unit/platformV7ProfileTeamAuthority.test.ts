import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/profile/team/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 profile team authority', () => {
  it('uses the governed task-first v8 cockpit', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('InlineNotice');
    expect(page).toContain('StatusChip');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('shows only the membership confirmed by the active server session', () => {
    expect(page).toContain('getAuthProfile');
    expect(page).toContain('profile.available');
    expect(page).toContain('profile.orgId');
    expect(page).toContain('profile.membershipId');
    expect(page).toContain('profile.surfaceRole || profile.role');
    expect(page).toContain('Единственная запись, которую этот экран может подтвердить');
  });

  it('removes fictional people, invitations and browser-owned access changes', () => {
    for (const forbidden of [
      "'use client'",
      'Максим П.',
      'директор@компания.рф',
      'Оператор сделки',
      'INV-201',
      'INITIAL_INVITES',
      'ACCESS_MATRIX',
      'IAM_METRICS',
      'sendInvite',
      'resendInvite',
      'revokeInvite',
      'toggleMemberStatus',
      'useState',
      'setTimeout',
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it('states the administration boundary in RU EN and ZH', () => {
    expect(page).toContain('Браузер не создаёт membership');
    expect(page).toContain('The browser does not create memberships');
    expect(page).toContain('浏览器不会创建 membership');
    expect(page).toContain('отзывать активные сессии');
    expect(page).toContain('revoke active sessions');
    expect(page).toContain('不可变审计轨迹');
  });

  it('runs on the minimal v8 runtime and remains governed', () => {
    expect(routePolicy).toContain("'/platform-v7/profile/team'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/profile/team/page.tsx');
    expect(governance.governedRoots).toContain('apps/web/lib/auth-profile-server.ts');
  });
});
