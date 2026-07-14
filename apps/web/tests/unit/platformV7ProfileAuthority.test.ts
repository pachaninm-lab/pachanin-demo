import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(repoRoot, relativePath));

const profile = read('apps/web/app/platform-v7/profile/page.tsx');
const reader = read('apps/web/lib/auth-profile-server.ts');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 authenticated profile authority', () => {
  it('uses the governed v8 cockpit without route-local visual overrides', () => {
    expect(profile).toContain('OperationalDecisionCockpit');
    expect(profile).toContain('OperationalQueueLink');
    expect(profile).toContain('InlineNotice');
    expect(profile).toContain('StatusChip');
    expect(profile).not.toMatch(forbiddenPresentation);
  });

  it('shows only fields returned by the authenticated server profile', () => {
    expect(profile).toContain('getAuthProfile');
    expect(profile).toContain('profile.available');
    expect(profile).toContain('profile.fullName');
    expect(profile).toContain('profile.email');
    expect(profile).toContain('profile.role');
    expect(profile).toContain('profile.surfaceRole');
    expect(profile).toContain('profile.orgId');
    expect(profile).toContain('profile.membershipId');
    expect(profile).toContain('profile.mfaVerified');

    for (const forbidden of [
      'Проверено ФГИС',
      'ООО «Прозрачная Цена»',
      '6800000000',
      '1206800000000',
      '130.6 млн ₽',
      '4.7 / 5',
      'DL-9107',
      'MfaSecurityPanel',
      'controlled-pilot',
      'const CERTS',
      'const METRICS',
    ]) {
      expect(profile).not.toContain(forbidden);
    }
  });

  it('keeps the auth reader fail-closed and validates session authority fields', () => {
    expect(reader).toContain("serverApiUrl('/auth/me')");
    expect(reader).toContain('serverAuthHeaders()');
    expect(reader).toContain("cache: 'no-store'");
    expect(reader).toContain('UNAVAILABLE');
    expect(reader).toContain('requiredText(record.id)');
    expect(reader).toContain('requiredText(record.role)');
    expect(reader).toContain('requiredText(record.orgId)');
    expect(reader).toContain('requiredText(record.tenantId)');
    expect(reader).toContain('requiredText(record.membershipId)');
    expect(reader).toContain('optionalBoolean(record.mfaVerified)');
    expect(reader).toContain('optionalDate(record.mfaVerifiedAt)');
    expect(reader).not.toContain('@demo.ru');
    expect(reader).not.toContain('ООО');
  });

  it('does not simulate MFA, sessions, devices or login history in the browser', () => {
    expect(profile).toContain('MFA flow');
    expect(profile).toContain('server MFA flow');
    expect(profile).toContain('服务器 MFA flow');
    expect(exists('apps/web/components/platform-v7/MfaSecurityPanel.tsx')).toBe(false);
  });

  it('provides complete RU EN ZH profile and security boundaries', () => {
    expect(profile).toContain('Только данные подтверждённой сессии');
    expect(profile).toContain('Only confirmed session data');
    expect(profile).toContain('仅显示已确认的会话数据');
    expect(profile).toContain('серверные auth/admin команды');
    expect(profile).toContain('server auth/admin commands');
    expect(profile).toContain('服务器 auth/admin 命令');
  });

  it('runs on the minimal v8 runtime and is registered in governance', () => {
    expect(routePolicy).toContain("'/platform-v7/profile'");
    expect(governance.governedRoots).toContain('apps/web/lib/auth-profile-server.ts');
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/profile/page.tsx');
  });
});
