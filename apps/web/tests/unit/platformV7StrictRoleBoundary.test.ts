import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guard = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7SingleEntryGuard.tsx'), 'utf8');
const nav = fs.readFileSync(path.join(process.cwd(), 'lib/platform-v7/shellRoutes.ts'), 'utf8');
const rbac = fs.readFileSync(path.join(process.cwd(), 'lib/platform-v7/cabinet-access-policy.ts'), 'utf8');
const shellPolicy = fs.readFileSync(path.join(process.cwd(), 'lib/platform-v7/shell-role-policy.ts'), 'utf8');

const participantRoles = ['driver', 'elevator', 'lab', 'surveyor', 'seller', 'buyer', 'logistics', 'bank', 'arbitrator', 'compliance'];

describe('platform-v7 strict role boundaries', () => {
  it('enforces cabinet RBAC by default', () => {
    expect(rbac).toContain('return true;');
    expect(rbac).not.toContain("reason: 'RBAC не применяется");
    expect(rbac).toContain("redirectTo: platformV7RoleRoute(role) ?? '/platform-v7/login'");
  });

  it('uses the canonical role registry for single-entry role boundaries', () => {
    expect(guard).toContain('platformV7RoleRoute');
    expect(guard).toContain('platformV7RoleCanOpenHref');
    expect(guard).not.toContain('const ROLE_HOME');
    expect(guard).not.toContain('const ALLOWED');
  });

  it('keeps driver home on the field route through the canonical registry', () => {
    expect(nav).toContain('driver: {');
    expect(nav).toContain('home: PLATFORM_V7_DRIVER_FIELD_ROUTE');
    expect(guard).toContain('platformV7RoleHome(role: PlatformRole)');
    expect(guard).toContain('return platformV7RoleRoute(role);');
  });

  it('does not expose deals or disputes in participant bottom navigation blocks', () => {
    for (const role of participantRoles) {
      const start = nav.indexOf(`${role}: {`);
      expect(start).toBeGreaterThan(-1);
      const bottomStart = nav.indexOf('bottom: [', start);
      const bottomEnd = nav.indexOf('],', bottomStart);
      const block = nav.slice(bottomStart, bottomEnd);
      expect(block).not.toContain('PLATFORM_V7_DEALS_ROUTE');
      expect(block).not.toContain('PLATFORM_V7_DISPUTES_ROUTE');
    }
  });

  it('treats the disputes route as part of the arbitrator cabinet', () => {
    // Strict isolation: /disputes is owned by the arbitrator cabinet.
    expect(shellPolicy).toContain("pathname.startsWith('/platform-v7/arbitrator') || pathname.startsWith('/platform-v7/disputes')");
  });

  it('limits header role switcher to operator and executive', () => {
    expect(shellPolicy).toContain("if (role !== 'operator' && role !== 'executive') return []");
    expect(shellPolicy).toContain("role === 'operator' || role === 'executive'");
  });
});
