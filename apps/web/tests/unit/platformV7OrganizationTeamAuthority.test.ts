import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/profile/team/page.tsx');
const reader = read('apps/web/lib/organization-team-server.ts');
const apiController = read('apps/api/src/modules/auth/auth.controller.ts');
const apiService = read('apps/api/src/modules/auth/organization-team.service.ts');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 organization team authority', () => {
  it('uses the governed read-only v8 cockpit without local visual patches', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('readOnlyTable');
    expect(page).toContain('InlineNotice');
    expect(page).toContain('StatusChip');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('reads the organization team through authenticated server authority', () => {
    expect(page).toContain('getOrganizationTeam');
    expect(reader).toContain("serverApiUrl('/auth/organization-team')");
    expect(reader).toContain('serverAuthHeaders()');
    expect(reader).toContain("cache: 'no-store'");
    expect(reader).toContain('record.members.length > 100');
    expect(reader).toContain('members.some');
    expect(apiController).toContain("@Get('organization-team')");
    expect(apiController).toContain('organizationTeamService.readFor(user)');
  });

  it('enforces tenant, organization and active membership boundaries in PostgreSQL', () => {
    expect(apiService).toContain('Active tenant membership is required.');
    expect(apiService).toContain('Membership does not belong to the active tenant session.');
    expect(apiService).toContain('organization: { tenantId }');
    expect(apiService).toContain('organizationId');
    expect(apiService).toContain('user: { deletedAt: null }');
    expect(apiService).toContain('take: 100');
    expect(apiService).toContain('current: membership.id === membershipId');
  });

  it('removes fake people, invitations and browser-side role mutation', () => {
    for (const forbidden of [
      "'use client'",
      'Максим П.',
      'директор@компания.рф',
      'INITIAL_INVITES',
      'sendInvite',
      'resendInvite',
      'revokeInvite',
      'toggleMemberStatus',
      'useState',
      'setTimeout',
      'Приглашение отправлено',
    ]) {
      expect(page).not.toContain(forbidden);
    }
    expect(page).toContain('нет фиктивных приглашений');
    expect(page).toContain('no fake invitations');
    expect(page).toContain('没有虚假邀请');
  });

  it('keeps role and membership mutation outside the read screen until audited commands exist', () => {
    expect(page).toContain('RBAC, MFA, идемпотентностью и audit trail');
    expect(page).toContain('RBAC, MFA, idempotency and an audit trail');
    expect(page).toContain('RBAC、MFA、幂等性和审计轨迹');
    expect(page).toContain('read-only');
  });

  it('runs on the minimal v8 runtime and remains governed', () => {
    expect(routePolicy).toContain("'/platform-v7/profile/team'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/profile/team/page.tsx');
    expect(governance.governedRoots).toContain('apps/web/lib/organization-team-server.ts');
    expect(governance.version).toBeGreaterThanOrEqual(24);
  });
});
