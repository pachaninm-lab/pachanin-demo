import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/profile/team/page.tsx');
const reader = read('apps/web/lib/auth-profile-server.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 team authority', () => {
  it('uses server-confirmed membership in a governed v8 cockpit', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('getAuthProfile');
    expect(page).toContain('profile.membershipId');
    expect(page).toContain('profile.surfaceRole || profile.role');
    expect(page).toContain('profile.mfaVerified');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('removes synthetic people, invitations and client-owned access mutations', () => {
    for (const forbidden of [
      "'use client'",
      'useState',
      'useEffect',
      'setTimeout',
      'sendInvite',
      'resendInvite',
      'revokeInvite',
      'toggleMemberStatus',
      'Максим П.',
      'директор@компания.рф',
      'INV-201',
      'ACCESS_MATRIX',
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it('states the server-side RBAC and audit boundary in all supported languages', () => {
    expect(page).toContain('Клиентский переключатель не меняет RBAC');
    expect(page).toContain('A client toggle never changes RBAC');
    expect(page).toContain('客户端开关不会改变 RBAC');
    expect(page).toContain('идемпотентности');
    expect(page).toContain('idempotency');
    expect(page).toContain('幂等');
  });

  it('uses the authenticated fail-closed profile reader', () => {
    expect(reader).toContain("serverApiUrl('/auth/me')");
    expect(reader).toContain('serverAuthHeaders()');
    expect(reader).toContain("cache: 'no-store'");
    expect(reader).toContain('UNAVAILABLE');
  });

  it('is registered in Design System v8 governance', () => {
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/profile/team/page.tsx');
  });
});
