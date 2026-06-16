import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/RbacCabinetGuard.tsx'), 'utf8');

describe('platform-v7 route-owned role sync', () => {
  it('does not infer or mutate active role from cabinet pathname', () => {
    expect(source).not.toContain('inferPlatformRoleFromPath');
    expect(source).not.toContain('setRole(pathRole)');
  });

  it('keeps RBAC decision check without role migration wiring', () => {
    expect(source).toContain('cabinetAccessDecision(role, pathname)');
    expect(source).toContain('router.replace(decision.redirectTo)');
  });
});
