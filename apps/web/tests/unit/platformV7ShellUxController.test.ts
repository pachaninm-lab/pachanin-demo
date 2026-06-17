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

  it('hides legacy bottom nav, switch-cabinet links and legacy drawer nav', () => {
    expect(file).toContain('.pc-v4-bottomnav{display:none!important}');
    expect(file).toContain('.pc-v4-switch-cabinet{display:none!important}');
    expect(file).toContain('.pc-v4-drawer .pc-v4-nav{display:none!important}');
    expect(file).toContain('pc-v7-safe-drawer-nav');
  });

  it('uses a role-specific five item dock with AI and menu', () => {
    expect(file).toContain('DOCK_BY_ROLE');
    expect(file).toContain('grid-template-columns:repeat(5,minmax(0,1fr))');
    expect(file).toContain("label: 'ИИ'");
    expect(file).toContain("label: 'Меню'");
    expect(file).toContain("const AI_HREF = '/platform-v7/ai'");
  });

  it('keeps field role dock inside role context while preserving role function labels', () => {
    const driver = block('driver', 'surveyor');
    const elevator = block('elevator', 'lab');
    const lab = block('lab', 'bank');
    expect(driver).toContain("label: 'Маршрут'");
    expect(driver).toContain("label: 'Фото'");
    expect(driver).not.toContain('/platform-v7/deals');
    expect(driver).not.toContain('/platform-v7/bank');
    expect(elevator).toContain("label: 'Вес'");
    expect(elevator).toContain("label: 'Акты'");
    expect(elevator).not.toContain('/platform-v7/deals');
    expect(lab).toContain("label: 'Качество'");
    expect(lab).toContain("label: 'Протокол'");
    expect(lab).not.toContain('/platform-v7/deals');
    expect(lab).not.toContain('/platform-v7/disputes');
  });

  it('keeps operator, executive and bank access to their wider functional docks', () => {
    const operator = block('operator', 'buyer');
    const bank = block('bank', 'arbitrator');
    const executive = file.slice(file.indexOf('executive: ['), file.indexOf('};', file.indexOf('executive: [')));
    expect(operator).toContain("label: 'Сделки'");
    expect(operator).toContain("label: 'Деньги'");
    expect(bank).toContain("label: 'Факторинг'");
    expect(bank).toContain("label: 'Эскроу'");
    expect(executive).toContain("label: 'Сводка'");
    expect(executive).toContain("label: 'Деньги'");
  });
});
