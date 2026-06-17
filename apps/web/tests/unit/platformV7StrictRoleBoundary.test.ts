import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guard = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7SingleEntryGuard.tsx'), 'utf8');
const nav = fs.readFileSync(path.join(process.cwd(), 'apps/web/lib/platform-v7/shellRoutes.ts'), 'utf8');
const rbac = fs.readFileSync(path.join(process.cwd(), 'apps/web/lib/platform-v7/cabinet-access-policy.ts'), 'utf8');
const shellPolicy = fs.readFileSync(path.join(process.cwd(), 'apps/web/lib/platform-v7/shell-role-policy.ts'), 'utf8');

const participantRoles = ['driver', 'elevator', 'lab', 'surveyor', 'seller', 'buyer', 'logistics', 'bank', 'arbitrator', 'compliance'];

describe('platform-v7 strict role boundaries', () => {
  it('enforces cabinet RBAC by default', () => {
    expect(rbac).toContain('return true;');
    expect(rbac).not.toContain("reason: 'RBAC не применяется");
    expect(rbac).toContain("redirectTo: '/platform-v7/login'");
  });

  it('keeps driver in driver cabinet only', () => {
    expect(guard).toContain("driver: ['/platform-v7/driver']");
    expect(nav).toContain("driver: [");
    expect(nav).toContain("{ href: PLATFORM_V7_DRIVER_FIELD_CANONICAL_ROUTE, label: 'Мой маршрут' }");
  });

  it('does not expose deals or disputes in participant nav blocks', () => {
    for (const role of participantRoles) {
      const start = nav.indexOf(`${role}: [`);
      expect(start).toBeGreaterThan(-1);
      const end = nav.indexOf('\n  ],', start);
      const block = nav.slice(start, end);
      if (role !== 'operator' && role !== 'executive') {
        expect(block).not.toContain('PLATFORM_V7_DEALS_ROUTE');
        expect(block).not.toContain('PLATFORM_V7_DISPUTES_ROUTE');
      }
    }
  });

  it('does not infer disputes as arbitrator cabinet', () => {
    expect(shellPolicy).not.toContain("pathname.startsWith('/platform-v7/arbitrator') || pathname.startsWith('/platform-v7/disputes')");
  });

  it('limits header role switcher to operator and executive', () => {
    expect(shellPolicy).toContain("if (role !== 'operator' && role !== 'executive') return []");
    expect(shellPolicy).toContain("role === 'operator' || role === 'executive'");
  });
});
