import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

// Role home, bottom dock and drawer links now come from the canonical navigation
// registry (`lib/platform-v7/shellRoutes`) — covered by
// platformV7RoleNavigationRegistry.test.ts and platformV7ShellUxRegistry.test.ts.
// The controller-local `HOME_BY_ROLE` / `DOCK_BY_ROLE` constants were removed, so
// the per-role link assertions live with the registry. This file keeps the
// controller's own behavioural guards.

describe('PlatformV7ShellUxController', () => {
  it('logs out by clearing role state and returning to public entry', () => {
    expect(file).toContain('window.sessionStorage.removeItem(ACTIVE_ROLE_KEY)');
    expect(file).toContain('window.localStorage.removeItem(STORE_KEY)');
    expect(file).toContain("document.cookie = 'pc-role=; Max-Age=0; Path=/; SameSite=Lax'");
    expect(file).toContain("router.replace('/platform-v7')");
  });

  it('forces logo to public role-entry page, not login or role home', () => {
    expect(file).toContain("item.href = '/platform-v7'");
    expect(file).toContain('главная страница с описанием платформы и выбором роли');
    expect(file).not.toContain('item.href = roleHome');
  });

  it('hides legacy shell navigation and protects against horizontal overflow', () => {
    expect(file).toContain('.pc-v4-bottomnav{display:none!important}');
    expect(file).toContain('.pc-v4-switch-cabinet{display:none!important}');
    expect(file).toContain('.pc-v4-drawer .pc-v4-nav{display:none!important}');
    expect(file).toContain('.pc-v4-drawer > div:not(:first-child){display:none!important}');
    expect(file).toContain(".pc-v4-actions button[aria-label='Открыть уведомления']{display:none!important}");
    expect(file).toContain('overflow-x:hidden!important');
    expect(file).toContain('pc-v7-safe-drawer-nav');
  });

  it('sources role home, dock and drawer links from the canonical registry, not local constants', () => {
    expect(file).toContain('platformV7RoleRoute');
    expect(file).toContain('platformV7NavByRole');
    expect(file).toContain('platformV7DrawerNavByRole');
    expect(file).not.toContain('const DOCK_BY_ROLE');
    expect(file).not.toContain('const HOME_BY_ROLE');
    expect(file).not.toContain("label: 'ИИ'");
  });

  it('renders role scoped notices instead of global notifications', () => {
    expect(file).toContain('NOTICES_BY_ROLE');
    expect(file).toContain('Уведомления роли');
    expect(file).toContain('pc-v7-notice-panel');
  });
});
