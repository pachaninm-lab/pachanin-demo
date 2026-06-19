import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';

const file = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

const roles = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'] as const;

describe('PlatformV7ShellUxController', () => {
  it('resolves a platform-v7 home route for every role via the central route map', () => {
    // Per-role routes/labels live in lib/platform-v7/shellRoutes (single source);
    // the shell composes the dock home from platformV7RoleRoute(activeRole).
    expect(file).toContain('platformV7RoleRoute(activeRole)');
    for (const role of roles) {
      expect(String(platformV7RoleRoute(role))).toMatch(/^\/platform-v7\//);
    }
  });

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

  it('builds a role-scoped bottom dock from role nav, not a foreign cabinet menu', () => {
    expect(file).toContain('function toDockLinks');
    expect(file).toContain('.pc-v7-role-dock');
    expect(file).toContain("label: 'Главная'");
  });

  it('renders role scoped notices instead of global notifications', () => {
    expect(file).toContain('NOTICES_BY_ROLE');
    expect(file).toContain('Уведомления роли');
    expect(file).toContain('pc-v7-notice-panel');
  });
});
