import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/profile/team/page.tsx');
const reader = read('apps/web/lib/organization-team-server.ts');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 profile team authority', () => {
  it('uses the governed task-first v8 cockpit', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalCockpitSection');
    expect(page).toContain('InlineNotice');
    expect(page).toContain('StatusChip');
    expect(page).toContain('readOnlyTable');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('renders only the tenant-scoped roster confirmed by the active server session', () => {
    expect(page).toContain('getOrganizationTeam');
    expect(page).toContain('team.available');
    expect(page).toContain('team.organizationId');
    expect(page).toContain('team.tenantId');
    expect(page).toContain('team.currentMembershipId');
    expect(page).toContain('team.members.map');
    expect(reader).toContain("serverApiUrl('/auth/organization-team')");
    expect(reader).toContain('serverAuthHeaders()');
    expect(reader).toContain("cache: 'no-store'");
    expect(reader).toContain('record.members.length > 100');
    expect(reader).toContain('member.membershipId === currentMembershipId && member.current');
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
      'localStorage',
      'sessionStorage',
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it('states the administration boundary in RU EN and ZH', () => {
    expect(page).toContain('Клиент не создаёт участников и не меняет права');
    expect(page).toContain('The client cannot create members or change authority');
    expect(page).toContain('客户端不能创建成员或更改权限');
    expect(page).toContain('отзыв сессий должны выполняться отдельными серверными командами');
    expect(page).toContain('revoking sessions require separate server commands');
    expect(page).toContain('撤销会话必须通过具有 RBAC、MFA、幂等性和审计轨迹的独立服务器命令完成');
  });

  it('runs on the minimal v8 runtime and remains governed', () => {
    expect(routePolicy).toContain("'/platform-v7/profile/team'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/profile/team/page.tsx');
    expect(governance.governedRoots).toContain('apps/web/lib/organization-team-server.ts');
  });
});
