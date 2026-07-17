import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const controller = source('components/platform-v7/PlatformV7ShellUxController.tsx');
const controllerStyles = source('components/platform-v7/PlatformV7ShellUxController.module.css');
const protectedShell = source('components/platform-v7/PlatformV7ProtectedShell.tsx');
const utilityMenu = source('components/platform-v7/HeaderUtilityMenu.tsx');
const notificationsPage = source('app/platform-v7/notifications/page.tsx');
const notificationsStyles = source('app/platform-v7/notifications/notifications.module.css');
const accessPolicy = source('lib/platform-v7/cabinet-access-policy.ts');

describe('PlatformV7ShellUxController', () => {
  it('binds navigation to the role resolved by the protected shell, never session storage', () => {
    expect(protectedShell).toContain('<PlatformV7ShellUxController role={verifiedRole} />');
    expect(controller).toContain('export function PlatformV7ShellUxController({ role }');
    expect(controller).not.toContain('sessionStorage');
    expect(controller).not.toContain('readActiveRole');
  });

  it('shows no more than four unique primary destinations and removes the vague More item', () => {
    expect(controller).toContain("item.label === 'Ещё'");
    expect(controller).toContain('seen.has(key)');
    expect(controller).toContain('.slice(0, 4)');
    expect(controller).toContain('primaryNavigation(role)');
  });

  it('uses progressive disclosure for secondary sections instead of showing every route at once', () => {
    expect(controller).toContain('<details className={styles.moreSections}>');
    expect(controller).toContain('<summary>Все разделы</summary>');
    expect(controller).toContain('Основное');
    expect(controllerStyles).toContain('.drawerNavigation');
    expect(controllerStyles).toContain('.moreSections');
  });

  it('removes synthetic role notices and duplicate shell controls', () => {
    expect(controller).not.toContain('NOTICES_BY_ROLE');
    expect(controller).not.toContain('Уведомления роли');
    expect(controller).not.toContain('LogOut');
    expect(controllerStyles).toContain("button[aria-label='Открыть уведомления']");
    expect(controllerStyles).toContain('.pc-v4-pilot-note');
    expect(controllerStyles).toContain('.pc-v4-meta');
  });

  it('does not show an operator dock on role-neutral utility routes', () => {
    expect(controller).toContain("const ROLE_NEUTRAL_PATHS = new Set([");
    expect(controller).toContain("'/platform-v7/notifications'");
    expect(controller).toContain('const roleNeutralPath = ROLE_NEUTRAL_PATHS.has(normalizedPath)');
    expect(controller).toContain('mounted && !publicPath && !roleNeutralPath');
  });

  it('keeps large touch targets and a mobile-first role dock', () => {
    expect(controllerStyles).toContain('min-height: 56px');
    expect(controllerStyles).toContain('@media (max-width: 640px)');
    expect(controllerStyles).toContain('@media (forced-colors: active)');
    expect(controllerStyles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('routes notifications to an API-backed inbox without synthetic initial items', () => {
    expect(utilityMenu).toContain("const NOTIFICATIONS_ROUTE = '/platform-v7/notifications'");
    expect(utilityMenu).toContain('Открыть фактические события аккаунта');
    expect(notificationsPage).toContain("fetch('/api/proxy/notifications'");
    expect(notificationsPage).toContain("method: 'PATCH'");
    expect(notificationsPage).toContain('/api/proxy/notifications/read-all');
    expect(notificationsPage).not.toContain('INITIAL_ITEMS');
    expect(notificationsPage).not.toContain('DL-9102');
    expect(notificationsStyles).toContain('min-height: var(--ds-control-height)');
    expect(accessPolicy).toContain("'/platform-v7/notifications'");
  });
});
