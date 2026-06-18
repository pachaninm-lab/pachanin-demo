import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const template = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const lockFix = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7RoleLockFix.tsx'), 'utf8');
const appShell = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/v7r/AppShellV4.tsx'), 'utf8');

describe('platform-v7 active role lock', () => {
  it('mounts the role lock fix for every platform-v7 route', () => {
    expect(template).toContain('PlatformV7RoleLockFix');
    expect(template).toContain('<PlatformV7RoleLockFix />');
  });

  it('restores active role from the single-entry session key', () => {
    expect(lockFix).toContain("const ACTIVE_ROLE_KEY = 'pc-v7-active-role'");
    expect(lockFix).toContain('window.sessionStorage.getItem(ACTIVE_ROLE_KEY)');
    expect(lockFix).toContain('setRole(locked)');
    expect(lockFix).toContain('document.cookie = `pc-role=${locked}; Path=/; SameSite=Lax`;');
  });

  it('does not infer active role from the current URL inside AppShellV4', () => {
    expect(appShell).not.toContain('inferRoleFromPath');
    expect(appShell).not.toContain('setRole(inferred)');
    expect(appShell).toContain('platformV7NavByRole(displayRole)');
    expect(appShell).toContain('platformV7RoleRoute(displayRole)');
  });
});
