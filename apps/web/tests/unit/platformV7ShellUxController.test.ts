import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

const roles = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'];

function block(name: string, next: string) {
  return file.slice(file.indexOf(`${name}: [`), file.indexOf(`${next}: [`));
}

describe('PlatformV7ShellUxController', () => {
  it('has a home route for every role', () => {
    for (const role of roles) {
      expect(file).toContain(`${role}: '/platform-v7/`);
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

  it('hides legacy bottom nav, switch-cabinet links, legacy drawer nav and global notices', () => {
    expect(file).toContain('.pc-v4-bottomnav{display:none!important}');
    expect(file).toContain('.pc-v4-switch-cabinet{display:none!important}');
    expect(file).toContain('.pc-v4-drawer .pc-v4-nav{display:none!important}');
    expect(file).toContain(".pc-v4-actions button[aria-label='Открыть уведомления']{display:none!important}");
    expect(file).toContain('pc-v7-safe-drawer-nav');
  });

  it('uses role-specific dock with AI and optional menu only', () => {
    expect(file).toContain('DOCK_BY_ROLE');
    expect(file).toContain("label: 'ИИ'");
    expect(file).toContain('showMenuButton');
    expect(file).toContain('hasExtraMenuItems');
    expect(file).not.toContain("action: 'signals'");
    expect(file).not.toContain("label: 'Сигналы'");
    expect(file).not.toContain("label: 'События'");
  });

  it('does not keep fake same-screen dock actions for field roles', () => {
    const driver = block('driver', 'surveyor');
    const elevator = block('elevator', 'lab');
    const lab = block('lab', 'bank');
    expect(driver).toContain("label: 'Маршрут'");
    expect(driver).toContain("label: 'ИИ'");
    expect(driver).not.toContain("label: 'Фото'");
    expect(driver).not.toContain('/platform-v7/deals');
    expect(driver).not.toContain('/platform-v7/bank');
    expect(elevator).toContain("label: 'Приёмка'");
    expect(elevator).not.toContain("label: 'Вес'");
    expect(elevator).not.toContain("label: 'Акты'");
    expect(elevator).not.toContain('/platform-v7/deals');
    expect(lab).toContain("label: 'Пробы'");
    expect(lab).not.toContain("label: 'Качество'");
    expect(lab).not.toContain("label: 'Протокол'");
    expect(lab).not.toContain('/platform-v7/deals');
    expect(lab).not.toContain('/platform-v7/disputes');
  });

  it('keeps bank and executive access to real distinct routes', () => {
    const bank = block('bank', 'arbitrator');
    const executive = file.slice(file.indexOf('executive: ['), file.indexOf('};', file.indexOf('executive: [')));
    expect(bank).toContain("label: 'Факторинг'");
    expect(bank).toContain("label: 'Эскроу'");
    expect(executive).toContain("label: 'Сводка'");
    expect(executive).toContain("label: 'Деньги'");
  });

  it('renders role scoped notices instead of global notifications', () => {
    expect(file).toContain('NOTICES_BY_ROLE');
    expect(file).toContain('Уведомления роли');
    expect(file).toContain('pc-v7-notice-panel');
  });
});
