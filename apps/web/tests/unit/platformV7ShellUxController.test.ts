import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

const roles = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'];

describe('PlatformV7ShellUxController', () => {
  it('has a home route for every role', () => {
    for (const role of roles) {
      expect(file).toContain(`${role}: '/platform-v7/`);
    }
  });

  it('logs out by clearing role state and returning to public entry', () => {
    expect(file).toContain("window.sessionStorage.removeItem(ACTIVE_ROLE_KEY)");
    expect(file).toContain("window.localStorage.removeItem(STORE_KEY)");
    expect(file).toContain("document.cookie = 'pc-role=; Max-Age=0; Path=/; SameSite=Lax'");
    expect(file).toContain("router.replace('/platform-v7')");
  });

  it('hides legacy bottom nav and switch-cabinet links', () => {
    expect(file).toContain('.pc-v4-bottomnav{display:none!important}');
    expect(file).toContain('.pc-v4-switch-cabinet{display:none!important}');
  });

  it('replaces legacy drawer nav with role-safe drawer nav', () => {
    expect(file).toContain('.pc-v4-drawer .pc-v4-nav{display:none!important}');
    expect(file).toContain('pc-v7-safe-drawer-nav');
    expect(file).toContain('Безопасное меню роли');
  });

  it('keeps bottom dock as actions, not cross-role navigation', () => {
    expect(file).toContain('Быстрые действия кабинета');
    expect(file).toContain('<span>Главная</span>');
    expect(file).toContain('<span>Поиск</span>');
    expect(file).toContain('<span>Сигналы</span>');
    expect(file).toContain('<span>Меню</span>');
    expect(file).not.toContain('<span>Сделки</span>');
    expect(file).not.toContain('<span>Банк</span>');
  });

  it('does not expose cross-role deal or dispute links to field roles in safe nav', () => {
    const driverBlock = file.slice(file.indexOf('driver: ['), file.indexOf('surveyor: ['));
    const elevatorBlock = file.slice(file.indexOf('elevator: ['), file.indexOf('lab: ['));
    const labBlock = file.slice(file.indexOf('lab: ['), file.indexOf('bank: ['));
    expect(driverBlock).not.toContain('/platform-v7/deals');
    expect(driverBlock).not.toContain('/platform-v7/disputes');
    expect(elevatorBlock).not.toContain('/platform-v7/deals');
    expect(labBlock).not.toContain('/platform-v7/deals');
    expect(labBlock).not.toContain('/platform-v7/disputes');
  });
});
