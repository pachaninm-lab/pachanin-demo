import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/RbacCabinetGuard.tsx'), 'utf8');

describe('platform-v7 route-owned role sync', () => {
  it('keeps concrete cabinet path ownership stronger than stale role state', () => {
    expect(source).toContain('inferPlatformRoleFromPath');
    expect(source).toContain('const pathRole = inferPlatformRoleFromPath(pathname, role)');
    expect(source).toContain('if (pathRole !== role) setRole(pathRole)');
  });

  it('keeps RBAC decision check after role sync wiring', () => {
    expect(source).toContain('cabinetAccessDecision(role, pathname)');
    expect(source).toContain('router.replace(decision.redirectTo)');
  });
});
